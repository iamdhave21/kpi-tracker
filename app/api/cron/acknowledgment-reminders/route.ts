import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Weekly Pulse Check / employee weekly week_start, matching the app's own
// Monday-based convention (KPIApp.tsx getWeekStart) without importing
// client component code into a server route.
function getWeekStart(d: Date = new Date()): string {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

// Same exemption rule as the AV Scan feature itself (KPIApp.tsx
// PULSE_CHECK_EXEMPT_EMAILS / AV_SCAN_REQUIRED_FROM) -- kept in sync by
// hand since this route can't import from the client component file.
const AV_SCAN_EXEMPT_EMAILS = ['operations@ab-businesssupport.com', 'andrealiz@ab-businesssupport.com']
const AV_SCAN_REQUIRED_FROM = new Date('2026-09-21')

// Runs once daily via Vercel Cron (see vercel.json). Emails every active
// employee a digest of anything they still haven't acknowledged/completed:
// coaching sessions requiring acknowledgment, announcements, incomplete
// tasks, this week's missing Quick Scan, and this month's missing Full
// Scan. Skips anyone with nothing pending -- no email if they're all
// caught up.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const supabase = getSupabase()

  const { data: employees, error: empErr } = await supabase
    .from('employees').select('id, name, email').eq('active', true).not('email', 'is', null)
  if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 })
  if (!employees || employees.length === 0) return NextResponse.json({ success: true, sent: 0 })

  // Quick scan is weekly, full scan is monthly -- two different period
  // keys, same currentPeriodKey('weekly'|'monthly') convention as
  // Operating Cadence and the AVScanPanel client component. currentWeek
  // (the Monday date) IS the weekly period key already; currentMonth is
  // the new one needed for the monthly full scan.
  const currentWeek = getWeekStart()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const pastAvScanLaunch = new Date() >= AV_SCAN_REQUIRED_FROM

  const [{ data: allCoaching }, { data: allAnnouncements }, { data: allAcks }, { data: allTasks }, { data: appUsers }, { data: avSubs }] = await Promise.all([
    supabase.from('coaching_logs').select('employee_email, date, type').eq('requires_acknowledgment', true).eq('agent_acknowledged', false).eq('status', 'Final'),
    supabase.from('announcements').select('id, title').eq('active', true),
    supabase.from('announcement_acknowledgements').select('announcement_id, user_email'),
    supabase.from('tasks').select('assigned_to, title, due_date').eq('is_done', false),
    pastAvScanLaunch ? supabase.from('app_users').select('email, role') : Promise.resolve({ data: [] as any[] }),
    pastAvScanLaunch ? supabase.from('av_scan_submissions').select('employee_id, scan_type, period_key').in('period_key', [currentWeek, currentMonth]) : Promise.resolve({ data: [] as any[] }),
  ])
  const roleByEmail = new Map((appUsers || []).map((u: any) => [u.email?.toLowerCase(), u.role]))
  // Only count a submission if its scan_type's period actually matches
  // the CURRENT period for that type -- a 'full' row whose period_key is
  // last month's, or a 'quick' row from an earlier week, must not count
  // as satisfying this period just because it shares the .in() filter.
  const avByEmployee = new Map<string, Set<string>>()
  ;(avSubs || []).forEach((s: any) => {
    const current = (s.scan_type === 'quick' && s.period_key === currentWeek) || (s.scan_type === 'full' && s.period_key === currentMonth)
    if (!current) return
    const set = avByEmployee.get(s.employee_id) || new Set<string>()
    set.add(s.scan_type)
    avByEmployee.set(s.employee_id, set)
  })

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'

  let sent = 0
  for (const emp of employees) {
    const email = emp.email!.toLowerCase()
    const missingCoaching = (allCoaching || []).filter((c:any) => c.employee_email?.toLowerCase() === email)
    const ackedIds = new Set((allAcks || []).filter((a:any) => a.user_email?.toLowerCase() === email).map((a:any) => a.announcement_id))
    const missingAnnouncements = (allAnnouncements || []).filter((a:any) => !ackedIds.has(a.id))
    const missingTasks = (allTasks || []).filter((t:any) => t.assigned_to?.toLowerCase() === email)

    // Same population/exemption as the AV Scan feature itself: no role
    // recognised for this email (no app_users row) means not exempt by
    // default, same fail-open-to-included reasoning as everything else
    // that checks role in this app -- an unrecognised value should not
    // silently drop someone out of a compliance reminder.
    const role = roleByEmail.get(email)
    const avExempt = role === 'super_admin' || AV_SCAN_EXEMPT_EMAILS.includes(email)
    const submittedTypes = avByEmployee.get(emp.id) || new Set<string>()
    const missingAvScans: string[] = []
    if (pastAvScanLaunch && !avExempt) {
      if (!submittedTypes.has('quick')) missingAvScans.push("This week's Quick Scan")
      if (!submittedTypes.has('full')) missingAvScans.push("This month's Full Scan")
    }

    const totalPending = missingCoaching.length + missingAnnouncements.length + missingTasks.length + missingAvScans.length
    if (totalPending === 0) continue

    const rows = [
      ...missingCoaching.map((c:any) => `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">📋 Coaching session</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${c.type || 'Coaching session'} (${new Date(c.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})})</td></tr>`),
      ...missingAnnouncements.map((a:any) => `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">📢 Announcement</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${a.title}</td></tr>`),
      ...missingTasks.map((t:any) => `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">✅ Task</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${t.title}${t.due_date ? ' (due ' + new Date(t.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ')' : ''}</td></tr>`),
      ...missingAvScans.map((label:string) => `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">🛡️ AV Scan</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${label}</td></tr>`),
    ].join('')

    try {
      await transporter.sendMail({
        from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
        to: emp.email,
        subject: `📋 You have ${totalPending} pending item${totalPending !== 1 ? 's' : ''} to acknowledge — AB BSS Operations Portal`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="background: #1e3a8a; padding: 24px; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 18px;">Daily Pending Items Reminder</h2>
              <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">${totalPending} item${totalPending !== 1 ? 's' : ''} still need${totalPending === 1 ? 's' : ''} your acknowledgment or completion</p>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr style="background:#f9fafb;"><th style="padding:8px;text-align:left;color:#6b7280;">Type</th><th style="padding:8px;text-align:left;color:#6b7280;">Item</th></tr>
                ${rows}
              </table>
              <a href="${appUrl}" style="display:inline-block;margin-top:20px;background:#1e3a8a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Open Portal →</a>
              <p style="color:#6b7280;font-size:12px;margin-top:20px;">This is an automated daily reminder from the AB BSS Operations Portal. It'll keep sending until everything above is acknowledged/completed.</p>
            </div>
          </div>
        `
      })
      sent++
    } catch (err) {
      console.error(`Failed to send pending-items reminder to ${emp.email}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent, totalEmployees: employees.length })
}

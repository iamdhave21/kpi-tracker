import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Runs once daily via Vercel Cron (see vercel.json). Emails every active
// employee a digest of anything they still haven't acknowledged/completed:
// coaching sessions requiring acknowledgment, announcements, and incomplete
// tasks. Skips anyone with nothing pending -- no email if they're all caught up.
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

  const [{ data: allCoaching }, { data: allAnnouncements }, { data: allAcks }, { data: allTasks }] = await Promise.all([
    supabase.from('coaching_logs').select('employee_email, date, type').eq('requires_acknowledgment', true).eq('agent_acknowledged', false).eq('status', 'Final'),
    supabase.from('announcements').select('id, title').eq('active', true),
    supabase.from('announcement_acknowledgements').select('announcement_id, user_email'),
    supabase.from('tasks').select('assigned_to, title, due_date').eq('is_done', false),
  ])

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

    const totalPending = missingCoaching.length + missingAnnouncements.length + missingTasks.length
    if (totalPending === 0) continue

    const rows = [
      ...missingCoaching.map((c:any) => `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">📋 Coaching session</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${c.type || 'Coaching session'} (${new Date(c.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})})</td></tr>`),
      ...missingAnnouncements.map((a:any) => `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">📢 Announcement</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${a.title}</td></tr>`),
      ...missingTasks.map((t:any) => `<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;">✅ Task</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;">${t.title}${t.due_date ? ' (due ' + new Date(t.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ')' : ''}</td></tr>`),
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

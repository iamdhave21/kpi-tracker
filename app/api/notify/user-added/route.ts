import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { newUsername, newRole, addedBy } = await req.json()

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const supabase = getSupabase()

    // Get all managers, team leads, and super admins to notify
    const { data: recipients } = await supabase
      .from('app_users')
      .select('email, username, role')
      .in('role', ['super_admin', 'admin', 'team_lead'])
      .eq('active', true)

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ success: true, message: 'No recipients found' })
    }

    const roleLabels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Manager',
      team_lead: 'Team Lead',
      viewer: 'Agent / Viewer'
    }

    const toEmails = recipients
      .map(r => r.email || `${r.username}@ab-businesssupport.com`)
      .filter(Boolean)

    await resend.emails.send({
      from: 'AB BSS Portal <onboarding@resend.dev>',
      to: toEmails,
      subject: `New User Added — AB BSS Operations Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">New User Notification</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 15px;">A new user has been added to the portal:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Email</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${newUsername}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px;">Role</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${roleLabels[newRole] || newRole}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #6b7280; font-size: 13px;">Added by</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${addedBy}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">This is an automated notification from the AB BSS Operations Portal.</p>
          </div>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Email notification error:', err)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}

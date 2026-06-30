import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { ticketId, title, category, priority, createdBy } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    })

    const supabase = getSupabase()
    const { data: recipients } = await supabase
      .from('app_users')
      .select('email, username, role')
      .in('role', ['super_admin', 'admin', 'team_lead'])
      .eq('active', true)

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ success: true, message: 'No recipients' })
    }

    const priorityColors: Record<string, string> = {
      Low: '#10b981',
      Medium: '#f59e0b',
      High: '#ef4444',
      Urgent: '#dc2626',
    }

    const toEmails = recipients
      .map(r => r.email || `${r.username}@ab-businesssupport.com`)
      .filter(Boolean)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: toEmails.join(','),
      subject: `🎫 New Ticket: ${title}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #1e3a8a; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">🎫 New Ticket Submitted</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Action may be required</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 12px;">${title}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Category</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${category}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px;">Priority</td>
                <td style="padding: 10px; font-size: 13px; font-weight: 600; color: ${priorityColors[priority] || '#374151'};">${priority}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #6b7280; font-size: 13px;">Submitted by</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${createdBy}</td>
              </tr>
            </table>
            <a href="${appUrl}" style="display: inline-block; background: #1e3a8a; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">View Ticket</a>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">This is an automated notification from the AB BSS Operations Portal.</p>
          </div>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Email error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

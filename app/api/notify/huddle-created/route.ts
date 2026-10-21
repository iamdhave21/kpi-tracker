import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, ADMIN_ROLES } from '@/lib/staffAuth'
import { vetRecipients } from '@/lib/mailGuard'
import { esc } from '@/lib/serverMail'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const gate = await requireStaff(req)
    if ('error' in gate) return gate.error
    const { participants, title, huddleDate, agenda } = await req.json()
    const createdBy = gate.staff.email

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!participants?.length || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const list: string[] = (await vetRecipients(participants)).allowed
    if (list.length === 0) return NextResponse.json({ error: 'No valid portal recipients' }, { status: 400 })

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const dateText = new Date(huddleDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
    const timeText = new Date(huddleDate).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    })

    const results = await Promise.allSettled(
      list.map((email: string) =>
        transporter.sendMail({
          from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: `Huddle Notes: ${title} — ${dateText}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
                <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Team Huddle Notes</p>
              </div>
              <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px;">${esc(title)}</p>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Date</td>
                    <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${esc(dateText)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">Time</td>
                    <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${esc(timeText)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">Facilitated by</td>
                    <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${esc(createdBy.split('@')[0])}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">Participants</td>
                    <td style="padding: 10px; color: #111827; font-size: 13px;">${esc(list.map((e: string) => e.split('@')[0]).join(', '))}</td>
                  </tr>
                </table>
                ${agenda ? `
                <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                  <p style="color: #374151; font-size: 13px; font-weight: 600; margin: 0 0 8px;">Agenda / Notes</p>
                  <p style="color: #374151; font-size: 13px; margin: 0; white-space: pre-wrap;">${esc(agenda)}</p>
                </div>` : ''}
                <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">You are receiving this because you were listed as a participant. View full details in the AB BSS Operations Portal under Team Lead Tools → Operating Cadence → Team Huddle.</p>
              </div>
            </div>
          `,
        })
      )
    )

    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) {
      return NextResponse.json({ warning: `${failed} of ${list.length} emails failed` }, { status: 207 })
    }

    return NextResponse.json({ ok: true, sent: list.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

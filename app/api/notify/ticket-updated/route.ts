import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { ticketId, title, submitterEmail, updateType, updatedBy, detail } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!submitterEmail) {
      return NextResponse.json({ success: true, message: 'No submitter email' })
    }
    // Don't email people about their own updates
    if (submitterEmail === updatedBy) {
      return NextResponse.json({ success: true, message: 'Self-update, skipped' })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'

    const typeLabel: Record<string, string> = {
      comment: 'New Progress Note',
      status: 'Status Updated',
      edit: 'Ticket Details Updated',
    }
    const subjectLabel = typeLabel[updateType] || 'Ticket Updated'

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: submitterEmail,
      subject: `🎫 ${subjectLabel}: ${title}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #1e3a8a; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">🎫 ${subjectLabel}</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Your ticket has a new update</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 12px;">${title}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Updated by</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${(updatedBy || '').split('@')[0]}</td>
              </tr>
              ${detail ? `<tr><td style="padding: 10px; color: #6b7280; font-size: 13px;">Detail</td><td style="padding: 10px; color: #111827; font-size: 13px;">${detail}</td></tr>` : ''}
            </table>
            <a href="${appUrl}" style="display: inline-block; background: #1e3a8a; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">View Ticket →</a>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">This is an automated notification from the AB BSS Operations Portal.</p>
          </div>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

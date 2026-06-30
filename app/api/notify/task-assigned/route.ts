import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { assignedTo, assignedBy, title, description, dueDate } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!assignedTo || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const dueDateText = dueDate
      ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'No due date set'

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: assignedTo,
      subject: `New Task Assigned: ${title} — AB BSS Operations Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">New Task Assigned to You</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 8px;">${title}</p>
            ${description ? `<p style="color: #374151; font-size: 14px; margin: 0 0 16px;">${description}</p>` : ''}
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Assigned by</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${assignedBy}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #6b7280; font-size: 13px;">Due date</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${dueDateText}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Check Operations > Tasks in the portal to mark this done. This is an automated notification from the AB BSS Operations Portal.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Email error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

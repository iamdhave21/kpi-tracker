import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { employeeName, employeeEmail, changes, changedBy } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!employeeEmail) {
      return NextResponse.json({ error: 'No email on file for this employee record' }, { status: 400 })
    }
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ success: true, message: 'No changes to report' })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const rows = changes.map((c: { field: string, from: string, to: string }) => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 140px;">${c.field}</td>
        <td style="padding: 10px; color: #9ca3af; font-size: 13px; text-decoration: line-through;">${c.from || '—'}</td>
        <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${c.to || '—'}</td>
      </tr>`).join('')

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: employeeEmail,
      subject: 'Your Employee Record Has Been Updated — AB BSS Operations Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Employee Record Updated</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 15px;">Hi ${employeeName}, the following details on your employee record were updated:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="background: #f9fafb;">
                <td style="padding: 8px 10px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase;">Field</td>
                <td style="padding: 8px 10px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase;">Previous</td>
                <td style="padding: 8px 10px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase;">New</td>
              </tr>
              ${rows}
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Updated by ${changedBy}. If this doesn't look right, please contact your administrator. This is an automated notification from the AB BSS Operations Portal.</p>
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

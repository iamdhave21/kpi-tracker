import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { action, employeeName, employeeEmail, teamName, leadEmail } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!employeeEmail || !teamName || (action !== 'added' && action !== 'removed')) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const isAdded = action === 'added'
    const actionText = isAdded ? 'added to' : 'removed from'
    const headerColor = isAdded ? '#1e3a5f' : '#7c2d12'
    const accentColor = isAdded ? '#93c5fd' : '#fdba74'

    // Recipients: employee always. Team lead too, if they have an email
    // and aren't the same person as the employee.
    const recipients = new Set<string>([employeeEmail])
    if (leadEmail && leadEmail.toLowerCase() !== employeeEmail.toLowerCase()) {
      recipients.add(leadEmail)
    }

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: Array.from(recipients).join(', '),
      subject: `Team ${isAdded ? 'Assignment' : 'Update'}: ${employeeName} — AB BSS Operations Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: ${headerColor}; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
            <p style="color: ${accentColor}; margin: 4px 0 0; font-size: 13px;">Team ${isAdded ? 'Assignment' : 'Removal'}</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 15px;"><strong>${employeeName}</strong> has been ${actionText} the team:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Team</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${teamName}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">This is an automated notification from the AB BSS Operations Portal.</p>
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

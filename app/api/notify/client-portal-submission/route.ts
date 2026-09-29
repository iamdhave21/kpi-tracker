import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// Who gets notified: operations@ab-businesssupport.com by default (the
// portal's own account), overridable via CLIENT_PORTAL_NOTIFY_EMAIL if
// Dhave wants it routed elsewhere later.
export async function POST(req: NextRequest) {
  try {
    const { clientName, contactName, itemLabel, fileName, driveLink } = await req.json()
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    const to = process.env.CLIENT_PORTAL_NOTIFY_EMAIL || 'operations@ab-businesssupport.com'

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    await transporter.sendMail({
      from: `"AB BSS Client Portal" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Client Portal: ${clientName} submitted "${itemLabel}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">Client Portal Update</h2>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="font-size: 14px; color: #111827;"><strong>${contactName}</strong> at <strong>${clientName}</strong> just submitted an item on their onboarding checklist.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px;">
              <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">Item</td><td style="padding: 6px 0; color: #111827; font-weight: 600;">${itemLabel}</td></tr>
              ${fileName ? `<tr><td style="padding: 6px 0; color: #6b7280;">File</td><td style="padding: 6px 0; color: #111827;">${fileName}</td></tr>` : ''}
              ${driveLink ? `<tr><td style="padding: 6px 0; color: #6b7280;">Link</td><td style="padding: 6px 0; color: #111827;"><a href="${driveLink}">${driveLink}</a></td></tr>` : ''}
            </table>
            <p style="font-size: 13px; color: #6b7280;">Open the Client Portal management screen in the Ops Portal to review it.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Client portal submission notify error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

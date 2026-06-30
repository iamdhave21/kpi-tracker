import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Manager',
  team_lead: 'Team Lead',
  viewer: 'Agent',
}

export async function POST(req: NextRequest) {
  try {
    const { username, oldRole, newRole, changedBy } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const oldLabel = ROLE_LABELS[oldRole] || oldRole
    const newLabel = ROLE_LABELS[newRole] || newRole

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: username,
      subject: 'Your Account Role Has Been Updated — AB BSS Operations Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Account Role Updated</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 15px;">Your account role on the Operations Portal has changed:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Previous role</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${oldLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; color: #6b7280; font-size: 13px;">New role</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${newLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #6b7280; font-size: 13px;">Changed by</td>
                <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${changedBy}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">If you weren't expecting this change, please contact your administrator. This is an automated notification from the AB BSS Operations Portal.</p>
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

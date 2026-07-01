import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { username, tempPassword, resetBy } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }

    if (!username || !tempPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: username,
      subject: '🔑 Your AB BSS Portal Password Has Been Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Password Reset Notification</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #111827; font-size: 15px; margin: 0 0 16px;">Hi <strong>${username.split('@')[0]}</strong>,</p>
            <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Your portal password has been reset by <strong>${(resetBy||'admin').split('@')[0]}</strong>. Use the temporary password below to log in.</p>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Temporary Password</p>
              <p style="color: #111827; font-size: 22px; font-weight: 700; font-family: monospace; margin: 0; letter-spacing: 0.1em;">${tempPassword}</p>
            </div>
            <p style="color: #ef4444; font-size: 13px; margin: 0 0 16px;">⚠️ You will be required to set a new password immediately after logging in.</p>
            <a href="${appUrl}" style="display: inline-block; background: #1e3a8a; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Log In Now →</a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">If you did not expect this reset, please contact your administrator immediately.</p>
          </div>
        </div>
      `
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

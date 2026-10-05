import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// Sent once, right when a Staff member adds a new Client Contact. Unlike
// request-link, this doesn't include a login token itself -- it just
// points them at the Client Portal so they can request their own
// sign-in link when they're ready, keeping the welcome email useful even
// if it sits unread for a few days (a token would go stale).
export async function POST(req: NextRequest) {
  try {
    const { to, name, client } = await req.json()
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!to || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    await transporter.sendMail({
      from: `"AB BSS Client Portal" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Welcome to the AB BSS Client Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB Business Support Services</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Client Portal</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="font-size: 14px; color: #111827;">Hi ${name},</p>
            <p style="font-size: 14px; color: #374151;">Welcome! You've been set up with access to the AB BSS Client Portal for <strong>${client}</strong>. From there you can track your onboarding checklist, send us requests and messages, upload documents, and see progress in real time -- no password needed.</p>
            <a href="${baseUrl}/client-portal" style="display: inline-block; background: #1e3a5f; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 16px 0;">Open Client Portal</a>
            <p style="font-size: 13px; color: #374151;">Enter your email there any time and we'll send you a secure sign-in link.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Client portal welcome email error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

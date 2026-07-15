import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.error('Forgot password: GMAIL_USER/GMAIL_PASS not configured')
      return NextResponse.json({ error: 'Email sending is not configured. Contact your admin.' }, { status: 500 })
    }

    const supabase = getSupabase()
    const emailLower = email.trim().toLowerCase()

    // Check user exists
    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, display_name')
      .eq('email', emailLower)
      .single()

    // Always return success (don't reveal if email exists)
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Invalidate old tokens for this email
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('email', emailLower)
      .eq('used', false)

    // Store new token
    await supabase.from('password_reset_tokens').insert({
      email: emailLower,
      token: resetToken,
      expires_at: expiresAt.toISOString(),
    })

    // Send email via Gmail (same transport used for every other email in the app)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'
    const resetLink = `${appUrl}?reset=${resetToken}`

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to: emailLower,
      subject: 'Reset your AB BSS Portal password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <img src="${appUrl}/ab-logo.png" alt="AB BSS" style="height:40px;margin-bottom:24px;" />
          <h2 style="color:#1e3a5f;margin-bottom:8px;">Reset your password</h2>
          <p style="color:#6b7280;margin-bottom:24px;">
            Hi ${user.display_name || emailLower},<br/><br/>
            We received a request to reset your AB BSS Operations Portal password.
            Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
          </p>
          <a href="${resetLink}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:24px;">
            Reset Password
          </a>
          <p style="color:#9ca3af;font-size:13px;">
            If you didn't request this, you can safely ignore this email.<br/>
            This link will expire in 1 hour.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AB Business Support Services · ab-businesssupport.com</p>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 })
  }
}

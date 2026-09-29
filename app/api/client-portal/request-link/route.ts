import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getServiceSupabase, generateToken, TOKEN_HOURS } from '@/lib/clientPortalAuth'

// Always returns a generic success message, whether or not the email
// matches a real, active client_contacts row -- this prevents an outside
// party from using this endpoint to discover which emails are (or
// aren't) registered clients of AB BSS.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }
    const input = email.trim().toLowerCase()
    const supabase = getServiceSupabase()

    const { data: contact } = await supabase
      .from('client_contacts')
      .select('id, name, email, active')
      .ilike('email', input)
      .eq('active', true)
      .single()

    if (contact && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      const token = generateToken()
      const expiresAt = new Date(Date.now() + TOKEN_HOURS * 60 * 60 * 1000)
      await supabase.from('client_login_tokens').insert({
        contact_id: contact.id, token, expires_at: expiresAt.toISOString(),
      })

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'
      const link = `${baseUrl}/client-portal?token=${token}`

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
      })
      await transporter.sendMail({
        from: `"AB BSS Client Portal" <${process.env.GMAIL_USER}>`,
        to: contact.email,
        subject: 'Your AB BSS Client Portal sign-in link',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 18px;">AB Business Support Services</h2>
              <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Client Portal</p>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; color: #111827;">Hi ${contact.name},</p>
              <p style="font-size: 14px; color: #374151;">Click below to sign in to your onboarding checklist. This link is valid for ${TOKEN_HOURS} hours and can only be used once.</p>
              <a href="${link}" style="display: inline-block; background: #1e3a5f; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 16px 0;">Sign in to Client Portal</a>
              <p style="font-size: 12px; color: #9ca3af;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true, message: 'If that email is registered, a sign-in link has been sent.' })
  } catch (err: unknown) {
    console.error('Client portal request-link error:', err)
    return NextResponse.json({ success: true, message: 'If that email is registered, a sign-in link has been sent.' })
  }
}

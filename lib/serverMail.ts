import nodemailer from 'nodemailer'

// Server-only email. Called directly from API routes -- NOT through a public
// /api/notify endpoint -- so nobody outside the app can use it to send mail.
export const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'
export const FALLBACK_ALERT_EMAIL = process.env.CLIENT_PORTAL_NOTIFY_EMAIL || 'operations@ab-businesssupport.com'

export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function emailShell(heading: string, bodyHtml: string, button?: { label: string, url: string }) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
    <div style="background: #1e3a5f; padding: 22px; border-radius: 12px 12px 0 0;">
      <h2 style="color: white; margin: 0; font-size: 17px;">${esc(heading)}</h2>
      <p style="color: #93c5fd; margin: 4px 0 0; font-size: 12px;">AB Business Support Services</p>
    </div>
    <div style="background: white; padding: 22px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; font-size: 14px; color: #374151;">
      ${bodyHtml}
      ${button ? `<a href="${esc(button.url)}" style="display:inline-block;background:#1e3a5f;color:white;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;margin-top:14px;">${esc(button.label)}</a>` : ''}
    </div>
  </div>`
}

export async function sendMail(to: string[], subject: string, html: string): Promise<boolean> {
  const recipients = Array.from(new Set(to.map(t => t.trim()).filter(Boolean)))
  if (recipients.length === 0 || !process.env.GMAIL_USER || !process.env.GMAIL_PASS) return false
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } })
    await transporter.sendMail({ from: `"AB BSS Client Portal" <${process.env.GMAIL_USER}>`, to: recipients.join(','), subject, html })
    return true
  } catch (err) {
    console.error('sendMail failed:', err)
    return false   // an email failure must never fail the request itself
  }
}

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { to, cc, record } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }
    if (!to || !record) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    })

    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
    const levelColor: Record<string, string> = {
      'Verbal Warning': '#d97706',
      'Written Warning': '#ea580c',
      'Final Written Warning': '#dc2626',
      'Dismissal': '#1f2937',
    }

    await transporter.sendMail({
      from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
      to,
      cc: cc || undefined,
      subject: `Notice to Explain — ${record.warning_level} — AB BSS Operations Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">AB Business Support Services</h2>
            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Notice to Explain</p>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <div style="display: inline-block; background: ${levelColor[record.warning_level] || '#374151'}; color: white; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 999px; margin-bottom: 16px;">${(record.warning_level || '').toUpperCase()}</div>

            <table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px;">
              <tr><td style="padding: 6px 0; color: #6b7280; width: 160px;">Employee Name</td><td style="padding: 6px 0; color: #111827; font-weight: 600;">${record.employee_name || ''}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Employee ID</td><td style="padding: 6px 0; color: #111827;">${record.employee_code || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Position</td><td style="padding: 6px 0; color: #111827;">${record.position || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Department</td><td style="padding: 6px 0; color: #111827;">${record.department || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Client/Account</td><td style="padding: 6px 0; color: #111827;">${record.client || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Immediate Supervisor</td><td style="padding: 6px 0; color: #111827;">${record.immediate_supervisor || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Date Issued</td><td style="padding: 6px 0; color: #111827;">${fmtDate(record.date_issued)}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Date of Incident</td><td style="padding: 6px 0; color: #111827;">${fmtDate(record.date_of_incident)}</td></tr>
            </table>

            <p style="font-weight: 700; font-size: 13px; color: #111827; margin: 20px 0 6px;">STATEMENT OF THE INCIDENT / GROUNDS FOR NOTICE</p>
            <p style="font-size: 13px; color: #374151; margin: 0 0 10px;">This is to formally notify you that the Company is considering disciplinary action against you in connection with the incident/violation described below. You are hereby directed to submit a written explanation within forty-eight (48) hours from receipt of this notice as to why no disciplinary action should be imposed against you.</p>
            <p style="font-size: 13px; color: #111827; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; white-space: pre-wrap;">${record.incident_statement || ''}</p>

            <p style="font-weight: 700; font-size: 13px; color: #111827; margin: 20px 0 6px;">COMPANY POLICY / CODE OF CONDUCT VIOLATED</p>
            <p style="font-size: 13px; color: #111827; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; white-space: pre-wrap;">${record.policy_violated || ''}</p>

            <p style="color: #6b7280; font-size: 12px; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 12px;">Please report to your immediate supervisor to review, discuss, and sign the physical copy of this notice. Your written explanation and action plan should be submitted within 48 hours of receipt. This is an automated notification from the AB BSS Operations Portal.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('NTE email error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

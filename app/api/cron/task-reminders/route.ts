import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Runs once daily via Vercel Cron (see vercel.json).
// Sends a "due today" reminder the morning a task is due, and a daily
// "overdue" reminder every day after that until the task is marked done.
export async function GET(req: NextRequest) {
  // Vercel signs cron requests with this header -- reject anything else
  // hitting this route directly so it can't be triggered by anyone else.
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const supabase = getSupabase()
  const todayStr = new Date().toISOString().slice(0, 10)

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_done', false)
    .not('due_date', 'is', null)
    .lte('due_date', todayStr)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: 'Nothing due today or overdue' })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })

  let sent = 0
  for (const task of tasks) {
    const isOverdue = task.due_date < todayStr
    const subject = isOverdue
      ? `⚠ Overdue Task: ${task.title} — AB BSS Operations Portal`
      : `Reminder: Task due today — ${task.title}`

    try {
      await transporter.sendMail({
        from: `"AB BSS Operations Portal" <${process.env.GMAIL_USER}>`,
        to: task.assigned_to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: ${isOverdue ? '#7c2d12' : '#1e3a5f'}; padding: 24px; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 18px;">AB BSS Operations Portal</h2>
              <p style="color: ${isOverdue ? '#fdba74' : '#93c5fd'}; margin: 4px 0 0; font-size: 13px;">${isOverdue ? 'Task is overdue' : 'Task is due today'}</p>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 8px;">${task.title}</p>
              ${task.description ? `<p style="color: #374151; font-size: 14px; margin: 0 0 16px;">${task.description}</p>` : ''}
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px; color: #6b7280; font-size: 13px; width: 120px;">Assigned by</td>
                  <td style="padding: 10px; color: #111827; font-size: 13px; font-weight: 600;">${task.assigned_by}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; color: #6b7280; font-size: 13px;">Due date</td>
                  <td style="padding: 10px; color: ${isOverdue ? '#dc2626' : '#111827'}; font-size: 13px; font-weight: 600;">${new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${isOverdue ? ' (overdue)' : ''}</td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">${isOverdue ? "This will keep reminding you daily until it's marked done." : ''} Check Operations > Tasks in the portal to mark this done.</p>
            </div>
          </div>
        `,
      })
      sent++
    } catch (err) {
      console.error(`Failed to send reminder for task ${task.id}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent, total: tasks.length })
}

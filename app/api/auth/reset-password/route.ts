import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json()
    if (!token || !newPassword) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const supabase = getSupabase()

    // Validate token
    const { data: resetRecord } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (!resetRecord) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    if (new Date(resetRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 })
    }

    // Hash new password before storing
    const hash = await bcrypt.hash(newPassword, 12)

    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq('email', resetRecord.email)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mark token as used
    await supabase.from('password_reset_tokens').update({ used: true }).eq('token', token)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}

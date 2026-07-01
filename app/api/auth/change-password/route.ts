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
    const { username, oldPassword, newPassword, adminReset } = await req.json()
    if (!username || !newPassword) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const supabase = getSupabase()

    if (!adminReset) {
      const { data: user } = await supabase.from('app_users').select('password_hash').eq('username', username).single()
      if (!user) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

      const stored = user.password_hash as string
      let valid = false
      if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
        valid = await bcrypt.compare(oldPassword, stored)
      } else {
        valid = stored === oldPassword
      }
      if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    const { error } = await supabase.from('app_users').update({
      password_hash: hash,
      must_change_password: false,
      updated_at: new Date().toISOString()
    }).eq('username', username)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}

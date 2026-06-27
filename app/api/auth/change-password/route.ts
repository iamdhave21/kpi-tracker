import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { username, oldPassword, newPassword, adminReset } = await req.json()
    if (!username || !newPassword) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    if (!adminReset) {
      const { data: user } = await supabase.from('app_users').select('password_hash').eq('username', username).single()
      if (!user || user.password_hash !== oldPassword) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const { error } = await supabase.from('app_users').update({ password_hash: newPassword, updated_at: new Date().toISOString() }).eq('username', username)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}

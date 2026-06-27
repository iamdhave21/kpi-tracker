import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { username, password, role } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const { error } = await supabase.from('app_users').insert({ username: username.trim(), password_hash: password, role: role || 'viewer', active: true })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
      throw error
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 })
  }
}

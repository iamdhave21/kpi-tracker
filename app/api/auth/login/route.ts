import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 })

    const { data: user, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username.trim())
      .eq('active', true)
      .single()

    if (error || !user) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    if (user.password_hash !== password) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })

    return NextResponse.json({ user: { username: user.username, role: user.role } })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

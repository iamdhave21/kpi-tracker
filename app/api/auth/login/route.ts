import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_DOMAIN = '@ab-businesssupport.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

    const input = username.trim().toLowerCase()
    const supabase = getSupabase()
    let user = null

    if (input.includes('@')) {
      // Email login - validate domain
      if (!input.endsWith(ALLOWED_DOMAIN)) {
        return NextResponse.json({ error: `Only ${ALLOWED_DOMAIN} emails are allowed` }, { status: 401 })
      }
      // Try by email column first
      const { data: byEmail } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', input)
        .eq('active', true)
        .single()
      if (byEmail) {
        user = byEmail
      } else {
        // Fallback: try username = part before @
        const usernamePrefix = input.split('@')[0]
        const { data: byPrefix } = await supabase
          .from('app_users')
          .select('*')
          .eq('username', usernamePrefix)
          .eq('active', true)
          .single()
        if (byPrefix) user = byPrefix
      }
    } else {
      // Plain username login (legacy)
      const { data: byUsername } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', input)
        .eq('active', true)
        .single()
      if (byUsername) user = byUsername
    }

    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    if (user.password_hash !== password) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    return NextResponse.json({ user: { username: user.email || user.username, role: user.role, display_name: user.display_name || user.username, mustChangePassword: !!user.must_change_password } })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

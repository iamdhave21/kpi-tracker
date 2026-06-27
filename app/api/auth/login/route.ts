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

    const email = username.trim().toLowerCase()

    // Validate domain
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.json({ error: `Only ${ALLOWED_DOMAIN} emails are allowed` }, { status: 401 })
    }

    const supabase = getSupabase()

    // Try login by email first, fallback to username for legacy accounts
    let user = null
    const { data: byEmail } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .eq('active', true)
      .single()

    if (byEmail) {
      user = byEmail
    } else {
      // Legacy: try by username (email prefix before @)
      const usernameOnly = email.split('@')[0]
      const { data: byUsername } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', usernameOnly)
        .eq('active', true)
        .single()
      if (byUsername) user = byUsername
    }

    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    if (user.password_hash !== password) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    // Store email in user session
    return NextResponse.json({ user: { username: user.email || user.username, role: user.role } })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

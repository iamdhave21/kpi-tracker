import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

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
      if (!input.endsWith(ALLOWED_DOMAIN)) {
        return NextResponse.json({ error: `Only ${ALLOWED_DOMAIN} emails are allowed` }, { status: 401 })
      }
      const { data: byEmail } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', input)
        .eq('active', true)
        .single()
      if (byEmail) {
        user = byEmail
      } else {
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
      const { data: byUsername } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', input)
        .eq('active', true)
        .single()
      if (byUsername) user = byUsername
    }

    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    // Support both bcrypt hashes and plain-text (legacy) during migration window
    const stored = user.password_hash as string
    let passwordValid = false
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
      // bcrypt hash — use proper comparison
      passwordValid = await bcrypt.compare(password, stored)
    } else {
      // plain-text legacy — compare directly, then upgrade to bcrypt
      passwordValid = stored === password
      if (passwordValid) {
        // Auto-upgrade to bcrypt on successful login
        const hash = await bcrypt.hash(password, 12)
        await supabase.from('app_users').update({ password_hash: hash }).eq('id', user.id)
      }
    }

    if (!passwordValid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    return NextResponse.json({ user: { username: user.email || user.username, role: user.role, display_name: user.display_name || user.username, mustChangePassword: !!user.must_change_password } })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

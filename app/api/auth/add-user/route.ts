import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'



const ALLOWED_DOMAINS = ['ab-businesssupport.com', 'ab-contactsolutions.com']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, role } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const email = username.trim().toLowerCase()
    const domain = ALLOWED_DOMAINS.find(d => email.endsWith(`@${d}`))
    if (!domain) {
      return NextResponse.json({ error: 'Only AB Business Support work emails are allowed' }, { status: 400 })
    }

    const usernameOnly = email.split('@')[0]
    const supabase = getSupabase()

    // ab-businesssupport.com and ab-contactsolutions.com are the same
    // Workspace (alias domains) -- someone could unknowingly create a
    // second account for a person who already has one under the other
    // domain. Catch that before it becomes two rows for one employee.
    const altDomain = ALLOWED_DOMAINS.find(d => d !== domain)
    const { data: altMatch } = await supabase
      .from('app_users')
      .select('email')
      .ilike('email', `${usernameOnly}@${altDomain}`)
      .maybeSingle()
    if (altMatch) {
      return NextResponse.json({ error: `An account already exists for this person as ${altMatch.email} (same person, different domain alias). Edit that account instead of creating a new one.` }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 12)
    const { error } = await supabase.from('app_users').insert({
      username: usernameOnly,
      email: email,
      password_hash: hash,
      role: role || 'viewer',
      active: true,
      must_change_password: true,
    })

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add user' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_DOMAIN = '@ab-businesssupport.com'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Gate for Google Sign-In: Supabase Auth having a valid Google session only
// proves the person is who Google says they are. It does NOT mean they
// should have access to this portal -- that decision still lives entirely
// in app_users, same as password login. An admin must have already created
// their row (and left it active) or this rejects them, per design.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const input = email.trim().toLowerCase()
    if (!input.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.json({ error: `Only ${ALLOWED_DOMAIN} emails are allowed` }, { status: 401 })
    }

    const supabase = getSupabase()
    const { data: user } = await supabase
      .from('app_users')
      .select('*')
      .ilike('email', input)
      .eq('active', true)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'No active account found for this email. Contact your admin to get access.' }, { status: 403 })
    }

    return NextResponse.json({
      user: {
        username: user.email || user.username,
        role: user.role,
        display_name: user.display_name || user.username,
        mustChangePassword: !!user.must_change_password,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}

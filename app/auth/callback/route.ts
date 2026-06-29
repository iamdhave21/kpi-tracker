import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_DOMAINS = ['@ab-businesssupport.com', '@ab-contactsolutions.com']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  // Exchange code for session using the anon client
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code)

  if (error || !data.session?.user?.email) {
    return NextResponse.redirect(`${origin}/?error=oauth_failed`)
  }

  const email = data.session.user.email.toLowerCase()

  // Domain restriction
  const allowed = ALLOWED_DOMAINS.some(d => email.endsWith(d))
  if (!allowed) {
    await supabaseClient.auth.signOut()
    return NextResponse.redirect(`${origin}/?error=domain_not_allowed`)
  }

  // Ensure user exists in app_users (auto-provision if first login)
  const adminClient = getSupabase()
  const { data: appUser } = await adminClient
    .from('app_users')
    .select('*')
    .eq('email', email)
    .single()

  if (!appUser) {
    await adminClient.from('app_users').insert({
      email,
      name: email.split('@')[0],
      username: email.split('@')[0],
      role: 'viewer',
      password_hash: 'google-oauth',
      active: true,
    })
  }

  // Redirect back to app — client will pick up session via getSession()
  return NextResponse.redirect(`${origin}/`)
}

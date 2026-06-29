import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_DOMAINS = ['@ab-businesssupport.com', '@ab-contactsolutions.com']

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors from Google/Supabase
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/?error=oauth_failed`)
  }

  if (!code) {
    // Check for hash fragment — some flows use implicit grant
    // Redirect to home and let client handle the session from hash
    return NextResponse.redirect(`${origin}/`)
  }

  try {
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'pkce',
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        }
      }
    )

    const { data, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code)

    if (exchangeError || !data.session?.user?.email) {
      console.error('Exchange error:', exchangeError)
      return NextResponse.redirect(`${origin}/?error=oauth_failed`)
    }

    const email = data.session.user.email.toLowerCase()

    // Domain restriction
    const allowed = ALLOWED_DOMAINS.some(d => email.endsWith(d))
    if (!allowed) {
      return NextResponse.redirect(`${origin}/?error=domain_not_allowed`)
    }

    // Ensure user exists in app_users
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: appUser } = await adminClient
      .from('app_users')
      .select('*')
      .eq('email', email)
      .single()

    if (!appUser) {
      await adminClient.from('app_users').insert({
        email,
        username: email.split('@')[0],
        role: 'viewer',
        password_hash: 'google-oauth',
        active: true,
      })
    }

    // Set session cookies and redirect
    const response = NextResponse.redirect(`${origin}/`)
    
    // Store session tokens in cookies so the client can pick them up
    const maxAge = data.session.expires_in || 3600
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge,
      path: '/',
    })
    response.cookies.set('sb-refresh-token', data.session.refresh_token || '', {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response

  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.redirect(`${origin}/?error=oauth_failed`)
  }
}

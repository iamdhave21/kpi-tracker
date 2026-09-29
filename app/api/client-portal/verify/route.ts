import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, generateToken, SESSION_COOKIE, SESSION_HOURS } from '@/lib/clientPortalAuth'

// Single-use: the token is marked used_at the moment it's redeemed, so a
// forwarded/leaked link stops working after the first click, not just
// after it expires.
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }
    const supabase = getServiceSupabase()

    const { data: tokenRow } = await supabase
      .from('client_login_tokens')
      .select('id, contact_id, expires_at, used_at')
      .eq('token', token)
      .single()

    if (!tokenRow) return NextResponse.json({ error: 'This link is invalid.' }, { status: 401 })
    if (tokenRow.used_at) return NextResponse.json({ error: 'This link has already been used. Please request a new one.' }, { status: 401 })
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'This link has expired. Please request a new one.' }, { status: 401 })

    const { data: contact } = await supabase
      .from('client_contacts')
      .select('id, name, email, client, active')
      .eq('id', tokenRow.contact_id)
      .single()
    if (!contact || !contact.active) return NextResponse.json({ error: 'This account is no longer active.' }, { status: 401 })

    await supabase.from('client_login_tokens').update({ used_at: new Date().toISOString() }).eq('id', tokenRow.id)

    const sessionToken = generateToken()
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000)
    await supabase.from('client_sessions').insert({
      contact_id: contact.id, session_token: sessionToken, expires_at: expiresAt.toISOString(),
    })

    const res = NextResponse.json({ success: true, name: contact.name, client: contact.client })
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_HOURS * 60 * 60,
    })
    return res
  } catch (err: unknown) {
    console.error('Client portal verify error:', err)
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })
  }
}

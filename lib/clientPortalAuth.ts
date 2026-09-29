import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// Server-side only. Every Client Portal API route imports this to
// authorize the caller -- the client's browser never talks to Supabase
// directly with the anon key, so this is the ONLY place that decides
// "does this session belong to this client." Uses the service role key,
// which bypasses RLS entirely by design (same pattern as the rest of
// this app's server routes, e.g. google-verify) -- the actual security
// boundary is this check, not a Postgres policy.
export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const SESSION_COOKIE = 'client_portal_session'
export const SESSION_HOURS = 24
export const TOKEN_HOURS = 24

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

// Verifies a session token against client_sessions (not expired) and
// returns the contact it belongs to, or null. Callers MUST treat null as
// "reject the request" -- never fall back to trusting a client-supplied
// contact_id/client value instead.
export async function verifySession(sessionToken: string | undefined): Promise<{ id: string, name: string, email: string, client: string } | null> {
  if (!sessionToken) return null
  const supabase = getServiceSupabase()
  const { data: session } = await supabase
    .from('client_sessions')
    .select('contact_id, expires_at')
    .eq('session_token', sessionToken)
    .single()
  if (!session) return null
  if (new Date(session.expires_at).getTime() < Date.now()) return null
  const { data: contact } = await supabase
    .from('client_contacts')
    .select('id, name, email, client, active')
    .eq('id', session.contact_id)
    .single()
  if (!contact || !contact.active) return null
  return { id: contact.id, name: contact.name, email: contact.email, client: contact.client }
}

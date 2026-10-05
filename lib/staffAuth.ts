import { NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/clientPortalAuth'

// Server-side identity check for staff, using the REAL Google sign-in the
// browser already holds (Supabase Auth). The browser sends its access token as
// "Authorization: Bearer <token>"; Supabase Auth itself validates the token, so
// a typed-in or guessed email proves nothing. The verified email is then
// matched to an active app_users row (and employees row for client scoping).
//
// Same rules as google-verify: only the two company domains, and the same
// person may appear under either domain, so the match is on the part before
// the @. Anyone without a live Google session (e.g. an admin on the password
// fallback) gets null here and is asked to sign in with Google.

const ALLOWED_DOMAINS = ['ab-businesssupport.com', 'ab-contactsolutions.com']
const likeEsc = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export type Staff = { email: string, role: string, name: string, clients: string[] }

export async function verifyStaff(req: NextRequest): Promise<Staff | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.auth.getUser(token)
  const email = data?.user?.email?.toLowerCase()
  if (error || !email) return null
  const [local, domain] = email.split('@')
  if (!ALLOWED_DOMAINS.includes(domain)) return null

  const { data: users } = await supabase.from('app_users').select('email, username, role, active, display_name')
    .ilike('email', `${likeEsc(local)}@%`).eq('active', true)
  const user = (users || []).find((u: any) => (u.email || '').toLowerCase().split('@')[0] === local)
  if (!user) return null

  const { data: emps } = await supabase.from('employees').select('name, email, client, clients_supported, active')
    .ilike('email', `${likeEsc(local)}@%`)
  const emp = (emps || []).find((e: any) => (e.email || '').toLowerCase().split('@')[0] === local && e.active)
  const clients: string[] = emp ? (emp.clients_supported?.length ? emp.clients_supported : (emp.client ? [emp.client] : [])) : []

  return { email: (user.email || email).toLowerCase(), role: user.role, name: emp?.name || user.display_name || user.username || email, clients }
}

import { getServiceSupabase } from '@/lib/clientPortalAuth'
import { normalizeEmails, isCompanyEmail, splitRecipients } from '@/lib/mailRules'

// Server-only. Decides which of the requested recipients may actually be
// emailed. Company addresses always pass; anything else must already exist on
// an app_users or employees row, so these routes cannot be used to mail
// strangers.
export async function vetRecipients(input: unknown): Promise<{ allowed: string[], blocked: string[] }> {
  const all = normalizeEmails(input)
  const known = new Set<string>()
  if (all.some(e => !isCompanyEmail(e))) {
    const supabase = getServiceSupabase()
    const [u, e] = await Promise.all([
      supabase.from('app_users').select('email').limit(1000),
      supabase.from('employees').select('email').limit(1000),
    ])
    for (const r of [...(u.data || []), ...(e.data || [])]) if ((r as any).email) known.add(String((r as any).email).toLowerCase())
  }
  const res = splitRecipients(all, known)
  if (res.blocked.length) console.warn('notify: blocked non-portal recipients', res.blocked.length)
  return res
}

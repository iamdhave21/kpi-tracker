// Pure rules for who the portal's own notification emails may be sent to.
// Standalone on purpose (no imports) so the unit test can load it directly.
//
// Why this exists: the /api/notify/* routes used to mail whatever address and
// text the caller supplied, which made them a free mail relay (phishing risk).
// Now (1) the caller must be verified staff, and (2) every recipient must be a
// company address or an address that already exists on a portal user/employee.

export const COMPANY_DOMAINS = ['ab-businesssupport.com', 'ab-contactsolutions.com']
export const MAX_RECIPIENTS = 50

const EMAIL_RE = /^[^\s@,;<>"'()\[\]\\]+@[^\s@,;<>"'()\[\]\\]+\.[^\s@,;<>"'()\[\]\\]+$/

export function isValidEmail(s: unknown): s is string {
  return typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s.trim())
}

export function isCompanyEmail(s: unknown): boolean {
  if (!isValidEmail(s)) return false
  return COMPANY_DOMAINS.includes(s.trim().toLowerCase().split('@')[1])
}

// Accepts an array, or a comma/semicolon separated string, and returns the
// distinct, trimmed, lower-cased, syntactically valid addresses (capped).
export function normalizeEmails(input: unknown): string[] {
  const raw: unknown[] = Array.isArray(input) ? input
    : typeof input === 'string' ? input.split(/[;,]/) : []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!isValidEmail(r)) continue
    seen.add((r as string).trim().toLowerCase())
    if (seen.size >= MAX_RECIPIENTS) break
  }
  return Array.from(seen)
}

// `known` = lower-cased addresses that already exist on app_users/employees.
export function splitRecipients(input: unknown, known: Set<string>): { allowed: string[], blocked: string[] } {
  const all = normalizeEmails(input)
  const allowed: string[] = [], blocked: string[] = []
  for (const e of all) (isCompanyEmail(e) || known.has(e) ? allowed : blocked).push(e)
  return { allowed, blocked }
}

// Only http(s) links may be placed in an email href (blocks javascript: etc).
export function safeHttpUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null
  const t = u.trim()
  return /^https?:\/\/[^\s"'<>]+$/i.test(t) ? t : null
}

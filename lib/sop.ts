// Pure rules for the SOP and LWI Repository (no React, no database), kept
// separate so the access, approval and acknowledgment logic can be tested.
//
//   Author:   admin, super_admin, Team Lead
//   Approver: someone an author named on that version (must be admin / super_admin / Team Lead)
//   Receiver: everyone ('all') or a chosen list ('selected'); each must acknowledge
//             every NEW version, so a new version always needs re-acknowledgment.
//   Visibility: managers (author/admin/approver) see drafts and history;
//               everyone else sees only the current approved version of documents
//               they are a receiver of.

// Local copy of daysUntil from lib/toolsRepo.ts (kept identical on purpose:
// parse YYYY-MM-DD as a LOCAL date, never UTC, or the Philippines is off by a
// day). Inlined so this file has no imports and runs under plain Node tests.
function daysUntil(ymd: string, now: Date = new Date()): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export const SOP_TYPES = ['SOP', 'LWI'] as const
export const SOP_DEPARTMENTS = ['Operations', 'Payroll', 'Recruitment', 'Client Management', 'IT', 'Company-wide']
export const CARD_TYPES = ['text', 'link', 'file'] as const
export type CardType = typeof CARD_TYPES[number]

export type Attachment = { name: string, path: string, size: number }
export type Card = { id: string, type: CardType, title: string, body: string, url: string, attachments: Attachment[] }

const lc = (s: string | null | undefined) => (s || '').trim().toLowerCase()
// Same person on either company domain (they are aliases of one Workspace).
export function sameStaff(a: string | null | undefined, b: string | null | undefined): boolean {
  const la = lc(a).split('@')[0], lb = lc(b).split('@')[0]
  return la !== '' && la === lb
}

export const isAdminRole = (role: string) => role === 'admin' || role === 'super_admin'
export const canAuthor = (role: string) => isAdminRole(role) || role === 'Team Lead'
export const canBeApprover = (role: string) => isAdminRole(role) || role === 'Team Lead'

// Maintain a document (edit, record a change, add approval proof, publish):
// any admin, the person who created it, or a Team Lead who supports the
// document's client (live documentation is kept up by the people running the
// account). A Team Lead with no matching client may not. Retiring is stricter:
// see canRetireDoc.
export function canManageDoc(doc: { created_by: string, client?: string | null }, role: string, meEmail: string, myClients: string[] = []): boolean {
  if (isAdminRole(role)) return true
  if (!canAuthor(role)) return false
  if (sameStaff(doc.created_by, meEmail)) return true
  const c = lc(doc.client)
  return role === 'Team Lead' && c !== '' && myClients.map(lc).includes(c)
}
// Only an admin or the creator may retire a document.
export const canRetireDoc = (doc: { created_by: string }, role: string, meEmail: string) =>
  isAdminRole(role) || (canAuthor(role) && sameStaff(doc.created_by, meEmail))

export type VisibilityCtx = { role: string, email: string, clients?: string[], isApprover: boolean, isReceiver: boolean, hasCurrentVersion: boolean }
// Can this person open the document at all?
export function canSeeDoc(doc: { created_by: string, status: string, client?: string | null }, c: VisibilityCtx): boolean {
  if (canManageDoc(doc, c.role, c.email, c.clients || [])) return true
  if (c.isApprover) return true
  if (doc.status === 'retired') return false
  return c.hasCurrentVersion && c.isReceiver
}
// May this person see a non-current version (drafts, history)?
export const canSeeAllVersions = (doc: { created_by: string, client?: string | null }, c: Pick<VisibilityCtx, 'role' | 'email' | 'isApprover' | 'clients'>) =>
  canManageDoc(doc, c.role, c.email, c.clients || []) || c.isApprover

// Is this person one of the people who must acknowledge?
export function isReceiver(mode: string, selectedEmails: string[], me: string): boolean {
  if (!lc(me)) return false
  if (mode === 'all') return true
  return selectedEmails.some(e => sameStaff(e, me))
}

export type AckStats = { expected: number, acked: number, pending: string[] }
// 'all' = every active employee; 'selected' = the chosen list.
export function ackStats(mode: string, activeEmails: string[], selectedEmails: string[], ackedEmails: string[]): AckStats {
  const pool = mode === 'all' ? activeEmails : selectedEmails
  const seen = new Set<string>()
  const unique = pool.filter(e => { const k = lc(e).split('@')[0]; if (!k || seen.has(k)) return false; seen.add(k); return true })
  const pending = unique.filter(e => !ackedEmails.some(a => sameStaff(a, e)))
  return { expected: unique.length, acked: unique.length - pending.length, pending }
}

export type Decision = 'pending' | 'approved' | 'declined'
// "Approved" only when EVERY approver approved; any decline declines it.
export function approvalOutcome(decisions: Decision[]): Decision {
  if (decisions.length === 0) return 'pending'
  if (decisions.some(d => d === 'declined')) return 'declined'
  return decisions.every(d => d === 'approved') ? 'approved' : 'pending'
}

// Approvers must hold an approving role; the author may not approve their own
// version unless they are an admin.
export function approverProblem(approvers: { email: string, role: string }[], authorEmail: string, authorRole: string): string | null {
  if (approvers.length === 0) return 'Choose at least one approver.'
  for (const a of approvers) {
    if (!canBeApprover(a.role)) return `${a.email} is not an Admin or Team Lead, so cannot approve.`
    if (sameStaff(a.email, authorEmail) && !isAdminRole(authorRole)) return 'You cannot approve your own document. Choose someone else.'
  }
  return null
}

export function nextVersionNo(existing: number[]): number { return existing.length ? Math.max(...existing) + 1 : 1 }

export const validCode = (code: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(code.trim())

export type ReviewState = 'none' | 'ok' | 'due_soon' | 'overdue'
export function reviewState(nextReview: string | null | undefined, now: Date = new Date()): ReviewState {
  if (!nextReview) return 'none'
  const d = daysUntil(nextReview, now)
  if (d < 0) return 'overdue'
  return d <= 30 ? 'due_soon' : 'ok'
}

// Cards come from the browser, so rebuild them from known fields only. File
// attachments are NEVER taken from the request: a card keeps the attachments
// the server already stored for the same card id, so a path can't be forged to
// point at someone else's file.
export function sanitizeCards(incoming: any, existing: Card[]): Card[] {
  if (!Array.isArray(incoming)) return []
  const byId = new Map(existing.map(c => [c.id, c]))
  const out: Card[] = []
  const used = new Set<string>()
  for (const raw of incoming.slice(0, 60)) {
    const type: CardType = CARD_TYPES.includes(raw?.type) ? raw.type : 'text'
    let id = typeof raw?.id === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(raw.id) ? raw.id : ''
    if (!id || used.has(id)) id = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
    used.add(id)
    const url = String(raw?.url || '').trim().slice(0, 1000)
    out.push({
      id, type,
      title: String(raw?.title || '').trim().slice(0, 200),
      body: String(raw?.body || '').slice(0, 20000),
      url: type === 'link' && /^https?:\/\//i.test(url) ? url : '',
      attachments: type === 'file' ? (byId.get(id)?.attachments || []) : [],
    })
  }
  return out
}

export const cardPaths = (cards: Card[]) => cards.flatMap(c => c.attachments.map(a => a.path))

export const statusLabel = (s: string) => ({
  draft: 'Draft', pending_approval: 'Awaiting approval', approved: 'Approved', declined: 'Declined', superseded: 'Superseded', active: 'Active', retired: 'Retired',
}[s] || s)

// ---- approval proof, process changes, small edits -------------------------

export const PROOF_METHODS = ['email', 'chat', 'call', 'meeting', 'other'] as const
export const methodLabel = (m: string) => ({ email: 'Email', chat: 'Chat message', call: 'Phone / video call', meeting: 'Meeting', other: 'Other' } as Record<string, string>)[m] || m

export type ProofInput = { approved_by_name: string, approved_on: string, method: string }
// A proof entry needs who approved, when, and how. Returns a user-readable
// problem, or null when it is complete.
export function proofProblem(p: Partial<ProofInput>): string | null {
  if (!(p.approved_by_name || '').trim()) return 'Enter who approved it (name).'
  if (!p.approved_on || !/^\d{4}-\d{2}-\d{2}$/.test(p.approved_on)) return 'Enter the date it was approved.'
  if (!(PROOF_METHODS as readonly string[]).includes(p.method || '')) return 'Choose how it was approved.'
  return null
}

// An externally approved version should have screenshots on file; managers
// see "proof missing" until at least one proof entry has a file.
export function proofMissing(version: { approval_source: string } | null, proofs: { attachments: any[] | null }[]): boolean {
  if (!version || version.approval_source !== 'external') return false
  return !proofs.some(p => (p.attachments || []).length > 0)
}

// Did a small edit actually change anything? (ids and order count)
export function cardsChanged(before: Card[], after: Card[]): boolean {
  const norm = (cs: Card[]) => JSON.stringify(cs.map(c => [c.id, c.type, c.title, c.body, c.url, c.attachments.map(a => a.path)]))
  return norm(before) !== norm(after)
}

// A card is worth publishing if it says or points to something.
export const cardHasContent = (c: Card) => !!(c.title.trim() || c.body.trim() || c.url || c.attachments.length)

// What readers (not managers) may learn about an approval proof: who, when and
// how. Never the screenshots, paths or notes.
export function publicProof<T extends { approved_by_name: string, approved_by_role: string | null, approved_on: string, method: string }>(p: T) {
  return { approved_by_name: p.approved_by_name, approved_by_role: p.approved_by_role, approved_on: p.approved_on, method: p.method }
}

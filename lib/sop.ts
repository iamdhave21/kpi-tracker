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
// `audience` is set for a document that belongs to a client: then 'all' means everyone who
// supports THAT client, not the whole company. null/undefined = a company-wide document.
export function isReceiver(mode: string, selectedEmails: string[], me: string, audience?: string[] | null): boolean {
  if (!lc(me)) return false
  if (mode === 'all') return audience ? audience.some(e => sameStaff(e, me)) : true
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

// ---- document numbers: CAMPAIGN-TYPE-MMDDYY (for example AR-SOP-100826) --------------

export const DOC_NUMBER_FORMAT = 'CAMPAIGN-TYPE-MMDDYY'
// SOP = the goal (what must be achieved, and the rules). LWI = the how (step by step).
export const TYPE_EXPLAINER = { SOP: 'the goal: what must be achieved, and the rules', LWI: 'the how: the step-by-step instructions' }

// Letters and digits only, upper case, at most 10 characters.
export const cleanCampaign = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)

// 2026-10-08 -> "100826". Null when the date is not a real date.
export function mmddyy(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${m[2]}${m[3]}${m[1].slice(2)}`
}

export function buildDocNumber(campaign: string, type: string, ymd: string): string | null {
  const c = cleanCampaign(campaign), t = (type || '').toUpperCase(), d = mmddyy(ymd)
  if (!c || !d || (t !== 'SOP' && t !== 'LWI')) return null
  return `${c}-${t}-${d}`
}

// A standard number, optionally with a "-2" style suffix when several share a day. When
// `type` is given the number's own type segment must match it.
export function isStandardDocNumber(code: string, type?: string): boolean {
  const m = /^([A-Z0-9]{1,10})-(SOP|LWI)-(\d{2})(\d{2})(\d{2})(-\d{1,3})?$/.exec((code || '').trim())
  if (!m) return false
  const mo = Number(m[3]), d = Number(m[4]), y = 2000 + Number(m[5])
  const dt = new Date(y, mo - 1, d)
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return false
  return !type || m[2] === type
}

export const campaignOf = (code: string): string | null => /^([A-Z0-9]{1,10})-(SOP|LWI)-\d{6}/.exec((code || '').trim())?.[1] || null

// First free number: AR-SOP-100826, then AR-SOP-100826-2, -3 ...
export function nextFreeDocNumber(base: string, taken: string[]): string {
  const used = new Set(taken.map(t => t.trim().toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  for (let n = 2; n < 1000; n++) if (!used.has(`${base}-${n}`.toLowerCase())) return `${base}-${n}`
  return `${base}-${Date.now()}`
}

// ---- client scoping -------------------------------------------------------------------
//   Admin / Super Admin : any client, or none (company-wide).
//   Team Lead           : only a client they support, and one is required.
// Returns the client spelled the way it is stored, or an error to show.
export function clientCheck(role: string, myClients: string[], allClients: string[], client: string | null | undefined):
  { ok: true, client: string | null } | { ok: false, error: string } {
  const want = (client || '').trim()
  const same = (a: string, b: string) => lc(a) === lc(b)
  if (!canAuthor(role)) return { ok: false, error: 'Only Admins and Team Leads can set a client.' }
  if (want === '') {
    if (role === 'Team Lead') return { ok: false, error: myClients.length === 0 ? 'You are not assigned to a client yet, so ask an Admin to create this document.' : 'Choose the client this document is for.' }
    return { ok: true, client: null }
  }
  const known = allClients.find(c => same(c, want))
  if (!known) return { ok: false, error: `“${want}” is not a client in the portal.` }
  if (role === 'Team Lead' && !myClients.some(c => same(c, known))) return { ok: false, error: `You can only use a client you support. ${known} is not one of yours.` }
  return { ok: true, client: known }
}

export type EmpWithClients = { email: string, clients: string[] }
// Who must acknowledge a client's document by default: everyone who supports that client.
// Returns null for a document with no client (company-wide: everyone).
export function audienceEmails(client: string | null | undefined, employees: EmpWithClients[]): string[] | null {
  const c = lc(client)
  if (!c) return null
  return employees.filter(e => e.email && e.clients.some(x => lc(x) === c)).map(e => e.email)
}

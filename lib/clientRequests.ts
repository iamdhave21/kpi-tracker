// Client Requests (client -> AB BSS): the rules, kept as plain functions (no
// React, no database) so they can be tested on their own and shared between
// the client portal, the staff inbox, and the server routes.

export const REQUEST_TYPES = [
  { value: 'headcount', label: 'Headcount requisition', approval: true },
  { value: 'process_change', label: 'Process change', approval: true },
  { value: 'escalation', label: 'Escalation', approval: false },
  { value: 'commendation', label: 'Commendation', approval: false },
  { value: 'complaint_feedback', label: 'Complaint or feedback', approval: false },
  { value: 'commercial_change', label: 'Commercial change', approval: true },
  { value: 'general', label: 'General message', approval: false },
] as const

export const REQUEST_LEVELS = [
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'account_manager', label: 'Account Manager' },
  { value: 'director', label: 'Director' },
  { value: 'ceo', label: 'CEO' },
] as const

export const REQUEST_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export const REQUEST_STATUSES = [
  { value: 'new', label: 'Received' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
] as const

export const typeLabel = (v: string) => REQUEST_TYPES.find(t => t.value === v)?.label || v
export const levelLabel = (v: string) => REQUEST_LEVELS.find(l => l.value === v)?.label || v
export const statusLabel = (v: string) => REQUEST_STATUSES.find(s => s.value === v)?.label || v
export const requiresApproval = (type: string) => !!REQUEST_TYPES.find(t => t.value === type)?.approval
export const refLabel = (n: number) => `CR-${String(n).padStart(4, '0')}`

// ---- dates: either a real date or an explicit N/A (stored as null) ----
export function parseNaDate(v: string | null | undefined): { ok: true, value: string | null } | { ok: false } {
  const s = (v || '').trim()
  if (s.toUpperCase() === 'NA' || s.toUpperCase() === 'N/A') return { ok: true, value: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false }
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return { ok: false }
  return { ok: true, value: s }
}

// ---- who may see a request on the staff side ----
// admin / super_admin: all. Team Lead: requests for clients they support (a
// Team Lead with no clients set sees none -- never everyone's). Anyone else:
// none (approvers and receivers are chosen from admins and Team Leads).
export function canSeeRequest(role: string, staffClients: string[], reqClient: string): boolean {
  if (role === 'admin' || role === 'super_admin') return true
  if (role === 'Team Lead') return staffClients.map(c => c.trim().toLowerCase()).includes(reqClient.trim().toLowerCase())
  return false
}

// ---- who gets the alert ----
// Order: a rule set for this specific client > (Team Lead level only) the Team
// Leads who actually support that client > the general rule for the level >
// the fallback address. An alert is never silently dropped.
export function resolveRecipients(a: {
  level: string, client: string, derivedTeamLeads: string[],
  routing: { client: string | null, level: string, recipients: string }[], fallback: string,
}): string[] {
  const split = (s: string) => s.split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@'))
  const c = a.client.trim().toLowerCase()
  const forLevel = a.routing.filter(r => r.level === a.level)
  const clientRow = forLevel.find(r => r.client && r.client.trim().toLowerCase() === c)
  const globalRow = forLevel.find(r => !r.client)
  let list: string[] = []
  if (clientRow) list = split(clientRow.recipients)
  if (list.length === 0 && a.level === 'team_lead') list = a.derivedTeamLeads.map(e => e.toLowerCase())
  if (list.length === 0 && globalRow) list = split(globalRow.recipients)
  if (list.length === 0) list = [a.fallback.toLowerCase()]
  return Array.from(new Set(list))
}

// ---- approvals ----
export type Decision = 'pending' | 'approved' | 'declined'
// Any decline declines the request; it's approved only once there is at least
// one approver and every approver has approved.
export function decisionOutcome(decisions: Decision[]): Decision {
  if (decisions.some(d => d === 'declined')) return 'declined'
  if (decisions.length > 0 && decisions.every(d => d === 'approved')) return 'approved'
  return 'pending'
}

// Statuses staff may set by hand. 'approved' and 'declined' on a type that
// needs approval come only from the approvers' decisions; types that only need
// acknowledgment never use them. A request that needs approval can't be marked
// completed before it's approved.
export function allowedManualStatuses(req: { requires_approval: boolean, status: string }): string[] {
  const base = ['new', 'acknowledged', 'in_review', 'completed', 'closed']
  if (!req.requires_approval) return base
  return req.status === 'approved' || req.status === 'completed' || req.status === 'closed'
    ? base
    : base.filter(s => s !== 'completed')
}

// Same email, either company domain (they're aliases of one Workspace).
export function sameStaff(a: string | null | undefined, b: string | null | undefined): boolean {
  const la = (a || '').toLowerCase().split('@')[0], lb = (b || '').toLowerCase().split('@')[0]
  return la !== '' && la === lb
}

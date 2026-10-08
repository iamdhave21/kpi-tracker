// Who may see which ticket (no React, no database, so it can be tested).
//
//   Everyone     : tickets they filed, tickets assigned to them (owner), and every
//                  ticket in a category they are a POC for -- the people who
//                  RESOLVE IT / HR / Admin tickets must never lose sight of them.
//   Agent        : nothing more.
//   Team Lead    : + tickets filed by members of the teams they lead.
//   Manager      : + tickets filed by Agents and Team Leads (not other Managers'
//                  or the Super Admin's, unless those are assigned to them).
//   Super Admin  : everything.
//
// Identity is the part of the email before the @, because the same person can
// sign in under either company domain and older tickets may hold a bare username.

const lc = (s: string | null | undefined) => (s || '').trim().toLowerCase()
export const localPart = (s: string | null | undefined) => lc(s).split('@')[0]

export type TicketLike = { created_by: string, requested_by?: string | null, owner?: string | null, assigned_to?: string | null, category: string }
export type ScopeCtx = {
  role: string
  email: string
  pocCategories: string[]                    // categories this person is a POC for
  teamEmails: string[]                       // people on the teams this person leads
  roleByLocal: Record<string, string>        // creator's role, by email local part (for Manager scope)
}

const filedBy = (t: TicketLike) => [t.created_by, t.requested_by].map(localPart).filter(Boolean)

export function isMine(t: TicketLike, email: string): boolean {
  const me = localPart(email)
  return me !== '' && filedBy(t).includes(me)
}

export function isHandler(t: TicketLike, c: Pick<ScopeCtx, 'email' | 'pocCategories'>): boolean {
  const me = localPart(c.email)
  if (me === '') return false
  if (localPart(t.owner) === me || localPart(t.assigned_to) === me) return true
  return c.pocCategories.map(lc).includes(lc(t.category))
}

export function canSeeTicket(t: TicketLike, c: ScopeCtx): boolean {
  if (c.role === 'super_admin') return true
  if (isMine(t, c.email) || isHandler(t, c)) return true
  if (c.role === 'Team Lead') {
    const team = new Set(c.teamEmails.map(localPart))
    return filedBy(t).some(x => team.has(x))
  }
  if (c.role === 'admin') {
    // Manager: everyone's except other Managers' and the Super Admin's. A creator
    // with no account on file is treated as an ordinary staff member (visible).
    const requester = localPart(t.requested_by) || localPart(t.created_by)
    const r = c.roleByLocal[requester]
    return !(r === 'admin' || r === 'super_admin')
  }
  return false
}

// Categories this person is a POC for, from { category: [owner emails] }.
export function pocCategoriesFor(owners: Record<string, string[]>, email: string): string[] {
  const me = localPart(email)
  if (!me) return []
  return Object.entries(owners).filter(([, emails]) => (emails || []).some(e => localPart(e) === me)).map(([cat]) => cat)
}

// Emails of the people on the teams this person leads. Matches the person to
// their employee row(s) by email local part, then follows teams -> team_members.
export function teamEmailsFor(
  email: string,
  employees: { id: string, email: string | null }[],
  teams: { id: string, team_lead_id: string | null }[],
  members: { team_id: string, employee_id: string }[],
): string[] {
  const me = localPart(email)
  if (!me) return []
  const myIds = new Set(employees.filter(e => localPart(e.email) === me).map(e => e.id))
  if (myIds.size === 0) return []
  const myTeams = new Set(teams.filter(t => t.team_lead_id && myIds.has(t.team_lead_id)).map(t => t.id))
  const memberIds = new Set(members.filter(m => myTeams.has(m.team_id)).map(m => m.employee_id))
  return employees.filter(e => memberIds.has(e.id) && e.email).map(e => lc(e.email))
}

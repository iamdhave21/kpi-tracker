// Rules for the Weekly Pulse Check numbers on the Ops Dashboard (pure functions, so they can be tested).
//
// Two different things are measured, and the card now shows both:
//   * the SCORE (average, at-risk) can only come from people who responded;
//   * PARTICIPATION is out of everyone required: all active staff in scope, minus the exempt accounts.

const COMPANY_DOMAINS = ['ab-businesssupport.com', 'ab-contactsolutions.com']

// The same person signs in under either company domain, so identity is the part before the @ (never the
// full address), and only on the two company domains.
export function isExemptEmail(email: string | null | undefined, exemptEmails: string[], domains: string[] = COMPANY_DOMAINS): boolean {
  const parts = (email || '').trim().toLowerCase().split('@')
  if (parts.length !== 2 || !parts[0] || !domains.includes(parts[1])) return false
  return exemptEmails.some(e => e.trim().toLowerCase().split('@')[0] === parts[0])
}

export type PulseRow = { employeeId: string, week: string, avg: number | null, atRisk: boolean, name?: string, retention?: number | null }
export type PulseSummary = {
  submissions: number
  respondedPeople: number
  expectedPeople: number | null       // null when no required week has happened yet in the period
  responseRate: number | null         // 0 to 1
  avgPerPerson: number | null         // each person's own average first, then the average of people
  avgPerSubmission: number | null     // the old way, kept for comparison and tests
  flaggedPeople: number
  weekResponded: number
  weekExpected: number | null
}
const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null

export function summarizePulse(rows: PulseRow[], expectedIds: string[], latestWeek: string | null): PulseSummary {
  const expected = new Set(expectedIds)
  const mine = rows.filter(r => expected.has(r.employeeId))
  const byPerson = new Map<string, number[]>()
  const responded = new Set<string>(), flagged = new Set<string>(), inWeek = new Set<string>()
  for (const r of mine) {
    responded.add(r.employeeId)
    if (r.atRisk) flagged.add(r.employeeId)
    if (latestWeek && r.week === latestWeek) inWeek.add(r.employeeId)
    if (r.avg !== null) byPerson.set(r.employeeId, [...(byPerson.get(r.employeeId) || []), r.avg])
  }
  const required = latestWeek !== null && expected.size > 0
  const perPerson = Array.from(byPerson.values()).map(v => mean(v) as number)
  const all = Array.from(byPerson.values()).flat()
  return {
    submissions: mine.length,
    respondedPeople: responded.size,
    expectedPeople: required ? expected.size : null,
    responseRate: required ? responded.size / expected.size : null,
    avgPerPerson: perPerson.length ? mean(perPerson) : null,
    avgPerSubmission: all.length ? mean(all) : null,
    flaggedPeople: flagged.size,
    weekResponded: inWeek.size,
    weekExpected: required ? expected.size : null,
  }
}

// One line per person, not per flagged week: their worst average, lowest retention answer, and how many weeks.
export function uniqueFlagged(rows: PulseRow[]): { name: string, avg: number | null, retention: number | null, weeks: number }[] {
  const by = new Map<string, { name: string, avgs: number[], ret: number[], weeks: number }>()
  for (const r of rows.filter(x => x.atRisk)) {
    const g = by.get(r.employeeId) || { name: r.name || 'Unknown', avgs: [], ret: [], weeks: 0 }
    g.weeks++
    if (r.avg !== null) g.avgs.push(r.avg)
    if (typeof r.retention === 'number') g.ret.push(r.retention)
    by.set(r.employeeId, g)
  }
  return Array.from(by.values())
    .map(g => ({ name: g.name, avg: g.avgs.length ? Math.min(...g.avgs) : null, retention: g.ret.length ? Math.min(...g.ret) : null, weeks: g.weeks }))
    .sort((a, b) => b.weeks - a.weeks || (a.avg ?? 9) - (b.avg ?? 9) || a.name.localeCompare(b.name))
}

// The most recent Monday that was a REQUIRED week and has already started, inside [monthStart, monthEndExclusive).
// Dates are 'YYYY-MM-DD'; a Monday on or after the rollout date is required (same rule as the compliance score).
export function latestRequiredMonday(monthStart: string, monthEndExclusive: string, today: string, rollout: string): string | null {
  const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  const lo = Math.max(day(monthStart), day(rollout)), hi = Math.min(day(monthEndExclusive) - 86400000, day(today))
  let best: number | null = null
  for (let t = lo; t <= hi; t += 86400000) if (new Date(t).getUTCDay() === 1) best = t
  return best === null ? null : new Date(best).toISOString().slice(0, 10)
}

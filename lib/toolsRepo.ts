// Pure helpers for the Access and Tools Repository (no React, no database),
// kept separate so the date and cost logic can be tested on its own.

export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Whole days from today (local midnight) to a YYYY-MM-DD date. Negative = past.
// Parsed as a LOCAL date on purpose: new Date('2026-10-15') alone is read as
// UTC midnight, which is a different calendar day in the Philippines.
export function daysUntil(ymd: string, now: Date = new Date()): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

// Add months, clamping to the end of the month (Jan 31 + 1 month = Feb 28,
// not Mar 3).
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const first = new Date(y, m - 1 + n, 1)
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  first.setDate(Math.min(d, lastDay))
  return ymdLocal(first)
}

export const CYCLE_MONTHS: Record<string, number | null> = { monthly: 1, quarterly: 3, annual: 12, one_time: null, other: null }

// Cost converted to a per-month figure, or null when it can't be (one-time or
// "other" billing), so the monthly run-rate never guesses.
export function monthlyEquivalent(cost: number | null, cycle: string | null): number | null {
  if (cost == null || !cycle) return null
  const months = CYCLE_MONTHS[cycle]
  return months ? cost / months : null
}

export type NextAction = { label: string, date: string, days: number }

// The soonest of payment due / renewal / end date for something still in use.
// Cancelled and expired tools have no next action.
export function nextAction(t: { status: string, payment_due_date: string | null, renewal_date: string | null, end_date: string | null }, now: Date = new Date()): NextAction | null {
  if (t.status !== 'active' && t.status !== 'trial') return null
  const cands = [
    { label: 'Payment due', date: t.payment_due_date },
    { label: 'Renews', date: t.renewal_date },
    { label: 'Ends', date: t.end_date },
  ].filter((c): c is { label: string, date: string } => !!c.date)
  if (cands.length === 0) return null
  return cands.map(c => ({ ...c, days: daysUntil(c.date, now) })).sort((a, b) => a.days - b.days)[0]
}

// Reminder bands: 30 / 14 / 7 days, plus overdue.
export function urgency(days: number): 'overdue' | 'd7' | 'd14' | 'd30' | 'ok' {
  if (days < 0) return 'overdue'
  if (days <= 7) return 'd7'
  if (days <= 14) return 'd14'
  if (days <= 30) return 'd30'
  return 'ok'
}

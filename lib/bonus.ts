// Rules for the Bonus Review (Super Admin). Pure functions: no React, no database, so they
// can be tested. The screen fetches each person's facts once per period and evaluates them
// here, so switching a criterion on or off is instant.
//
// Scores in the portal are saved as fractions (0.99 = 99%); everything here is in percent.

export type Tier = { minMonths: number, amount: number }
export type BonusConfig = {
  name: string
  periodFrom: string            // 'YYYY-MM', first month measured
  periodTo: string              // 'YYYY-MM', last month measured
  payoutMonth: string           // 'YYYY-MM', tenure is counted to this month
  tenure: { on: boolean, minMonths: number }
  tiers: Tier[]                 // paid by tenure to everyone included (not tied to the criteria)
  basket: number                // paid to everyone included
  attendance: { on: boolean, min: number, mode: 'every' | 'average' }
  performance: { on: boolean, min: number, ignoreUnfinished: boolean }
  nte: { on: boolean, maxAllowed: number, tierPct: number }
  escalations: { on: boolean, maxAllowed: number }
  reward: { mode: 'per_person' | 'pool', amount: number, budget: number }
}
export type MonthPoint = { ym: string, overall: number | null, attendance: number | null, unfinished: number }
export type Person = { key: string, name: string, team: string | null, hire: string | null, months: MonthPoint[], nteDates: string[], escDates: string[], ids?: string[] }
export type Override = { include?: boolean, exception?: boolean, note?: string, escalations?: number | null, tierAmount?: number | null }
export type Check = 'pass' | 'fail' | 'off' | 'nodata'
export type Status = 'pays' | 'not_met' | 'no_data' | 'no_hire' | 'excluded' | 'gated' | 'exception'
export type Eval = {
  months: number | null
  tier: number
  basket: number
  reward: number
  total: number
  eligible: boolean              // would receive the gated reward
  status: Status
  checks: { tenure: Check, attendance: Check, performance: Check, nte: Check, escalations: Check }
  facts: { attendance: number | null, performance: number | null, monthsScored: number, unfinished: number, ntes: number, escalations: number }
  reasons: string[]
}

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
export const UNFINISHED_AT_OR_BELOW = 25   // a month scored 25% or less is almost always an unfinished entry (attendance alone is worth 20%)

// "September 2026", "June - 2025", "FEBRUARY 2025" -> "2026-09", "2025-06", "2025-02"
export function parseMonthLabel(label: string | null | undefined): string | null {
  const m = /([A-Za-z]{3,9})[^A-Za-z0-9]*(\d{4})/.exec(label || '')
  if (!m) return null
  const i = MON.indexOf(m[1].slice(0, 3).toLowerCase())
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, '0')}`
}

// Whole calendar months from the hire month to the payout month, ignoring the day.
export function monthsBetween(hire: string, payout: string): number {
  const [hy, hm] = hire.split('-').map(Number), [py, pm] = payout.split('-').map(Number)
  return (py * 12 + pm) - (hy * 12 + hm)
}
export const inPeriod = (ym: string, from: string, to: string) => ym >= from && ym <= to
const toPct = (x: number) => (x <= 1.5 ? Math.round(x * 10000) / 100 : x)

export function tierFor(tiers: Tier[], months: number): number {
  const hit = [...tiers].sort((a, b) => b.minMonths - a.minMonths).find(t => months >= t.minMonths)
  return hit ? hit.amount : 0
}

// Several KPI rows can share a month (one per process). Per month: attendance is the LOWEST of
// them, overall is the average of the finished ones.
export function aggregateMonths(rows: { label: string | null, overall: number | null, attendance: number | null }[]): MonthPoint[] {
  const by = new Map<string, { o: number[], a: number[], u: number }>()
  for (const r of rows) {
    const ym = parseMonthLabel(r.label)
    if (!ym) continue
    const g = by.get(ym) || { o: [], a: [], u: 0 }
    if (r.overall !== null && r.overall !== undefined) {
      const o = toPct(Number(r.overall))
      if (o <= UNFINISHED_AT_OR_BELOW) g.u++; else g.o.push(o)
    }
    if (r.attendance !== null && r.attendance !== undefined) g.a.push(toPct(Number(r.attendance)))
    by.set(ym, g)
  }
  return Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ym, g]) => ({
    ym, unfinished: g.u,
    overall: g.o.length ? g.o.reduce((s, x) => s + x, 0) / g.o.length : null,
    attendance: g.a.length ? Math.min(...g.a) : null,
  }))
}

export function evaluate(p: Person, cfg: BonusConfig, ov: Override = {}): Eval {
  const blank = (status: Status, reasons: string[]): Eval => ({
    months: null, tier: 0, basket: 0, reward: 0, total: 0, eligible: false, status,
    checks: { tenure: 'off', attendance: 'off', performance: 'off', nte: 'off', escalations: 'off' },
    facts: { attendance: null, performance: null, monthsScored: 0, unfinished: 0, ntes: 0, escalations: 0 }, reasons,
  })
  if (ov.include === false) return blank('excluded', ['Left out of this run.'])

  const needsHire = cfg.tenure.on || cfg.tiers.length > 0
  const months = p.hire ? monthsBetween(p.hire, cfg.payoutMonth) : null
  if (needsHire && months === null) return blank('no_hire', ['No hire date on file.'])

  const pts = p.months.filter(m => inPeriod(m.ym, cfg.periodFrom, cfg.periodTo))
  const att = pts.map(m => m.attendance).filter((x): x is number => x !== null)
  const perf = pts.map(m => m.overall).filter((x): x is number => x !== null)
  const unfinished = pts.reduce((s, m) => s + m.unfinished, 0)
  const attVal = att.length ? (cfg.attendance.mode === 'every' ? Math.min(...att) : att.reduce((s, x) => s + x, 0) / att.length) : null
  const perfVal = perf.length ? perf.reduce((s, x) => s + x, 0) / perf.length : null
  const inP = (d: string) => inPeriod(d.slice(0, 7), cfg.periodFrom, cfg.periodTo)
  const ntes = p.nteDates.filter(inP).length
  const escAuto = p.escDates.filter(inP).length
  const esc = ov.escalations !== null && ov.escalations !== undefined ? ov.escalations : escAuto

  const checks = {
    tenure: (cfg.tenure.on ? (months! >= cfg.tenure.minMonths ? 'pass' : 'fail') : 'off') as Check,
    attendance: (cfg.attendance.on ? (attVal === null ? 'nodata' : attVal >= cfg.attendance.min - 0.05 ? 'pass' : 'fail') : 'off') as Check,
    performance: (cfg.performance.on ? (perfVal === null ? 'nodata' : perfVal >= cfg.performance.min ? 'pass' : 'fail') : 'off') as Check,
    nte: (cfg.nte.on ? (ntes <= cfg.nte.maxAllowed ? 'pass' : 'fail') : 'off') as Check,
    escalations: (cfg.escalations.on ? (esc <= cfg.escalations.maxAllowed ? 'pass' : 'fail') : 'off') as Check,
  }
  const reasons: string[] = []
  if (checks.tenure === 'fail') reasons.push(`Tenure ${months} months, needs ${cfg.tenure.minMonths}.`)
  if (checks.attendance === 'fail') reasons.push(`Attendance ${cfg.attendance.mode === 'every' ? 'lowest month' : 'average'} ${attVal!.toFixed(1)}%, needs ${cfg.attendance.min}%.`)
  if (checks.attendance === 'nodata') reasons.push('No attendance recorded in the period.')
  if (checks.performance === 'fail') reasons.push(`Performance average ${perfVal!.toFixed(1)}%, needs ${cfg.performance.min}%.`)
  if (checks.performance === 'nodata') reasons.push('No performance score in the period.')
  if (checks.nte === 'fail') reasons.push(`${ntes} Notice${ntes === 1 ? '' : 's'} to Explain in the period.`)
  if (checks.escalations === 'fail') reasons.push(`${esc} escalation${esc === 1 ? '' : 's'} noted, ${cfg.escalations.maxAllowed} allowed.`)
  if (unfinished > 0) reasons.push(`${unfinished} unfinished entr${unfinished === 1 ? 'y' : 'ies'} (scored 25% or less) ignored.`)

  const nteGate = cfg.nte.on && ntes > cfg.nte.maxAllowed
  let tier = months !== null ? tierFor(cfg.tiers, months) : 0
  if (nteGate) tier = Math.round(tier * cfg.nte.tierPct / 100)
  // The Director can set one person's tenure bonus by hand (for example after a Notice to Explain).
  const fixed = ov.tierAmount
  if (fixed !== null && fixed !== undefined && !Number.isNaN(fixed)) { tier = fixed; reasons.push(`Tenure bonus set by the Director to ₱${fixed.toLocaleString('en-PH')}.`) }
  else if (nteGate && cfg.nte.tierPct >= 100 && tier > 0) reasons.push('Tenure bonus not yet decided after the Notice to Explain; shown in full.')
  const vals = Object.values(checks)
  const qualifies = vals.every(c => c === 'pass' || c === 'off')
  const exception = !!ov.exception && !nteGate
  const eligible = !nteGate && (qualifies || exception)
  const status: Status = nteGate ? 'gated' : qualifies ? 'pays' : exception ? 'exception' : vals.includes('fail') ? 'not_met' : 'no_data'
  if (exception && !qualifies) reasons.unshift('Included by the Director.' + (ov.note ? ' ' + ov.note : ''))
  return {
    months, tier, basket: cfg.basket, reward: 0, total: tier + cfg.basket, eligible, status, checks,
    facts: { attendance: attVal, performance: perfVal, monthsScored: pts.length, unfinished, ntes, escalations: esc }, reasons,
  }
}

export type RunRow = { person: Person, ov: Override, ev: Eval }
export type Totals = { people: number, payers: number, tiers: number, baskets: number, rewards: number, grand: number, budget: number, overBudget: number, unallocated: number, share: number }

export function computeRun(people: Person[], cfg: BonusConfig, overrides: Record<string, Override> = {}): { rows: RunRow[], totals: Totals } {
  const rows: RunRow[] = people.map(p => ({ person: p, ov: overrides[p.key] || {}, ev: evaluate(p, cfg, overrides[p.key] || {}) }))
  const payers = rows.filter(r => r.ev.eligible)
  const budget = cfg.reward.budget || 0
  const share = cfg.reward.mode === 'pool' ? (payers.length ? Math.floor(budget / payers.length * 100) / 100 : 0) : cfg.reward.amount
  for (const r of payers) { r.ev.reward = share; r.ev.total = r.ev.tier + r.ev.basket + share }
  const rewards = payers.length * share
  const included = rows.filter(r => r.ev.status !== 'excluded' && r.ev.status !== 'no_hire')
  const tiers = included.reduce((s, r) => s + r.ev.tier, 0), baskets = included.reduce((s, r) => s + r.ev.basket, 0)
  return {
    rows,
    totals: {
      people: included.length, payers: payers.length, tiers, baskets, rewards, grand: tiers + baskets + rewards, budget, share,
      overBudget: cfg.reward.mode === 'per_person' && budget > 0 && rewards > budget ? rewards - budget : 0,
      unallocated: cfg.reward.mode === 'pool' ? Math.round((budget - rewards) * 100) / 100 : 0,
    },
  }
}

export const nextMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}` }
export const lastFullMonth = (now: Date = new Date()) => { const y = now.getFullYear(), m = now.getMonth(); return m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}` }

// Starting points. The Director can change anything and save their own.
export function presetAnnual(): BonusConfig {
  return {
    // 2026 scores only. 12+ months starts at 8,000 and reaches 8,500 with a 97% average; there is no
    // attendance bar in this preset (switch it on in the screen if it is wanted again).
    name: 'Annual bonus', periodFrom: '2026-01', periodTo: '2026-12', payoutMonth: '2026-12',
    tenure: { on: true, minMonths: 12 }, tiers: [{ minMonths: 12, amount: 8000 }, { minMonths: 6, amount: 4000 }], basket: 1500,
    attendance: { on: false, min: 100, mode: 'every' }, performance: { on: true, min: 97, ignoreUnfinished: true },
    nte: { on: true, maxAllowed: 0, tierPct: 100 }, escalations: { on: true, maxAllowed: 0 },
    reward: { mode: 'per_person', amount: 500, budget: 0 },
  }
}
export function presetMonthly(month: string = lastFullMonth()): BonusConfig {
  return {
    name: 'Monthly performance bonus', periodFrom: month, periodTo: month, payoutMonth: nextMonth(month),
    tenure: { on: false, minMonths: 0 }, tiers: [], basket: 0,
    attendance: { on: true, min: 100, mode: 'every' }, performance: { on: true, min: 97, ignoreUnfinished: true },
    nte: { on: true, maxAllowed: 0, tierPct: 100 }, escalations: { on: true, maxAllowed: 0 },
    reward: { mode: 'per_person', amount: 1000, budget: 0 },
  }
}

// "3 yr 9 mo" from a hire date, counted in whole months like the bonus rules (the day is ignored).
export function tenureText(hire: string | null | undefined, now: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})/.exec(hire || '')
  if (!m) return ''
  const months = (now.getFullYear() * 12 + now.getMonth() + 1) - (Number(m[1]) * 12 + Number(m[2]))
  if (months < 0) return 'starts soon'
  const yr = Math.floor(months / 12), mo = months % 12
  return yr === 0 ? `${mo} mo` : mo ? `${yr} yr ${mo} mo` : `${yr} yr`
}

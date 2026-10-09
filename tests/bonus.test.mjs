import { tenureText, parseMonthLabel, monthsBetween, tierFor, aggregateMonths, evaluate, computeRun, presetAnnual, presetMonthly, nextMonth, lastFullMonth } from '../lib/bonus.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }

// month labels as they appear in the portal
eq('September 2026', parseMonthLabel('September 2026'), '2026-09')
eq('June - 2025 (dash style)', parseMonthLabel('June - 2025'), '2025-06')
eq('FEBRUARY 2025 (caps)', parseMonthLabel('FEBRUARY 2025'), '2025-02')
eq('garbage gives null', parseMonthLabel('week 3'), null)

// tenure: whole months, day ignored (your rule)
eq('Dec 2022 -> Dec 2026 = 48', monthsBetween('2022-12-28', '2026-12'), 48)
eq('Oct 2023 -> Dec 2026 = 38', monthsBetween('2023-10-15', '2026-12'), 38)
eq('Dec 2025 -> Dec 2026 = 12 (day ignored)', monthsBetween('2025-12-04', '2026-12'), 12)
eq('Aug 2026 -> Dec 2026 = 4 (Lopez)', monthsBetween('2026-08-12', '2026-12'), 4)
const T = presetAnnual().tiers
eq('12 months = 8000', tierFor(T, 12), 8000); eq('11 months = 4000', tierFor(T, 11), 4000); eq('6 months = 4000', tierFor(T, 6), 4000); eq('5 months = 0', tierFor(T, 5), 0)

// several rows in one month: attendance = lowest, overall = average of finished rows, unfinished flagged
const ag = aggregateMonths([
  { label: 'June 2025', overall: 0.99, attendance: 1 }, { label: 'June - 2025', overall: 0.97, attendance: 0.95 },
  { label: 'January 2026', overall: 0.2, attendance: 1 }, { label: 'weird', overall: 1, attendance: 1 },
])
eq('two rows one month merge, nothing unparsed counted', ag.length, 2)
eq('attendance is the lowest of the month', ag[0].attendance, 95)
eq('overall is the average of the month', ag[0].overall, 98)
eq('a 20% month is flagged unfinished and not counted', [ag[1].overall, ag[1].unfinished, ag[1].attendance], [null, 1, 100])

// people
const pt = (ym, o, a, u = 0) => ({ ym, overall: o, attendance: a, unfinished: u })
const full = (o, a) => ['2025-01', '2025-06', '2026-03', '2026-09'].map(ym => pt(ym, o, a))
const P = (name, hire, months, ntes = 0, esc = 0) => ({ key: name, name, team: null, hire, months, nteDates: Array(ntes).fill('2026-03-10'), escDates: Array(esc).fill('2026-03-12') })
// The earlier rule set (100% attendance, 2025 to 2026) is kept here so those rules stay tested.
const A = { ...presetAnnual(), periodFrom: '2025-01', periodTo: '2026-09', attendance: { on: true, min: 100, mode: 'every' } }

const canoy = evaluate(P('Canoy', '2025-12-04', full(100, 100)), A)
eq('perfect record qualifies', canoy.status, 'pays')
eq('tier 8000 + basket 1500', [canoy.tier, canoy.basket], [8000, 1500])
eq('attendance 99% in one month fails the 100% bar', evaluate(P('X', '2024-01-10', [pt('2026-03', 99, 99), pt('2026-04', 99, 100)]), A).status, 'not_met')
eq('average mode forgives one dip', evaluate(P('X', '2024-01-10', [pt('2026-03', 99, 99), pt('2026-04', 99, 100)]), { ...A, attendance: { on: true, min: 99, mode: 'average' } }).status, 'pays')
eq('performance below 97 fails', evaluate(P('X', '2024-01-10', full(96, 100)), A).status, 'not_met')
eq('exactly 97 passes', evaluate(P('X', '2024-01-10', full(97, 100)), A).status, 'pays')
eq('under 12 months fails tenure but still gets its tier and basket', (e => [e.status, e.tier, e.basket])(evaluate(P('Y', '2026-05-14', full(100, 100)), A)), ['not_met', 4000, 1500])
eq('no hire date is flagged and pays nothing', (e => [e.status, e.total])(evaluate(P('Z', null, full(100, 100)), A)), ['no_hire', 0])
eq('no scores in the period = no data', evaluate(P('N', '2024-01-10', []), A).status, 'no_data')
eq('months outside the period are ignored', evaluate(P('W', '2024-01-10', [pt('2024-05', 50, 50), ...full(100, 100)]), A).status, 'pays')

// gatekeeper
const nte = evaluate(P('Latupan', '2024-11-04', full(99, 100), 1), A)
eq('an NTE withholds the reward', [nte.status, nte.eligible], ['gated', false])
eq('...but keeps the tier at 100% by default', nte.tier, 8000)
eq('tier can be reduced for NTE holders', evaluate(P('L', '2024-11-04', full(99, 100), 1), { ...A, nte: { on: true, maxAllowed: 0, tierPct: 50 } }).tier, 4000)
eq('an exception cannot override an NTE', evaluate(P('L', '2024-11-04', full(50, 50), 1), A, { exception: true }).status, 'gated')

// the Director sets one person's tenure bonus by hand (Norbert: 4,000 to 6,000)
const lat = P('Latupan', '2024-11-04', full(99, 100), 1)
eq('unset: shown in full but flagged as undecided', (e => [e.tier, e.reasons.some(r => r.includes('not yet decided'))])(evaluate(lat, A)), [8000, true])
eq('set to 5000', (e => [e.tier, e.total, e.status])(evaluate(lat, A, { tierAmount: 5000 })), [5000, 6500, 'gated'])
eq('the amount is recorded in the basis', evaluate(lat, A, { tierAmount: 5000 }).reasons.some(r => r.includes('₱5,000')), true)
eq('a set amount stops the undecided flag', evaluate(lat, A, { tierAmount: 4000 }).reasons.some(r => r.includes('not yet decided')), false)
eq('4000 to 6000 never earns the add-on', computeRun([lat], A, { Latupan: { tierAmount: 6000 } }).rows[0].ev.reward, 0)
eq('a manual amount also works for someone with no NTE', evaluate(P('Z', '2024-01-10', full(100, 100)), A, { tierAmount: 7000 }).tier, 7000)
eq('percentage still applies when no amount is set', evaluate(lat, { ...A, nte: { on: true, maxAllowed: 0, tierPct: 50 } }).tier, 4000)

// tenure text for the Employees screen
eq('whole months, day ignored: Dec 2022 to Oct 2026', tenureText('2022-12-28', new Date(2026, 9, 8)), '3 yr 10 mo')
eq('whole years', tenureText('2024-10-18', new Date(2026, 9, 8)), '2 yr')
eq('under a year: Jul to Oct is 3 months', tenureText('2026-07-29', new Date(2026, 9, 8)), '3 mo')
eq('no date, no text', tenureText(null), '')

// exceptions (Azeliza / Czareena style)
const exc = evaluate(P('Azeliza', '2022-12-28', [pt('2026-01', null, 100, 1)]), A, { exception: true, note: 'Unfinished January entry.' })
eq('exception pays although a check is missing', [exc.status, exc.eligible], ['exception', true])
eq('exception reason is recorded', exc.reasons[0].startsWith('Included by the Director.'), true)
eq('excluded override removes the person', evaluate(P('Q', '2024-01-10', full(100, 100)), A, { include: false }).status, 'excluded')

// dates matter: a Notice or escalation outside the period does not count
eq('an NTE from before the period is ignored', evaluate({ ...P('O', '2024-01-10', full(100, 100)), nteDates: ['2024-05-01'] }, A).status, 'pays')
eq('an NTE inside a monthly period counts', evaluate({ ...P('O', null, [pt('2026-09', 99, 100)]), nteDates: ['2026-09-20'] }, presetMonthly('2026-09')).status, 'gated')
eq('an escalation outside the period is ignored', evaluate({ ...P('O', '2024-01-10', full(100, 100)), escDates: ['2023-01-05'] }, A).status, 'pays')

// escalations
eq('escalations over the limit fail', evaluate(P('E', '2024-01-10', full(100, 100), 0, 2), A).status, 'not_met')
eq('a manual escalation count overrides the automatic one', evaluate(P('E', '2024-01-10', full(100, 100), 0, 2), A, { escalations: 0 }).status, 'pays')
eq('escalations off ignores them', evaluate(P('E', '2024-01-10', full(100, 100), 0, 5), { ...A, escalations: { on: false, maxAllowed: 0 } }).status, 'pays')

// money: the real list (annual preset), 3 qualifiers + 1 exception + 1 gated + 1 failing + 1 new hire
const people = [
  P('Canoy', '2025-12-04', full(100, 100)), P('Gamier', '2023-10-15', full(99, 100)), P('Ramos', '2024-01-09', full(99, 100)),
  P('Azeliza', '2022-12-28', [pt('2026-01', null, 100, 1)]), P('Latupan', '2024-11-04', full(99, 100), 1),
  P('Padua', '2022-12-28', full(99, 96)), P('Lopez', '2026-08-12', full(100, 100)),
]
const run = computeRun(people, A, { Azeliza: { exception: true } })
eq('payers: 3 qualify + 1 exception', run.totals.payers, 4)
eq('reward total 4 x 500', run.totals.rewards, 2000)
eq('tiers: 6 x 8000 + Lopez 0', run.totals.tiers, 48000)
eq('baskets for 7 people', run.totals.baskets, 10500)
eq('grand total', run.totals.grand, 60500)

// budget: pool splits equally, per-person warns when over
const pool = computeRun(people, { ...presetMonthly('2026-09'), nte: { on: true, maxAllowed: 0, tierPct: 100 }, reward: { mode: 'pool', amount: 0, budget: 1000 } }, { Azeliza: { exception: true } })
eq('pool of 1000 across the qualifiers', [pool.totals.payers, pool.totals.share], [pool.totals.payers, Math.floor(1000 / pool.totals.payers * 100) / 100])
eq('pool never pays out more than the budget', pool.totals.rewards <= 1000, true)
const capped = computeRun(people, { ...A, reward: { mode: 'per_person', amount: 500, budget: 1500 } }, { Azeliza: { exception: true } })
eq('per-person cost over the budget is reported', capped.totals.overBudget, 500)
eq('monthly preset: no tenure, no tiers', (c => [c.tenure.on, c.tiers.length, c.basket])(presetMonthly('2026-09')), [false, 0, 0])
eq('monthly preset pays 1000 per qualifier', computeRun([P('M', null, [pt('2026-09', 99, 100)])], presetMonthly('2026-09')).rows[0].ev.total, 1000)
eq('next month wraps the year', nextMonth('2026-12'), '2027-01'); eq('last full month in January', lastFullMonth(new Date(2027, 0, 15)), '2026-12')


// the 2026 rule: 97% average only, no attendance bar
const N = presetAnnual()
eq('new annual preset measures 2026 only', [N.periodFrom, N.periodTo], ['2026-01', '2026-12'])
eq('new annual preset has no attendance bar', N.attendance.on, false)
const m26 = (o, a) => ['2026-01', '2026-03', '2026-06', '2026-09'].map(ym => pt(ym, o, a))
eq('97% average reaches 8,500 even with weak attendance', (e => [e.status, e.reward])((r => ({ status: r.rows[0].ev.status, reward: r.rows[0].ev.reward }))(computeRun([P('Dandoy', '2025-08-11', m26(98, 90))], N))), ['pays', 500])
eq('below 97% stays at the 8,000 base, no reward', (r => [r.rows[0].ev.tier, r.rows[0].ev.reward])(computeRun([P('X', '2024-01-10', m26(96, 100))], N)), [8000, 0])
eq('2025 scores do not count in the 2026 rule', (r => r.rows[0].ev.status)(computeRun([P('Y', '2024-01-10', [pt('2025-05', 60, 60), ...m26(99, 100)])], N)), 'pays')
eq('without the Notice to Explain the same record would reach 8,500', (r => [r.rows[0].ev.tier, r.rows[0].ev.reward])(computeRun([P('Latupan', '2024-11-04', m26(99, 100), 0)], N, {})), [8000, 500])
const nteRun = computeRun([{ ...P('Latupan', '2024-11-04', m26(99, 100)), nteDates: ['2026-03-10'] }], N, { Latupan: { tierAmount: 6000 } })
eq('Norbert with the Notice to Explain: 6,000, no add-on', [nteRun.rows[0].ev.tier, nteRun.rows[0].ev.reward, nteRun.rows[0].ev.status], [6000, 0, 'gated'])
eq('an unfinished January entry is ignored, so she still qualifies', (r => r.rows[0].ev.status)(computeRun([P('Azeliza', '2022-12-28', [pt('2026-01', null, 100, 1), ...['2026-02', '2026-03', '2026-06'].map(ym => pt(ym, 100, 100))])], N)), 'pays')

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)

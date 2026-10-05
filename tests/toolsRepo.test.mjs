import { addMonths, daysUntil, monthlyEquivalent, nextAction, urgency } from '../lib/toolsRepo.ts'
let fail = 0
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const now = new Date(2026, 9, 5, 7, 30)  // Oct 5 2026, 7:30am local (UTC+8 => still Oct 4 in UTC)
eq('days until today', daysUntil('2026-10-05', now), 0)
eq('days until tomorrow', daysUntil('2026-10-06', now), 1)
eq('days until yesterday', daysUntil('2026-10-04', now), -1)
eq('days until +30', daysUntil('2026-11-04', now), 30)
eq('addMonths Jan31+1', addMonths('2026-01-31', 1), '2026-02-28')
eq('addMonths Oct5+3', addMonths('2026-10-05', 3), '2027-01-05')
eq('addMonths Oct31+12', addMonths('2026-10-31', 12), '2027-10-31')
eq('addMonths Feb29(leap)+12', addMonths('2028-02-29', 12), '2029-02-28')
eq('monthly eq annual', monthlyEquivalent(1200, 'annual'), 100)
eq('monthly eq quarterly', monthlyEquivalent(300, 'quarterly'), 100)
eq('monthly eq one_time', monthlyEquivalent(300, 'one_time'), null)
eq('monthly eq no cost', monthlyEquivalent(null, 'monthly'), null)
eq('urgency overdue', urgency(-1), 'overdue'); eq('urgency 0', urgency(0), 'd7'); eq('urgency 7', urgency(7), 'd7')
eq('urgency 8', urgency(8), 'd14'); eq('urgency 14', urgency(14), 'd14'); eq('urgency 15', urgency(15), 'd30'); eq('urgency 30', urgency(30), 'd30'); eq('urgency 31', urgency(31), 'ok')
const t = { status: 'active', payment_due_date: '2026-10-20', renewal_date: '2026-10-12', end_date: null }
eq('next action picks soonest', nextAction(t, now), { label: 'Renews', date: '2026-10-12', days: 7 })
eq('cancelled has none', nextAction({ ...t, status: 'cancelled' }, now), null)
eq('no dates', nextAction({ status: 'active', payment_due_date: null, renewal_date: null, end_date: null }, now), null)
eq('overdue wins', nextAction({ ...t, end_date: '2026-10-01' }, now)?.days, -4)
console.log(fail ? `${fail} FAILED` : 'ALL PASSED')

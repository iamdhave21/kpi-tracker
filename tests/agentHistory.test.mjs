import { monthlyHistory, historyStats, tone } from '../lib/agentHistory.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const R = (id, label, o) => ({ employee_id: id, month_label: label, attendance: 1, accuracy: 0.98, efficiency: 0.97, feedback: 1, compliance_score: 1, overall_score: 0.99, ...o })
const recs = [
  R('a', 'March 2026', { overall_score: 0.98 }), R('a', 'January 2026', { overall_score: 0.2, accuracy: null, efficiency: null, feedback: null }),
  R('a', 'February 2026', {}), R('b', 'January 2026', { overall_score: 0.5 }),                       // another person
  R('a', 'June - 2025', { overall_score: 0.95 }), R('a2', 'June 2025', { overall_score: 0.97 }),       // same month, two rows (one per client)
  R('a', 'week 3', {}),
]
const h = monthlyHistory(recs, ['a', 'a2'])
eq('one line per month, in date order', h.map(r => r.month), ['2025-06', '2026-01', '2026-02', '2026-03'])
eq('only this person (both rows of the same person are merged)', h[0].rows, 2)
eq('two rows in a month are averaged', h[0].overall, 96)
eq('a 0.20 month is incomplete and has no overall', [h[1].overall, h[1].incomplete], [null, true])
eq('a month label that is not a month is ignored', h.length, 4)
eq('fractions become percentages', [h[2].attendance, h[2].accuracy, h[2].overall], [100, 98, 99])
eq('other people are not mixed in', h.some(r => r.overall === 50), false)

const s = historyStats(h, 2026)
eq('latest scored month is March', s.latest.month, '2026-03')
eq('change vs the previous scored month (Feb 99 -> Mar 98)', s.change, -1)
eq('average of all scored months', s.avgAll, 97.67)
eq('average for the year uses only that year', s.avgYear, 98.5)
eq('last 3 scored months', s.avgLast3, 97.67)
eq('best and lowest', [s.best.month, s.lowest.month], ['2026-02', '2025-06'])
eq('months under the 97 bar', s.belowBar, 1)
eq('unfinished months are counted separately', s.incomplete, 1)
eq('no history: nothing invented', (x => [x.latest, x.avgAll, x.change])(historyStats([], 2026)), [null, null, null])
eq('colours: 97 or above', tone(97), 'good'); eq('94 to 97 watch', tone(95), 'watch'); eq('below 94 bad', tone(90), 'bad'); eq('no data', tone(null), 'none')
console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)

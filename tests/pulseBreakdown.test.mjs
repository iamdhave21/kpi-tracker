import { breakdown, scoreTone } from '../lib/pulseBreakdown.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const cats = [
  { key: 'wlb', label: 'Work-Life Balance', questions: [{ key: 'wlb_1', text: 'Workload manageable' }, { key: 'wlb_2', text: 'Breaks on time' }] },
  { key: 'client', label: 'Client Interaction', questions: [{ key: 'client_1', text: 'Respected by client' }, { key: 'client_2', text: 'Supported by TL' }] },
]
const R = (week, o) => ({ week_start: week, wlb_1: 4, wlb_2: 4, client_1: 4, client_2: 4, retention: 4, ...o })
const weeks = ['2026-09-14', '2026-09-21', '2026-09-28']

// last week everyone was at 4; this week workload and breaks fell
const rows = [
  R('2026-09-21', {}), R('2026-09-21', {}), R('2026-09-21', {}),
  R('2026-09-28', { wlb_1: 3, wlb_2: 3 }), R('2026-09-28', { wlb_1: 2, wlb_2: 4 }), R('2026-09-28', { wlb_1: 3, wlb_2: 3, retention: 2 }),
]
const b = breakdown(rows, cats, weeks, '2026-09-28')
const wlb = b.categories[0], client = b.categories[1]
eq('3 responders this week', b.responders, 3)
eq('previous week is the last one with answers', b.prevWeek, '2026-09-21')
eq('WLB this week = mean of 6 answers', wlb.current, 3.0)
eq('WLB dropped by a full point', wlb.delta, -1.0)
eq('client interaction unchanged', [client.current, client.delta], [4, 0])
eq('weakest area is Work-Life Balance', b.weakest.key, 'wlb')
eq('biggest drop is Work-Life Balance', b.biggestDrop.key, 'wlb')
eq('lowest question is the workload one', b.lowestQuestion.key, 'wlb_1')
eq('question level change', [wlb.questions[0].current, wlb.questions[0].delta], [2.67, -1.33])
eq('lowest question inside the category', wlb.lowestQuestion.key, 'wlb_1')
eq('window average counts every week with answers', wlb.windowAvg, 3.5)
eq('series has a point per week, gap where nobody answered', wlb.series.map(s => s.avg), [null, 4, 3])
eq('retention is tracked separately', [b.retention.current, b.retention.prev, b.retention.delta], [3.33, 4, -0.67])
eq('weeks with data', b.weeksWithData, 2)

// nothing dropped: no "biggest drop" is invented
const flat = breakdown([R('2026-09-21', {}), R('2026-09-28', {})], cats, weeks, '2026-09-28')
eq('flat week: no drop reported', flat.biggestDrop, null)
// a tiny wobble (-0.05) is not a drop
const wobble = breakdown([R('2026-09-21', {}), R('2026-09-28', { wlb_1: 3.9 })], cats, weeks, '2026-09-28')
eq('a 0.05 wobble is not called a drop', wobble.biggestDrop, null)
// first week ever: no previous
const first = breakdown([R('2026-09-14', {})], cats, weeks, '2026-09-14')
eq('first week has no previous and no delta', [first.prevWeek, first.categories[0].delta], [null, null])
// a week nobody answered
const empty = breakdown(rows, cats, weeks, '2026-09-14')
eq('a week with no answers has no numbers', [empty.responders, empty.categories[0].current, empty.weakest], [0, null, null])
eq('rows outside the window are ignored', breakdown([...rows, R('2026-01-05', { wlb_1: 1, wlb_2: 1 })], cats, weeks, '2026-09-28').categories[0].windowAvg, 3.5)
eq('missing answers are skipped, not zeros', breakdown([{ week_start: '2026-09-28', wlb_1: 4 }], cats, weeks, '2026-09-28').categories[0].current, 4)

// colours
eq('2.5 or less is red', scoreTone(2.5), 'bad'); eq('3.4 is amber', scoreTone(3.4), 'watch'); eq('3.5 is green', scoreTone(3.5), 'good'); eq('no data is none', scoreTone(null), 'none')

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)

import { kpiEntryCoverage, averageApplicable } from '../lib/tlScore.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const team = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cora' }, { id: 'd', name: 'Dan' }]

eq('all 4 entered = 100%', kpiEntryCoverage(team, ['a', 'b', 'c', 'd'], 'tl').score, 100)
eq('3 of 4 = 75%', kpiEntryCoverage(team, ['a', 'b', 'c'], 'tl').score, 75)
eq('none entered = 0%', kpiEntryCoverage(team, [], 'tl').score, 0)
eq('counts done/total', [kpiEntryCoverage(team, ['a', 'b'], 'tl').done, kpiEntryCoverage(team, ['a', 'b'], 'tl').total], [2, 4])
eq('lists who is missing, sorted', kpiEntryCoverage(team, ['b'], 'tl').missing, ['Ana', 'Cora', 'Dan'])

// the bug this replaces: a record about the TL herself must not count, and she is not her own member
eq('a record about the Team Lead herself does not count', kpiEntryCoverage(team, ['tl'], 'tl').score, 0)
eq('the Team Lead listed in her own team is excluded', kpiEntryCoverage([...team, { id: 'tl', name: 'Lead' }], ['a', 'b', 'c', 'd'], 'tl').score, 100)
eq('records for people outside the team do not inflate it', kpiEntryCoverage(team, ['x', 'y', 'z', 'w'], 'tl').done, 0)
eq('duplicate member rows count once', kpiEntryCoverage([...team, { id: 'a', name: 'Ana' }], ['a', 'b', 'c', 'd'], 'tl').total, 4)
eq('duplicate record rows do not double count', kpiEntryCoverage(team, ['a', 'a', 'a', 'a'], 'tl').done, 1)

// nothing to measure
const none = kpiEntryCoverage([], [], 'tl')
eq('no active members: not applicable', none.applicable, false)
eq('no active members: not a fake 100', none.score, 0)
eq('a lone TL in her own team: not applicable', kpiEntryCoverage([{ id: 'tl', name: 'Lead' }], [], 'tl').applicable, false)

// averaging leaves out parts with nothing to measure
eq('average of applicable parts only', averageApplicable([{ score: 100, applicable: true }, { score: 50, applicable: true }, { score: 0, applicable: false }]), 75)
eq('no applicable parts = 0', averageApplicable([{ score: 100, applicable: false }]), 0)
// Azeliza, September: 4 cadence/obs/huddle/coaching parts at 100 + KPI entry that was wrongly 0
eq('her case before: five parts, KPI wrongly 0 -> 80', averageApplicable([100, 100, 100, 100, 0].map(s => ({ score: s, applicable: true }))), 80)
eq('her case after: team all entered -> 100', averageApplicable([100, 100, 100, 100, kpiEntryCoverage(team, ['a', 'b', 'c', 'd'], 'tl').score].map(s => ({ score: s, applicable: true }))), 100)

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)

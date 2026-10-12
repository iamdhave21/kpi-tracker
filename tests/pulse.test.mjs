import { isExemptEmail, summarizePulse, uniqueFlagged, latestRequiredMonday } from '../lib/pulse.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
const ex = ['operations@ab-businesssupport.com', 'andrealiz@ab-businesssupport.com']

// exemption: the alias-domain trap
eq('exact address is exempt', isExemptEmail('operations@ab-businesssupport.com', ex), true)
eq('the other company domain is the same person', isExemptEmail('Operations@AB-ContactSolutions.com', ex), true)
eq('a different person is not exempt', isExemptEmail('frances.miranda@ab-businesssupport.com', ex), false)
eq('same name on an outside domain is NOT exempt', isExemptEmail('operations@gmail.com', ex), false)
eq('no email, not exempt', isExemptEmail(null, ex), false)
eq('a bare username is not exempt', isExemptEmail('operations', ex), false)

// the summary: 10 people required; 4 responded; one of them answered 3 weeks
const R = (id, week, avg, atRisk = false, name = id, retention = 4) => ({ employeeId: id, week, avg, atRisk, name, retention })
const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const rows = [R('a', '2026-09-07', 5), R('a', '2026-09-14', 5), R('a', '2026-09-21', 5), R('b', '2026-09-21', 3), R('c', '2026-09-21', 4, false), R('d', '2026-09-14', 2, true)]
const s = summarizePulse(rows, ids, '2026-09-21')
eq('6 submissions from 4 people', [s.submissions, s.respondedPeople], [6, 4])
eq('response rate is out of EVERYONE required', [s.expectedPeople, s.responseRate], [10, 0.4])
eq('per-person average: (5 + 3 + 4 + 2) / 4', s.avgPerPerson, 3.5)
eq('per-submission average is dominated by the frequent responder', Math.round(s.avgPerSubmission * 100) / 100, 4.0)
eq('latest week: 3 of 10 answered', [s.weekResponded, s.weekExpected], [3, 10])
eq('flagged is counted in people', s.flaggedPeople, 1)
eq('someone outside the required group does not inflate the rate', summarizePulse([...rows, R('zz', '2026-09-21', 5)], ids, '2026-09-21').respondedPeople, 4)
eq('nobody responded: no average, rate 0', (x => [x.avgPerPerson, x.responseRate])(summarizePulse([], ids, '2026-09-21')), [null, 0])
eq('no required week yet: no rate shown', (x => [x.expectedPeople, x.responseRate])(summarizePulse(rows, ids, null)), [null, null])
eq('an unanswered row does not become a zero', summarizePulse([R('a', '2026-09-21', null), R('b', '2026-09-21', 4)], ids, '2026-09-21').avgPerPerson, 4)

// at-risk list: one line per person
const fl = uniqueFlagged([R('a', 'w1', 2.0, true, 'Ana', 3), R('a', 'w2', 1.5, true, 'Ana', 1), R('b', 'w1', 2.4, true, 'Ben', 4), R('c', 'w1', 4, false, 'Cy', 5)])
eq('two people, not three rows', fl.length, 2)
eq('the person flagged twice shows once with her worst values', fl[0], { name: 'Ana', avg: 1.5, retention: 1, weeks: 2 })
eq('unflagged people are left out', fl.some(x => x.name === 'Cy'), false)

// required weeks (rollout Monday 2026-08-31)
eq('September: the last required Monday before Sept 28', latestRequiredMonday('2026-09-01', '2026-10-01', '2026-09-24', '2026-08-31'), '2026-09-21')
eq('on a Monday itself that week counts', latestRequiredMonday('2026-09-01', '2026-10-01', '2026-09-28', '2026-08-31'), '2026-09-28')
eq('a past month uses its own last Monday', latestRequiredMonday('2026-09-01', '2026-10-01', '2026-10-12', '2026-08-31'), '2026-09-28')
eq('before the rollout nothing was required', latestRequiredMonday('2026-07-01', '2026-08-01', '2026-10-12', '2026-08-31'), null)
eq('a month with no Monday yet gives null', latestRequiredMonday('2026-12-01', '2027-01-01', '2026-10-12', '2026-08-31'), null)
eq('August only has the rollout Monday', latestRequiredMonday('2026-08-01', '2026-09-01', '2026-10-12', '2026-08-31'), '2026-08-31')

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)

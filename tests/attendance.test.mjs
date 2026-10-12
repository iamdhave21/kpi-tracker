import { toYmd, classifyDay, extractDayRows, nameKey, nameScore, matchName, dedupeRows, aggregateAttendance, recomputeOverall, monthLabelOf, DEFAULT_OPTIONS } from '../lib/attendance.ts'
let fail = 0
const eq = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }

// ---- dates
eq('a Date uses its local calendar day', toYmd(new Date(2026, 0, 1)), '2026-01-01')
eq('an Excel serial', toYmd(46023), '2026-01-01')
eq('a serial with a time of day stays on its day', toYmd(46023.75), '2026-01-01')
eq('a date string', toYmd('2026-03-02 00:00:00'), '2026-03-02')
eq('a normal hours number is not a date', toYmd(8), null)
eq('garbage is not a date', toYmd('#VALUE!'), null)

// ---- one day: every spelling seen in the real remarks
const c = (h, r) => classifyDay(h, r).cls
for (const r of ['Vacation Leave', 'VL', 'VL ', 'Vacation leave', 'Leave', 'Time Off']) eq(`vacation: ${r}`, c(0, r), 'vl')
for (const r of ['Sick Leave', 'SL', 'Sick Leave ', 'Medical Leave', 'MEC']) eq(`sick: ${r}`, c(0, r), 'sl')
eq('emergency leave', c(0, 'Emergency Leave'), 'el'); eq('EL', c(0, 'EL'), 'el')
eq('Absent with a trailing space', c(0, 'Absent '), 'absent'); eq('no show is an absence', c(0, 'No show - extended leave not approved'), 'absent')
eq('Halfday', c(4, 'Halfday'), 'halfday'); eq('Half Day', c(4, 'Half Day'), 'halfday'); eq('4 hours with no remark is a half day', c(4, null), 'halfday')
eq('a 4-hour day that is also "late 3.98" is one half day, not also late', classifyDay(4, 3.98), { cls: 'halfday', lateHours: 0, undertimeHours: 0 })
eq('Slide Shift counts as present', c(8, 'Slide Shift'), 'slide'); eq('slide shift with a time', c(8, 'Slide shift 11am-8pm'), 'slide')
eq('Holiday', c(0, 'Holiday'), 'holiday'); eq('Resigned is not an absence', c(0, 'Resigned'), 'separated')
eq('a number is hours late', classifyDay(8, 0.32), { cls: 'late', lateHours: 0.32, undertimeHours: 0 })
for (const r of ['Failure to Clock Out', 'FAILURE TO CLOCK IN/OUT', 'Non-Billable', 'RDOT', '2 hours OT', 'Not logged in due to no access']) eq(`admin note is still present: ${r}`, c(8, r), 'present')
eq('overtime hours are present', c(10, null), 'present'); eq('a normal day', c(8, null), 'present')
eq('0 hours and no remark is NO DATA, not an absence', c(0, null), 'nodata'); eq('blank hours and no remark', c(null, null), 'present')
eq('a short day records undertime', classifyDay(6.85, null), { cls: 'present', lateHours: 0, undertimeHours: 1.1500000000000004 })

// ---- finding the log on messy sheets
const hdr = ['Contractor', 'Designation', 'Task', 'Date', 'Hours', 'Remarks', null, 'Contractor', 'Manual Tracked Hours']
const sheet1 = { name: 'Jan.1-15.2026', rows: [hdr, ['Ana', 'AP', 'X', new Date(2026, 0, 5), 8, null, null, 'SUMMARY NAME', 160], ['Ana', 'AP', 'X', new Date(2025, 11, 31), 8, null]] }
const sheet2 = { name: 'Sept. 16-30', rows: [['Contractor', 'Designation', 'Task', 'Date', ' ', 'Remarks'], ['Ben', 'AP', 'X', '2026-09-16 00:00:00', 8, 'Sick Leave']] }
const sheet3 = { name: 'Late header', rows: [['Cut-off Jan 1-15'], hdr, ['Cy', 'AP', 'X', 46030, 0, 'Holiday']] }
const junk = { name: 'Pivot', rows: [['Contractor', 'Total'], ['A', 1]] }
const ex = extractDayRows([sheet1, sheet2, sheet3, junk], 2026)
eq('finds rows on three differently built sheets', ex.rows.map(r => `${r.name}:${r.date}`), ['Ana:2026-01-05', 'Ben:2026-09-16', 'Cy:2026-01-08'])
eq('the summary block is not read as people', ex.rows.some(r => r.name === 'SUMMARY NAME'), false)
eq('rows from other years are counted, not used', ex.otherYears, 1)
eq('a sheet with a blank Hours header still reads hours', ex.rows.find(r => r.name === 'Ben').hours, 8)
eq('sheets without a log are skipped', ex.sheetsUsed.map(s => s.name), ['Jan.1-15.2026', 'Sept. 16-30', 'Late header'])

// ---- duplicates
const D = (person, date, hours, remark, order, sheet = 's') => ({ sheet, name: person, person, date, hours, remark, order })
const dd = dedupeRows([D('a', '2026-03-02', 0, null, 1, 'Feb.16-28'), D('a', '2026-03-02', 8, null, 2, 'March.1-15'), D('b', '2026-01-16', 8, null, 3), D('b', '2026-01-16', 8, null, 4), D('c', '2026-01-27', 0, null, 5), D('c', '2026-01-27', 8, null, 6)])
eq('the real row beats the blank placeholder', dd.rows.find(r => r.person === 'a').hours, 8)
eq('identical copies collapse to one', dd.rows.filter(r => r.person === 'b').length, 1)
eq('counted duplicates', dd.duplicates, 3)
eq('only genuinely different rows are conflicts', dd.conflicts, 2)
eq('two real rows: the later sheet wins', dedupeRows([D('z', '2026-05-04', 8, null, 1), D('z', '2026-05-04', 0, 'VL', 2)]).rows[0].remark, 'VL')

// ---- the month
const days = (person, specs, month = '2026-04') => specs.map(([d, h, r], i) => D(person, `${month}-${String(d).padStart(2, '0')}`, h, r, i))
const att = (rows, o = DEFAULT_OPTIONS) => aggregateAttendance(rows, o)
const perfect = days('p', [1, 2, 3, 6, 7, 8, 9, 10].map(d => [d, 8, null]))
eq('a clean month is 100', att(perfect)[0].pct, 100)
eq('holidays do not count against anyone', att([...perfect, D('p', '2026-04-03', 0, 'Holiday', 99)])[0].pct, 100)
const oneSL = days('s', [[1, 8, null], [2, 8, null], [3, 8, null], [6, 8, null], [7, 8, null], [8, 8, null], [9, 8, null], [10, 8, null], [13, 8, null], [14, 0, 'Sick Leave']])
eq('1 sick day out of 10 = 90', att(oneSL)[0].pct, 90)
const half = days('h', [[1, 8, null], [2, 8, null], [3, 8, null], [6, 8, null], [7, 8, null], [8, 8, null], [9, 8, null], [10, 8, null], [13, 8, null], [14, 4, 'Halfday']])
eq('a half day is half an absence = 95', att(half)[0].pct, 95)
const vl = days('v', [[1, 8, null], [2, 8, null], [3, 8, null], [6, 8, null], [7, 0, 'VL'], [8, 0, 'VL']])
eq('vacation is excused by default: 4 of 4 days = 100', att(vl)[0].pct, 100)
eq('...and counts as absence when switched on: 4 of 6', att(vl, { ...DEFAULT_OPTIONS, countVacation: true })[0].pct, 66.67)
const late = days('l', [[1, 8, null], [2, 8, 4]])
eq('4 hours late = 2.5 points (5 per 8 hours)', att(late)[0].pct, 97.5)
eq('slide shift does not lower attendance', att(days('sl', [[1, 8, 'Slide Shift'], [2, 8, null]]))[0].pct, 100)
const feb = days('f', Array.from({ length: 9 }, (_, i) => [i + 1, 0, null]), '2026-02')
eq('an unfilled month has NO score, not a zero', [att(feb)[0].pct, att(feb)[0].flags[0]], [null, 'No data in the sheet for this month'])
const mixed = [...days('m', [[1, 8, null], [2, 8, null], [3, 8, null], [4, 8, null], [5, 8, null]]), ...days('m', [[16, 0, null], [17, 0, null]])]
eq('blank days are left out and flagged', [att(mixed)[0].pct, att(mixed)[0].flags], [100, ['2 blank days not counted']])
eq('days after leaving are not absences', att([...days('r', [[1, 8, null], [2, 8, null], [3, 8, null], [4, 8, null], [5, 8, null]]), ...days('r', [[6, 0, 'Resigned'], [7, 0, 'Resigned']])])[0].pct, 100)
eq('months are separate per person', att([...perfect, ...days('q', [[1, 8, null]], '2026-05')]).map(a => a.person + a.month), ['p2026-04', 'q2026-05'])
eq('hours and last day are tracked', [att(perfect)[0].hours, att(perfect)[0].lastDate], [64, '2026-04-10'])
eq('score can never go below 0', att(days('z', [[1, 0, 'Absent'], [2, 0, 'Absent']]))[0].pct, 0)
eq('few days recorded is flagged', att(days('t', [[1, 8, null], [2, 8, null]]))[0].flags, ['Only a few days recorded'])
eq('month label matches the KPI convention', monthLabelOf('2026-09'), 'September 2026')

// ---- the explanation behind each number (Molina, September: 21 present + 1 emergency leave)
const mol = days('molina', [...Array.from({ length: 21 }, (_, i) => [i + 1, 8, null]), [22, 0, 'Emergency Leave']], '2026-09')
const mo = att(mol)[0]
eq('Molina: 22 scheduled, 1 lost, 95.45', [mo.scheduled, mo.lost, mo.pct], [22, 1, 95.45])
eq('Molina: the one day that explains it', mo.events.map(e => `${e.date} ${e.kind} ${e.remark}`), ['2026-09-22 el Emergency Leave'])
const lates = att(days('lt', [[3, 8, 0.5], [1, 8, null], [2, 8, 'Late'], [4, 8, 0.03]]))[0]
eq('lates are listed in date order with their hours', lates.events.map(e => `${e.date.slice(8)}:${e.kind}:${e.lateHours}`), ['02:late:0', '03:late:0.5', '04:late:0.03'])
eq('late count and hours', [lates.lateDays, Math.round(lates.lateHours * 100) / 100], [3, 0.53])
eq('late points: 0.53 h of 8 = 0.33 points', lates.deduction, 0.33)
eq('a clean month has no events', att(perfect)[0].events.length, 0)
eq('a holiday is not an event', att([...perfect, D('p', '2026-04-03', 0, 'Holiday', 99)])[0].events.length, 0)
eq('a short day is listed as short', att(days('sd', [[1, 8, null], [2, 6.85, null], [3, 8, null], [6, 8, null], [7, 8, null]]))[0].events.map(e => e.kind), ['short'])

// ---- names (the real awkward ones)
eq('accents and punctuation ignored', nameKey('Muñez,  Rose Ann.'), 'munez rose ann')
eq('order does not matter', nameScore('Miking, Genefer Castro', 'Genefer Castro Miking'), 1)
eq('a spelling slip is tolerated (Jenefer / Jennifer)', nameScore('Balingit, Jennifer Manese', 'Balingit, Jenefer Manese'), 1)
eq('Muñez / Muñoz', nameScore('Muñez, Rose Ann', 'Muñoz, Rose Ann'), 1)
const cands = [
  { id: 'azeliza', names: ['Latimer, Azeliza', 'Ignacio, Azeliza'] }, { id: 'precilla', names: ['Cornel, Precilla Guillermo'] },
  { id: 'jenefer', names: ['Balingit, Jenefer Manese'] }, { id: 'rose', names: ['Muñoz, Rose Ann'] }, { id: 'mary1', names: ['Santos, Mary Ann'] }, { id: 'mary2', names: ['Reyes, Mary Ann'] },
]
eq('old surname matched through the KPI history', matchName('Ignacio, Azeliza', cands).id, 'azeliza')
eq('full vs short name', matchName('Cornel, Precilla G', cands).id, 'precilla')
eq('Jennifer matches the Jenefer record', matchName('Balingit, Jennifer Manese', cands).id, 'jenefer')
eq('two people share a first name only: not guessed', matchName('Cruz, Mary Ann', cands).status, 'none')
eq('an unknown person is left for review', matchName('Nobody, Nemo', cands).status, 'none')
eq('a genuine tie is ambiguous, never a guess', matchName('Mary Ann', [{ id: 'a', names: ['Santos, Mary Ann'] }, { id: 'b', names: ['Reyes, Mary Ann'] }]).status, 'ambiguous')

// ---- applying to the scorecard
eq('missing accuracy leaves the overall blank (this was the 0.20 bug)', recomputeOverall(1, { accuracy: null, efficiency: null, feedback: null }), null)
eq('all three present: the standard weights', Math.round(recomputeOverall(1, { accuracy: 1, efficiency: 1, feedback: 1, compliance_score: 1 }) * 1000) / 1000, 1)
eq('weights: attendance 20, accuracy 30, efficiency 30, feedback 15, compliance 5', Math.round(recomputeOverall(0.9, { accuracy: 0.98, efficiency: 0.96, feedback: 0.9, compliance_score: 1 }) * 10000) / 10000, 0.947)
eq('no compliance yet still gives a score', Math.round(recomputeOverall(1, { accuracy: 1, efficiency: 1, feedback: 1 }) * 100) / 100, 0.95)
eq('a zero in a part counts as not entered', recomputeOverall(1, { accuracy: 0, efficiency: 0.9, feedback: 0.9 }), null)

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)

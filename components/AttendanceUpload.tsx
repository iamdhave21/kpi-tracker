'use client'
import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import { supabase, Employee, KpiRecord } from '@/lib/supabase'
import { extractDayRows, dedupeRows, aggregateAttendance, matchName, nameKey, recomputeOverall, monthLabelOf, DayRow, MonthAttendance, DayEvent, Match } from '@/lib/attendance'

// Upload the AB Time Tracker workbook -> the portal finds the daily logs (by their dates, not sheet names),
// works out each ACTIVE employee's attendance per month, shows it NEXT TO what the scorecard has now, and
// applies it only when you say so. People who are inactive or not in the portal are left out. 2026 only.
// Rules and tests: lib/attendance.ts.

const YEAR = 2026
const MAP_KEY = 'abbss-attendance-name-map-v1'
const inputCls = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900'
type Audit = (action: string, by: string, name: string, month: string, field: string, from: string, to: string) => Promise<void> | void
type Person = { id: string, ids: string[], name: string, emp: Employee, active: boolean, names: string[] }
type Parsed = { fileName: string, sheetsRead: number, rows: DayRow[], sheetsUsed: { name: string, rows: number }[], otherYears: number }
type Left = { key: string, name: string, reason: 'inactive' | 'unknown' | 'ambiguous', rows: number, match: Match }

const pctText = (v: number | null | undefined) => v === null || v === undefined ? '—' : (v * 100).toFixed(2) + '%'
const fmtNum = (n: number) => (Math.round(n * 100) / 100).toString()
const minutes = (h: number) => { const m = Math.round(h * 60); return m < 1 && h > 0 ? '<1 min' : `${m} min` }
const dayText = (ymd: string) => new Date(ymd + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
const KIND: Record<string, { label: string, cls: string }> = {
  late: { label: 'Late', cls: 'bg-amber-50 text-amber-700 border-amber-200' }, short: { label: 'Short day', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  halfday: { label: 'Half day', cls: 'bg-orange-50 text-orange-700 border-orange-200' }, sl: { label: 'Sick leave', cls: 'bg-red-50 text-red-700 border-red-200' },
  el: { label: 'Emergency leave', cls: 'bg-red-50 text-red-700 border-red-200' }, absent: { label: 'Absent', cls: 'bg-red-50 text-red-700 border-red-200' },
  vl: { label: 'Vacation', cls: 'bg-blue-50 text-blue-700 border-blue-200' }, slide: { label: 'Slide shift', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  nodata: { label: 'Blank day', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
}
function loadMap(): Record<string, string> { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}') } catch { return {} } }
function saveMap(m: Record<string, string>) { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)) } catch { /* private mode: the choice just will not be remembered */ } }

export default function AttendanceUpload({ employees, records, currentUser, showToast, onApplied, writeAudit }: {
  employees: Employee[], records: KpiRecord[], currentUser: string | null,
  showToast: (m: string, t?: 'success' | 'error') => void, onApplied: () => void, writeAudit: Audit,
}) {
  const [stage, setStage] = useState<'idle' | 'reading' | 'ready'>('idle')
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [countVacation, setCountVacation] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [month, setMonth] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number, total: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  useEffect(() => { setOverrides(loadMap()) }, [])

  // One entry per PERSON (a person can have an employee row per client); names include their KPI history,
  // which is how "Ignacio, Azeliza" finds "Latimer, Azeliza".
  const people: Person[] = useMemo(() => {
    const groups = new Map<string, Employee[]>()
    for (const e of employees) { const k = nameKey(e.name); groups.set(k, [...(groups.get(k) || []), e]) }
    return Array.from(groups.values()).map(es => {
      const ids = es.map(e => e.id), names = new Set<string>(es.map(e => e.name))
      for (const r of records) if (ids.includes(r.employee_id) && r.employee_name) names.add(r.employee_name)
      const primary = es.find(e => e.active) || es[0]
      return { id: primary.id, ids, name: primary.name, emp: primary, active: es.some(e => e.active), names: Array.from(names) }
    })
  }, [employees, records])
  const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const activePeople = useMemo(() => people.filter(p => p.active).sort((a, b) => a.name.localeCompare(b.name)), [people])

  async function handleFile(file: File) {
    setError(''); setStage('reading'); setParsed(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      // Raw Excel numbers for dates (no JavaScript Date), so a time zone can never move a day.
      const wb = XLSX.read(buf, { type: 'array', cellDates: false })
      const sheets = wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) as any[][] }))
      const ex = extractDayRows(sheets, YEAR)
      if (!ex.rows.length) { setError(`No daily logs dated ${YEAR} were found in this file. It should have sheets with the columns Contractor, Designation, Task, Date, Hours, Remarks.`); setStage('idle'); return }
      setParsed({ fileName: file.name, sheetsRead: wb.SheetNames.length, rows: ex.rows, sheetsUsed: ex.sheetsUsed, otherYears: ex.otherYears })
      setStage('ready')
    } catch (e: any) {
      setError('Could not read that file: ' + (e?.message || 'unknown error')); setStage('idle')
    }
  }

  // Match names -> ACTIVE people only; merge spellings, drop duplicate days, compute each month.
  // Anyone inactive, not in the portal, or not clearly matched is LEFT OUT (listed, never applied).
  const model = useMemo(() => {
    if (!parsed) return null
    const cands = people.map(p => ({ id: p.id, names: p.names }))
    const display = new Map<string, string>(), rowCount = new Map<string, number>()
    for (const r of parsed.rows) { const k = nameKey(r.name); display.set(k, r.name); rowCount.set(k, (rowCount.get(k) || 0) + 1) }
    const toPerson = new Map<string, string>(), leftOut: Left[] = []
    display.forEach((disp, k) => {
      const o = overrides[k]
      const m: Match = o && o !== '__skip' ? { id: o, score: 1, runnerUp: 0, status: 'matched', top: [] } : matchName(disp, cands)
      const p = m.id ? personById.get(m.id) : undefined
      if (p && p.active) { toPerson.set(k, p.id); return }
      leftOut.push({ key: k, name: disp, rows: rowCount.get(k) || 0, match: m, reason: p ? 'inactive' : m.status === 'ambiguous' ? 'ambiguous' : 'unknown' })
    })
    const prepared = parsed.rows.filter(r => toPerson.has(nameKey(r.name))).map(r => ({ ...r, person: 'emp:' + toPerson.get(nameKey(r.name)) }))
    const dd = dedupeRows(prepared)
    const months = aggregateAttendance(dd.rows, { countVacation, latePointsPer8h: 5 })
    return { dd, months, nodata: months.reduce((s, m) => s + m.nodata, 0), peopleIn: display.size, matched: toPerson.size, leftOut: leftOut.sort((a, b) => a.name.localeCompare(b.name)) }
  }, [parsed, people, personById, overrides, countVacation])

  const monthList = useMemo(() => Array.from(new Set((model?.months || []).map(m => m.month))).sort(), [model])
  useEffect(() => { if (monthList.length && !monthList.includes(month)) setMonth(monthList[monthList.length - 1]) }, [monthList]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (model?.months || []).filter(m => m.month === month).map(m => {
    const p = personById.get(m.person.slice(4)) as Person
    const label = monthLabelOf(m.month)
    const recs = records.filter(r => p.ids.includes(r.employee_id) && r.month_label === label)
    const cur = recs.map(r => r.attendance).filter((v): v is number => typeof v === 'number')
    return { m, p, label, current: cur.length ? cur.reduce((a, b) => a + b, 0) / cur.length : null, recCount: recs.length }
  }), [model, month, personById, records])

  // Tick everyone who can be applied whenever the month or the data changes.
  useEffect(() => { setSelected(new Set(rows.filter(r => r.m.pct !== null).map(r => r.m.person))); setOpen(new Set()) }, [month, model]) // eslint-disable-line react-hooks/exhaustive-deps

  const eligible = rows.filter(r => r.m.pct !== null)
  const chosen = eligible.filter(r => selected.has(r.m.person))
  const thisMonth = new Date().toISOString().slice(0, 7)
  const lateRows = rows.filter(r => r.m.lateDays > 0)
  const allLates = useMemo(() => (model?.months || []).flatMap(m => m.events.filter(e => e.kind === 'late').map(e => ({ name: (personById.get(m.person.slice(4)) as Person)?.name || m.name, ...e }))).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)), [model, personById])

  const include = (key: string, id: string) => { const next = { ...overrides, [key]: id }; setOverrides(next); saveMap(next) }

  const applyRow = useCallback(async (m: MonthAttendance, p: Person) => {
    const label = monthLabelOf(m.month), fraction = (m.pct as number) / 100
    const absent = m.lost, lateH = m.lateHours, underH = m.undertimeHours
    const { error: e1 } = await supabase.from('time_tracker_periods').upsert({
      employee_id: p.id, employee_id_code: p.emp.employee_id || ('NAME-' + nameKey(p.name).replace(/ /g, '-')), employee_name: p.name,
      period_label: `${label} (workbook)`, month_label: label,
      basic_hours_worked: m.hours, days_worked: m.scheduled, absent_days: absent,
      late_hours: Math.floor(lateH), late_mins: Math.round((lateH - Math.floor(lateH)) * 60),
      undertime_hours: Math.floor(underH), undertime_mins: Math.round((underH - Math.floor(underH)) * 60),
      total_sd_hours: absent * 8, holiday_days: m.holidays, restday_days: 0, overtime_hours: 0, night_diff_days: 0, night_diff_ot_hours: 0,
      billable_hours: m.hours, non_billable_hours: 0, computed_attendance_pct: m.pct,
      uploaded_by: currentUser, applied_to_attendance: true, applied_at: new Date().toISOString(),
    }, { onConflict: 'employee_id_code,period_label' })
    if (e1) throw new Error(e1.message)
    // Every KPI record of this person for the month (there can be one per process); none yet -> create one.
    const existing = records.filter(r => p.ids.includes(r.employee_id) && r.month_label === label)
    if (existing.length) {
      for (const rec of existing) {
        // The overall score is only recomputed when accuracy, efficiency and feedback are entered; otherwise it
        // stays blank (this is what stops the "0.20" months).
        const overall = recomputeOverall(fraction, rec)
        const { error: e2 } = await supabase.from('kpi_records').update({ attendance: fraction, overall_score: overall, updated_at: new Date().toISOString() }).eq('id', rec.id)
        if (e2) throw new Error(e2.message)
        await writeAudit('APPLY_ATTENDANCE_UPLOAD', currentUser || '', p.name, label, 'Attendance', pctText(rec.attendance), pctText(fraction))
      }
    } else {
      const { error: e3 } = await supabase.from('kpi_records').insert({ employee_id: p.id, employee_name: p.name, designation: p.emp.designation || '', month_label: label, attendance: fraction, overall_score: null, updated_at: new Date().toISOString() })
      if (e3) throw new Error(e3.message)
      await writeAudit('APPLY_ATTENDANCE_UPLOAD', currentUser || '', p.name, label, 'Attendance', 'N/A', pctText(fraction))
    }
  }, [records, currentUser, writeAudit])

  async function applyList(list: { m: MonthAttendance, p: Person }[]) {
    if (!list.length) { showToast('Nothing selected to apply.', 'error'); return }
    setProgress({ done: 0, total: list.length })
    let ok = 0; const failed: string[] = []
    for (let i = 0; i < list.length; i++) {
      try { await applyRow(list[i].m, list[i].p); ok++ } catch (e: any) { failed.push(`${list[i].p.name} (${monthLabelOf(list[i].m.month)}): ${e?.message || 'failed'}`) }
      setProgress({ done: i + 1, total: list.length })
    }
    setProgress(null)
    onApplied()
    if (failed.length) showToast(`Applied ${ok} of ${list.length}. First problem: ${failed[0]}`, 'error')
    else showToast(`Attendance applied for ${ok} ${ok === 1 ? 'person-month' : 'person-months'}.`, 'success')
  }
  const applyAllMonths = () => {
    if (!model) return
    const list = model.months.filter(m => m.pct !== null).map(m => ({ m, p: personById.get(m.person.slice(4)) as Person })).filter(x => x.p)
    if (confirm(`Apply attendance for ${list.length} person-months across ${monthList.length} months? Existing attendance for those months will be replaced (each change is logged).`)) applyList(list)
  }
  const explain = (m: MonthAttendance) => {
    const counted = m.scheduled, base = counted ? ((counted - m.lost) / counted) * 100 : 0
    return `${counted} scheduled days − ${fmtNum(m.lost)} lost = ${base.toFixed(2)}%` + (m.deduction > 0 ? `, minus ${m.deduction} for late/short time` : '') + ` → ${m.pct === null ? 'no score' : m.pct.toFixed(2) + '%'}`
  }
  const leftReason = { inactive: 'Inactive in the portal', unknown: 'Not found in the portal', ambiguous: 'Could be several people' }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-blue-900">Upload the attendance workbook</h3>
        <p className="text-xs text-gray-500 mt-0.5">Use the AB Time Tracker file (.xlsx). The portal finds the daily logs dated {YEAR}, works out each <b>active</b> employee&apos;s attendance per month, and shows it next to what the scorecard has now. People who are inactive or not in the portal are left out. Nothing changes until you apply. Upload the same file again with new months whenever you have them.</p>
      </div>

      <label onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
        className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl px-4 py-6 text-sm cursor-pointer transition ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
        <span className="font-medium text-gray-700">{stage === 'reading' ? 'Reading the workbook…' : 'Choose the workbook, or drop it here'}</span>
        <span className="text-xs text-gray-400">{parsed ? `Loaded: ${parsed.fileName}` : '.xlsx or .xlsm, any number of months'}</span>
        <input type="file" accept=".xlsx,.xlsm" className="hidden" disabled={stage === 'reading'} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </label>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {parsed && model && (<>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-1">
          <p><b>What was recognised:</b> {parsed.sheetsRead} sheets read, {parsed.sheetsUsed.length} with daily logs dated {YEAR}, {parsed.rows.length.toLocaleString()} daily rows ({parsed.otherYears.toLocaleString()} rows from other years ignored).</p>
          <p><b>People:</b> {model.peopleIn} in the workbook, <b>{model.matched} active employees included</b>, {model.leftOut.length} left out (inactive or not in the portal).</p>
          <p>{model.dd.duplicates} repeated days removed (some sheets repeat the next half-month){model.dd.conflicts ? `, ${model.dd.conflicts} where two sheets disagreed: the later sheet was used` : ''}. {model.nodata > 0 && <>{model.nodata} blank days (0 hours, no remark) are <b>not counted</b> as absences.</>}</p>
        </div>

        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer text-blue-700 font-medium">How attendance is calculated</summary>
          <ul className="list-disc ml-5 mt-2 space-y-0.5">
            <li>Each person&apos;s scheduled days are the weekdays in their log. <b>Holidays</b> and days after resigning are left out.</li>
            <li><b>Sick leave, emergency leave and absences</b> count against attendance. A <b>half day</b> counts as half an absence.</li>
            <li><b>Late or short hours</b> take off 5 points per 8 hours (same as the Time Tracker), so a 2-minute late costs about 0.02 points. Slide shifts and clock-in notes do not count against anyone.</li>
            <li><b>Blank days</b> (0 hours, no remark) are treated as missing data, not absences, and flagged.</li>
            <li>The overall KPI score is only recalculated when accuracy, efficiency and feedback are already entered.</li>
          </ul>
          <label className="flex items-center gap-2 mt-2 text-gray-700"><input type="checkbox" checked={countVacation} onChange={e => setCountVacation(e.target.checked)} /> Count approved vacation leave as an absence (off by default: vacation is excused)</label>
        </details>

        <div className="flex flex-wrap gap-1.5">
          {monthList.map(mo => {
            const n = model.months.filter(m => m.month === mo && m.pct !== null).length
            return <button key={mo} onClick={() => setMonth(mo)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${mo === month ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{monthLabelOf(mo).replace(` ${YEAR}`, '')} <span className="opacity-70">({n})</span></button>
          })}
        </div>

        {month === thisMonth && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This month is still in progress. Apply it again after the next upload to include the rest of the days.</p>}

        <p className={`text-xs rounded-lg px-3 py-2 border ${lateRows.length ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {lateRows.length === 0
            ? `No late entries for active employees in ${month ? monthLabelOf(month) : 'this month'}.`
            : <><b>Late in {monthLabelOf(month)}:</b> {lateRows.map(r => `${r.p.name} (${r.m.lateDays} ${r.m.lateDays === 1 ? 'day' : 'days'}, ${minutes(r.m.lateHours)})`).join('; ')}.</>}
        </p>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left"><tr>
              <th className="px-2 py-2"><input type="checkbox" aria-label="Select all" checked={eligible.length > 0 && chosen.length === eligible.length} onChange={e => setSelected(e.target.checked ? new Set(eligible.map(r => r.m.person)) : new Set())} /></th>
              <th className="px-2 py-2">Employee</th><th className="px-2 py-2 text-right">Days</th><th className="px-2 py-2 text-right">Sick / emerg. / absent</th><th className="px-2 py-2 text-right">Half days</th><th className="px-2 py-2 text-right">Vacation</th><th className="px-2 py-2 text-right">Late</th>
              <th className="px-2 py-2 text-right">In the scorecard now</th><th className="px-2 py-2 text-right">From the workbook</th><th className="px-2 py-2 text-right">Change</th><th className="px-2 py-2">Notes</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const { m } = r, can = m.pct !== null, isOpen = open.has(m.person)
                const delta = can && r.current !== null ? (m.pct as number) - r.current * 100 : null
                const abs = m.sl + m.el + m.absent
                return (
                  <Fragment key={m.person}>
                    <tr className="border-t border-gray-100 align-top">
                      <td className="px-2 py-2"><input type="checkbox" disabled={!can} checked={can && selected.has(m.person)} aria-label={`Apply ${r.p.name}`} onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked) n.add(m.person); else n.delete(m.person); return n })} /></td>
                      <td className="px-2 py-2"><div className="font-medium text-gray-900">{r.p.name}</div>
                        <button onClick={() => setOpen(s => { const n = new Set(s); if (n.has(m.person)) n.delete(m.person); else n.add(m.person); return n })} className="text-[11px] text-blue-600 hover:underline">{isOpen ? 'Hide details' : 'Show details'}</button></td>
                      <td className="px-2 py-2 text-right">{m.scheduled}</td>
                      <td className="px-2 py-2 text-right">{abs || '—'}{abs > 0 && <span className="text-gray-400"> ({[m.sl && `${m.sl} SL`, m.el && `${m.el} EL`, m.absent && `${m.absent} abs`].filter(Boolean).join(', ')})</span>}</td>
                      <td className="px-2 py-2 text-right">{m.halfdays || '—'}</td>
                      <td className="px-2 py-2 text-right">{m.vl || '—'}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{m.lateDays || m.undertimeHours ? <span className="text-amber-700">{m.lateDays ? `${m.lateDays} ${m.lateDays === 1 ? 'day' : 'days'}, ${minutes(m.lateHours)}` : `short ${minutes(m.undertimeHours)}`}</span> : '—'}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{r.current === null ? '—' : (r.current * 100).toFixed(2) + '%'}</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-900">{m.pct === null ? '—' : m.pct.toFixed(2) + '%'}</td>
                      <td className={`px-2 py-2 text-right ${delta === null ? 'text-gray-300' : delta < -0.05 ? 'text-red-600' : delta > 0.05 ? 'text-emerald-600' : 'text-gray-400'}`}>{delta === null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(2)}</td>
                      <td className="px-2 py-2 text-gray-500">{[...m.flags, r.recCount > 1 ? `${r.recCount} KPI records will be updated` : ''].filter(Boolean).join('. ')}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/60"><td></td><td colSpan={10} className="px-2 py-2">
                        <p className="text-gray-700"><b>How this was built:</b> {explain(m)}{m.holidays ? `. ${m.holidays} holiday${m.holidays === 1 ? '' : 's'} not counted` : ''}{!countVacation && m.vl ? `. ${m.vl} vacation day${m.vl === 1 ? '' : 's'} excused` : ''}.</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {m.events.length === 0 && <span className="text-gray-400">No late, leave, half-day or blank days this month.</span>}
                          {m.events.map((e: DayEvent, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded-full border ${KIND[e.kind]?.cls || ''}`}>{dayText(e.date)}: {KIND[e.kind]?.label || e.kind}{e.kind === 'late' && e.lateHours ? ` ${minutes(e.lateHours)}` : ''}{e.remark && e.kind !== 'late' ? ` (${e.remark})` : ''}</span>))}
                        </div>
                      </td></tr>)}
                  </Fragment>)
              })}
              {rows.length === 0 && <tr><td className="px-3 py-4 text-gray-400" colSpan={11}>No active employees recorded for this month.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!!progress || chosen.length === 0} onClick={() => applyList(chosen.map(r => ({ m: r.m, p: r.p })))} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">Apply {chosen.length} selected for {month ? monthLabelOf(month) : '…'}</button>
          <button disabled={!!progress} onClick={applyAllMonths} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Apply every month</button>
          {progress && <span className="text-xs text-gray-500" role="status">Applying {progress.done} of {progress.total}…</span>}
        </div>
        <p className="text-xs text-gray-400">Applying replaces the attendance score for that person and month, recalculates the overall score only when the other scores are entered, and writes each change to the audit log.</p>

        <details className="text-xs text-gray-600 border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-blue-700 font-medium">All late entries in {YEAR} ({allLates.length})</summary>
          {allLates.length === 0 ? <p className="mt-2 text-gray-400">No late entries for active employees.</p> : (
            <div className="mt-2 overflow-x-auto"><table className="text-xs"><thead className="text-gray-500 text-left"><tr><th className="pr-4 py-1">Date</th><th className="pr-4 py-1">Employee</th><th className="py-1">Late by</th></tr></thead>
              <tbody>{allLates.map((l, i) => <tr key={i} className="border-t border-gray-100"><td className="pr-4 py-1 whitespace-nowrap">{dayText(l.date)}</td><td className="pr-4 py-1">{l.name}</td><td className="py-1">{l.lateHours ? minutes(l.lateHours) : 'noted, no time given'}</td></tr>)}</tbody></table></div>)}
        </details>

        {model.leftOut.length > 0 && (
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer text-gray-500 font-medium">Left out ({model.leftOut.length}): inactive or not in the portal</summary>
            <ul className="mt-2 space-y-1.5">
              {model.leftOut.map(l => (
                <li key={l.key} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-800">{l.name}</span><span className="text-gray-400">{leftReason[l.reason]}, {l.rows} daily rows</span>
                  {l.reason !== 'inactive' && (
                    <select className={`${inputCls} text-xs`} value="" onChange={e => e.target.value && include(l.key, e.target.value)} aria-label={`Include ${l.name} as an active employee`}>
                      <option value="">Include as an employee…</option>
                      {[...(l.match.top || []).map(t => personById.get(t.id)).filter((p): p is Person => !!p && p.active), ...activePeople].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>)}
                </li>))}
            </ul>
          </details>)}
      </>)}
    </div>
  )
}

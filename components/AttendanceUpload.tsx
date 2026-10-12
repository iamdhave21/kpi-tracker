'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase, Employee, KpiRecord } from '@/lib/supabase'
import { extractDayRows, dedupeRows, aggregateAttendance, matchName, nameKey, recomputeOverall, monthLabelOf, DayRow, MonthAttendance, Match } from '@/lib/attendance'

// Upload the AB Time Tracker workbook -> the portal finds the daily logs (by their dates, not sheet names),
// works out each person's attendance per month, shows it NEXT TO what the scorecard has now, and applies it
// only when you say so. 2026 only. Rules and tests: lib/attendance.ts.

const YEAR = 2026
const MAP_KEY = 'abbss-attendance-name-map-v1'
const inputCls = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900'
type Audit = (action: string, by: string, name: string, month: string, field: string, from: string, to: string) => Promise<void> | void
type Person = { id: string, ids: string[], name: string, emp: Employee, active: boolean, names: string[] }
type Parsed = { fileName: string, sheetsRead: number, rows: DayRow[], sheetsUsed: { name: string, rows: number }[], otherYears: number }

const pctText = (v: number | null | undefined) => v === null || v === undefined ? '—' : (v * 100).toFixed(2) + '%'
const fmtNum = (n: number) => (Math.round(n * 100) / 100).toString()

function loadMap(): Record<string, string> { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}') } catch { return {} } }
function saveMap(m: Record<string, string>) { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)) } catch { /* private mode: the mapping just won't be remembered */ } }

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

  // Match names -> people, merge spellings, drop duplicate days, compute each month.
  const model = useMemo(() => {
    if (!parsed) return null
    const cands = people.map(p => ({ id: p.id, names: p.names }))
    const display = new Map<string, string>()
    for (const r of parsed.rows) display.set(nameKey(r.name), r.name)
    const matches = new Map<string, Match>(), toPerson = new Map<string, string | null>()
    display.forEach((disp, k) => {
      const o = overrides[k]
      if (o !== undefined) { const id = o === '__skip' ? null : o; matches.set(k, { id, score: 1, runnerUp: 0, status: id ? 'matched' : 'none', top: [] }); toPerson.set(k, id); return }
      const m = matchName(disp, cands); matches.set(k, m); toPerson.set(k, m.id)
    })
    const prepared = parsed.rows.map(r => { const id = toPerson.get(nameKey(r.name)); return { ...r, person: id ? 'emp:' + id : 'name:' + nameKey(r.name) } })
    const dd = dedupeRows(prepared)
    const months = aggregateAttendance(dd.rows, { countVacation, latePointsPer8h: 5 })
    const nodata = months.reduce((s, m) => s + m.nodata, 0)
    const names = Array.from(display.keys())
    const matchedNames = names.filter(k => toPerson.get(k))
    return { matches, display, toPerson, dd, months, nodata, names, matchedCount: matchedNames.length }
  }, [parsed, people, overrides, countVacation])

  const monthList = useMemo(() => Array.from(new Set((model?.months || []).map(m => m.month))).sort(), [model])
  useEffect(() => { if (monthList.length && !monthList.includes(month)) setMonth(monthList[monthList.length - 1]) }, [monthList]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (model?.months || []).filter(m => m.month === month).map(m => {
    const isEmp = m.person.startsWith('emp:'), p = isEmp ? personById.get(m.person.slice(4)) : undefined
    const label = monthLabelOf(m.month)
    const recs = p ? records.filter(r => p.ids.includes(r.employee_id) && r.month_label === label) : []
    const cur = recs.map(r => r.attendance).filter((v): v is number => typeof v === 'number')
    const current = cur.length ? cur.reduce((a, b) => a + b, 0) / cur.length : null
    const nameK = isEmp ? '' : m.person.slice(5)
    return { m, p, label, current, recCount: recs.length, nameK, match: nameK ? model!.matches.get(nameK) : undefined, display: p ? p.name : m.name }
  }), [model, month, personById, records])

  // Tick everyone who can be applied whenever the month or the data changes.
  useEffect(() => { setSelected(new Set(rows.filter(r => r.p && r.m.pct !== null).map(r => r.m.person))) }, [month, model]) // eslint-disable-line react-hooks/exhaustive-deps

  const eligible = rows.filter(r => r.p && r.m.pct !== null)
  const chosen = eligible.filter(r => selected.has(r.m.person))
  const thisMonth = new Date().toISOString().slice(0, 7)

  function mapName(nameK: string, id: string) {
    const next = { ...overrides, [nameK]: id }
    setOverrides(next); saveMap(next)
  }

  const applyRow = useCallback(async (m: MonthAttendance, p: Person) => {
    const label = monthLabelOf(m.month), fraction = (m.pct as number) / 100
    const absent = m.sl + m.el + m.absent + (countVacation ? m.vl : 0) + 0.5 * m.halfdays
    const lateH = m.lateHours, underH = m.undertimeHours
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
  }, [records, currentUser, countVacation, writeAudit])

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
    const list = model.months.filter(m => m.pct !== null && m.person.startsWith('emp:')).map(m => ({ m, p: personById.get(m.person.slice(4)) as Person })).filter(x => x.p)
    if (confirm(`Apply attendance for ${list.length} person-months across ${monthList.length} months? Existing attendance for those months will be replaced (each change is logged).`)) applyList(list)
  }

  const unmatchedAll = model ? model.names.filter(k => !model.toPerson.get(k)) : []
  const optionsFor = (match?: Match) => {
    const topIds = new Set((match?.top || []).map(t => t.id))
    const sorted = [...people].sort((a, b) => (topIds.has(a.id) ? 0 : 1) - (topIds.has(b.id) ? 0 : 1) || a.name.localeCompare(b.name))
    return sorted
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-blue-900">Upload the attendance workbook</h3>
        <p className="text-xs text-gray-500 mt-0.5">Use the AB Time Tracker file (.xlsx). The portal finds the daily logs dated {YEAR}, works out each person&apos;s attendance per month, and shows it next to what the scorecard has now. Nothing changes until you apply. Upload the same file again with new months whenever you have them.</p>
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
          <p>{model.dd.duplicates} repeated days removed (some sheets repeat the next half-month){model.dd.conflicts ? `, ${model.dd.conflicts} where two sheets disagreed: the later sheet was used` : ''}. {model.nodata > 0 && <>{model.nodata} blank days (0 hours, no remark) are <b>not counted</b> as absences.</>}</p>
          <p><b>People:</b> {model.names.length} in the workbook, {model.matchedCount} matched to employees{unmatchedAll.length ? `, ${unmatchedAll.length} need your choice below` : ''}.</p>
        </div>

        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer text-blue-700 font-medium">How attendance is calculated</summary>
          <ul className="list-disc ml-5 mt-2 space-y-0.5">
            <li>Each person&apos;s scheduled days are the weekdays in their log. <b>Holidays</b> and days after resigning are left out.</li>
            <li><b>Sick leave, emergency leave and absences</b> count against attendance. A <b>half day</b> counts as half an absence.</li>
            <li><b>Late or short hours</b> take off 5 points per 8 hours (same as the Time Tracker). Slide shifts and clock-in notes do not count against anyone.</li>
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

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left"><tr>
              <th className="px-2 py-2"><input type="checkbox" aria-label="Select all" checked={eligible.length > 0 && chosen.length === eligible.length} onChange={e => setSelected(e.target.checked ? new Set(eligible.map(r => r.m.person)) : new Set())} /></th>
              <th className="px-2 py-2">Employee</th><th className="px-2 py-2 text-right">Days</th><th className="px-2 py-2 text-right">Sick / emerg. / absent</th><th className="px-2 py-2 text-right">Half days</th><th className="px-2 py-2 text-right">Vacation</th><th className="px-2 py-2 text-right">Late hrs</th>
              <th className="px-2 py-2 text-right">In the scorecard now</th><th className="px-2 py-2 text-right">From the workbook</th><th className="px-2 py-2 text-right">Change</th><th className="px-2 py-2">Notes</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const { m } = r, can = !!r.p && m.pct !== null
                const delta = can && r.current !== null ? (m.pct as number) - r.current * 100 : null
                return (
                  <tr key={m.person} className="border-t border-gray-100 align-top">
                    <td className="px-2 py-2"><input type="checkbox" disabled={!can} checked={can && selected.has(m.person)} aria-label={`Apply ${r.display}`} onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked) n.add(m.person); else n.delete(m.person); return n })} /></td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-gray-900">{r.display}</div>
                      {!r.p && (
                        <select className={`${inputCls} mt-1 text-xs w-full`} value="" onChange={e => mapName(r.nameK, e.target.value)} aria-label={`Choose the employee for ${m.name}`}>
                          <option value="">{r.match?.status === 'ambiguous' ? 'Could be several: choose…' : 'Not matched: choose…'}</option>
                          {optionsFor(r.match).map(p => <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ' (inactive)'}</option>)}
                          <option value="__skip">Skip this person</option>
                        </select>)}
                    </td>
                    <td className="px-2 py-2 text-right">{m.scheduled}</td>
                    <td className="px-2 py-2 text-right">{m.sl + m.el + m.absent || '—'}{m.sl + m.el + m.absent > 0 && <span className="text-gray-400"> ({[m.sl && `${m.sl} SL`, m.el && `${m.el} EL`, m.absent && `${m.absent} abs`].filter(Boolean).join(', ')})</span>}</td>
                    <td className="px-2 py-2 text-right">{m.halfdays || '—'}</td>
                    <td className="px-2 py-2 text-right">{m.vl || '—'}</td>
                    <td className="px-2 py-2 text-right">{m.lateHours ? fmtNum(m.lateHours) : '—'}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{r.current === null ? '—' : (r.current * 100).toFixed(2) + '%'}</td>
                    <td className="px-2 py-2 text-right font-semibold text-gray-900">{m.pct === null ? '—' : m.pct.toFixed(2) + '%'}</td>
                    <td className={`px-2 py-2 text-right ${delta === null ? 'text-gray-300' : delta < -0.05 ? 'text-red-600' : delta > 0.05 ? 'text-emerald-600' : 'text-gray-400'}`}>{delta === null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(2)}</td>
                    <td className="px-2 py-2 text-gray-500">{[...m.flags, r.recCount > 1 ? `${r.recCount} KPI records will be updated` : ''].filter(Boolean).join('. ')}</td>
                  </tr>)
              })}
              {rows.length === 0 && <tr><td className="px-3 py-4 text-gray-400" colSpan={11}>No one recorded for this month.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!!progress || chosen.length === 0} onClick={() => applyList(chosen.map(r => ({ m: r.m, p: r.p as Person })))} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">Apply {chosen.length} selected for {month ? monthLabelOf(month) : '…'}</button>
          <button disabled={!!progress} onClick={applyAllMonths} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Apply every month</button>
          {progress && <span className="text-xs text-gray-500" role="status">Applying {progress.done} of {progress.total}…</span>}
        </div>
        <p className="text-xs text-gray-400">Applying replaces the attendance score for that person and month, recalculates the overall score only when the other scores are entered, and writes each change to the audit log. Remembered name choices stay in this browser.</p>
      </>)}
    </div>
  )
}

// Reads the manual AB Time Tracker workbook and turns it into a monthly attendance % per person
// (pure functions: no React, no database, so they can be tested).
//
// The workbook has one sheet per half-month, with a daily log on the left (Contractor, Designation,
// Task, Date, Hours, Remarks) and a summary on the right. Sheet names are NOT reliable ("Sept. 16-30"
// has no year), so the period comes from the DATES in the rows. Rules were checked against the monthly
// "Perfect Attendance" sheets for June to September 2026 (100 person-months: 100% agreement on half-days
// and slide shifts, 99% on absences and emergency leave, 98% on tardiness, 96% on sick leave).

export type DayClass = 'present' | 'late' | 'halfday' | 'slide' | 'vl' | 'sl' | 'el' | 'absent' | 'holiday' | 'separated' | 'nodata'
export type DayRow = { sheet: string, name: string, date: string, hours: number | null, remark: string | number | null, order: number }

// ---------- reading the workbook ----------
const pad = (n: number) => String(n).padStart(2, '0')

// A Date, an Excel serial number, or a 'YYYY-MM-DD...' string -> 'YYYY-MM-DD' (null if it is not a plausible date).
export function toYmd(v: any): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // Excel dates arrive as local midnight in the browser; use the local calendar day.
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  if (typeof v === 'number' && v > 36000 && v < 60000) {   // 1998 to 2064 as an Excel serial
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000)   // floor: a time of day must not round up to the next date
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  if (typeof v === 'string') { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim()); if (m) return `${m[1]}-${m[2]}-${m[3]}` }
  return null
}

const norm = (c: any) => (c === null || c === undefined ? '' : String(c).trim().toLowerCase())

// Finds the daily-log table on each sheet and returns the rows dated in `year`.
// Header rule: a row that has both "contractor" and "date". The Hours and Remarks columns are the two
// columns right after Date (some sheets leave their headers blank). The FIRST "Contractor" column is
// the daily log; a second one to the right is the per-person summary and is ignored.
export function extractDayRows(sheets: { name: string, rows: any[][] }[], year: number): { rows: DayRow[], sheetsUsed: { name: string, rows: number }[], otherYears: number } {
  const out: DayRow[] = []
  const used: { name: string, rows: number }[] = []
  let otherYears = 0, order = 0
  for (const sh of sheets) {
    let ci = -1, di = -1, start = -1
    for (let i = 0; i < Math.min(sh.rows.length, 8); i++) {
      const h = (sh.rows[i] || []).map(norm)
      const c = h.indexOf('contractor'), d = h.indexOf('date')
      if (c >= 0 && d >= 0) { ci = c; di = d; start = i + 1; break }
    }
    if (ci < 0) continue
    let n = 0
    for (let i = start; i < sh.rows.length; i++) {
      const r = sh.rows[i]
      if (!r || r[ci] === null || r[ci] === undefined || String(r[ci]).trim() === '') continue
      const ymd = toYmd(r[di])
      if (!ymd) continue
      if (!ymd.startsWith(String(year) + '-')) { otherYears++; continue }
      const hv = r[di + 1]
      out.push({
        sheet: sh.name.trim(), name: String(r[ci]).trim().replace(/\s+/g, ' '), date: ymd,
        hours: typeof hv === 'number' ? hv : (hv !== null && hv !== undefined && !isNaN(parseFloat(String(hv))) ? parseFloat(String(hv)) : null),
        remark: r[di + 2] === undefined ? null : r[di + 2], order: order++,
      })
      n++
    }
    if (n > 0) used.push({ name: sh.name.trim(), rows: n })
  }
  return { rows: out, sheetsUsed: used, otherYears }
}

// ---------- one day ----------
// Remarks are free text: "Vacation Leave", "VL ", "Sick Leave", "SL", "Halfday", a number (hours late), ...
export function classifyDay(hours: number | null, remark: string | number | null): { cls: DayClass, lateHours: number, undertimeHours: number } {
  const r = (remark === null || remark === undefined ? '' : String(remark)).trim().toLowerCase()
  const num = typeof remark === 'number' ? remark : (r !== '' && !isNaN(Number(r)) ? Number(r) : null)
  const h = typeof hours === 'number' ? hours : null
  const res = (cls: DayClass, lateHours = 0, undertimeHours = 0) => ({ cls, lateHours, undertimeHours })
  if (r === 'holiday') return res('holiday')
  if (r === 'resigned') return res('separated')
  if (/^(vacation leave|vl|leave|time off)$/.test(r)) return res('vl')
  if (/sick leave|^sl$|medical leave|^mec$/.test(r)) return res('sl')
  if (/emergency leave|^el$/.test(r)) return res('el')
  if (/^absent|no show/.test(r)) return res('absent')
  if (/half ?day/.test(r) || (h !== null && h > 0 && h <= 4.5 && !/ot/.test(r))) return res('halfday')
  if (/slide shift/.test(r)) return res('slide')
  if (num !== null && num > 0) return res('late', num)
  if (r === 'late') return res('late')
  if (h === 0 && r === '') return res('nodata')          // an unfilled row, NOT an absence
  if (h !== null && h > 4.5 && h < 8 && r === '') return res('present', 0, 8 - h)   // a short day
  return res('present')
}

// ---------- names ----------
export const nameKey = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = (s: string) => nameKey(s).split(' ').filter(t => t.length > 1)
function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n; if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}
const sameToken = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && lev(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) / 4)))
// Order does not matter ("Miking, Genefer Castro" = "Genefer Castro Miking"); spelling slips are tolerated.
export function nameScore(a: string, b: string): number {
  const A = tokens(a), B = tokens(b)
  if (!A.length || !B.length) return 0
  const used = new Set<number>()
  let hit = 0
  for (const t of A) { const j = B.findIndex((u, k) => !used.has(k) && sameToken(t, u)); if (j >= 0) { used.add(j); hit++ } }
  return hit / Math.min(A.length, B.length)
}
export type Candidate = { id: string, names: string[] }
export type Match = { id: string | null, score: number, runnerUp: number, status: 'matched' | 'ambiguous' | 'none', top: { id: string, score: number }[] }
// Auto-match only when the best candidate is clearly ahead; otherwise it is left for a person to choose.
export function matchName(name: string, cands: Candidate[]): Match {
  const scored = cands.map(c => ({ id: c.id, score: Math.max(0, ...c.names.map(n => nameScore(name, n))) })).sort((a, b) => b.score - a.score)
  const best = scored[0], second = scored[1]
  const top = scored.filter(s => s.score >= 0.5).slice(0, 4)
  if (!best || best.score < 0.75) return { id: null, score: best ? best.score : 0, runnerUp: second ? second.score : 0, status: 'none', top }
  if (second && second.score >= best.score - 0.15 && second.score >= 0.75) return { id: null, score: best.score, runnerUp: second.score, status: 'ambiguous', top }
  return { id: best.id, score: best.score, runnerUp: second ? second.score : 0, status: 'matched', top }
}

// ---------- duplicates and the month ----------
// Some sheets repeat the next half-month lower down, so the same person and day can appear twice. A real
// row beats a blank placeholder; between two real rows the later sheet in the workbook wins. Returns how many
// clashed.
export function dedupeRows(rows: (DayRow & { person: string })[]): { rows: (DayRow & { person: string })[], duplicates: number, conflicts: number } {
  const by = new Map<string, DayRow & { person: string }>()
  let duplicates = 0, conflicts = 0
  for (const r of rows) {
    const k = r.person + '|' + r.date
    const cur = by.get(k)
    if (!cur) { by.set(k, r); continue }
    duplicates++
    const a = classifyDay(cur.hours, cur.remark).cls, b = classifyDay(r.hours, r.remark).cls
    if (a !== b || cur.hours !== r.hours) conflicts++
    if (a === 'nodata' && b !== 'nodata') by.set(k, r)
    else if (b === 'nodata' && a !== 'nodata') continue
    else if (r.order > cur.order) by.set(k, r)
  }
  return { rows: Array.from(by.values()), duplicates, conflicts }
}

export type AttendanceOptions = {
  countVacation: boolean        // false: approved vacation is excused (left out). true: it counts as an absence.
  latePointsPer8h: number       // points taken off per 8 hours late or short, 5 as in the Time Tracker
}
export const DEFAULT_OPTIONS: AttendanceOptions = { countVacation: false, latePointsPer8h: 5 }

export type MonthAttendance = {
  person: string, name: string, month: string                  // 'YYYY-MM'
  scheduled: number, presentDays: number, halfdays: number, sl: number, el: number, absent: number, vl: number
  holidays: number, slide: number, lateDays: number, lateHours: number, undertimeHours: number, nodata: number, separated: number
  hours: number, lastDate: string
  pct: number | null                                            // 0 to 100, null when there is nothing to measure
  flags: string[]
}

// rows: already deduplicated, each with a canonical `person`.
export function aggregateAttendance(rows: (DayRow & { person: string })[], opts: AttendanceOptions = DEFAULT_OPTIONS): MonthAttendance[] {
  const g = new Map<string, MonthAttendance>()
  for (const r of rows) {
    const month = r.date.slice(0, 7), k = r.person + '|' + month
    const a = g.get(k) || {
      person: r.person, name: r.name, month, scheduled: 0, presentDays: 0, halfdays: 0, sl: 0, el: 0, absent: 0, vl: 0, holidays: 0, slide: 0,
      lateDays: 0, lateHours: 0, undertimeHours: 0, nodata: 0, separated: 0, hours: 0, lastDate: r.date, pct: null, flags: [],
    }
    const c = classifyDay(r.hours, r.remark)
    if (r.date > a.lastDate) a.lastDate = r.date
    if (typeof r.hours === 'number' && r.hours > 0) a.hours += r.hours
    switch (c.cls) {
      case 'present': a.presentDays++; break
      case 'late': a.presentDays++; a.lateDays++; a.lateHours += c.lateHours; break
      case 'halfday': a.halfdays++; break
      case 'slide': a.presentDays++; a.slide++; break
      case 'sl': a.sl++; break
      case 'el': a.el++; break
      case 'absent': a.absent++; break
      case 'vl': a.vl++; break
      case 'holiday': a.holidays++; break
      case 'separated': a.separated++; break
      case 'nodata': a.nodata++; break
    }
    a.undertimeHours += c.undertimeHours
    g.set(k, a)
  }
  const out = Array.from(g.values())
  for (const a of out) {
    const counted = a.presentDays + a.halfdays + a.sl + a.el + a.absent + (opts.countVacation ? a.vl : 0)
    a.scheduled = counted
    if (counted === 0) { a.pct = null; a.flags.push(a.nodata > 0 ? 'No data in the sheet for this month' : 'Nothing to measure'); continue }
    const lost = a.sl + a.el + a.absent + (opts.countVacation ? a.vl : 0) + 0.5 * a.halfdays
    const base = ((counted - lost) / counted) * 100
    const deduction = ((a.lateHours + a.undertimeHours) / 8) * opts.latePointsPer8h
    a.pct = Math.round(Math.max(0, Math.min(100, base - deduction)) * 100) / 100
    if (a.nodata > 0) a.flags.push(`${a.nodata} blank day${a.nodata === 1 ? '' : 's'} not counted`)
    if (counted < 5) a.flags.push('Only a few days recorded')
    if (a.separated > 0) a.flags.push('Left during this month')
  }
  return out.sort((x, y) => x.month.localeCompare(y.month) || x.name.localeCompare(y.name))
}

// ---------- applying to the scorecard ----------
// The overall KPI score is only recomputed when accuracy, efficiency and feedback are all entered.
// Otherwise the missing parts counted as zero and left an overall of exactly 20% of attendance (the "0.20" months).
export function recomputeOverall(attendance: number, ex: { accuracy?: number | null, efficiency?: number | null, feedback?: number | null, compliance_score?: number | null }): number | null {
  const ok = (v: any) => typeof v === 'number' && v > 0
  if (!ok(ex.accuracy) || !ok(ex.efficiency) || !ok(ex.feedback)) return null
  return attendance * 0.2 + (ex.accuracy as number) * 0.3 + (ex.efficiency as number) * 0.3 + (ex.feedback as number) * 0.15 + (ex.compliance_score || 0) * 0.05
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthLabelOf = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`   // '2026-01' -> 'January 2026' (the KPI record convention)

// One person's month-by-month scorecard history (pure functions, so they can be tested).
// Scores are saved as fractions (0.99 = 99%); everything here is percent. A person can have several rows in
// a month (one per process) or an employee row per client, so rows are merged into one line per month.

type Rec = { employee_id: string, month_label: string | null, attendance: number | null, accuracy: number | null, efficiency: number | null, feedback: number | null, compliance_score: number | null, overall_score: number | null }
export type HistRow = {
  month: string, label: string, rows: number
  attendance: number | null, accuracy: number | null, efficiency: number | null, feedback: number | null, compliance: number | null, overall: number | null
  incomplete: boolean        // an overall of 25% or less is an unfinished entry, not a real score
}
const UNFINISHED_AT_OR_BELOW = 25
const MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// "September 2026", "June - 2025", "FEBRUARY 2025" -> "2026-09", "2025-06", "2025-02" (same rule as the attendance importer)
function parseMonthLabel(label: string | null | undefined): string | null {
  const m = /([A-Za-z]{3,9})[^A-Za-z0-9]*(\d{4})/.exec(label || '')
  if (!m) return null
  const i = MON3.indexOf(m[1].slice(0, 3).toLowerCase())
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, '0')}`
}
const pct = (v: number | null | undefined): number | null => typeof v === 'number' ? (v <= 1.5 ? Math.round(v * 10000) / 100 : v) : null
const mean = (xs: (number | null)[]): number | null => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const labelOf = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

export function monthlyHistory(records: Rec[], ids: string[]): HistRow[] {
  const mine = new Set(ids)
  const by = new Map<string, Rec[]>()
  for (const r of records) {
    if (!mine.has(r.employee_id)) continue
    const ym = parseMonthLabel(r.month_label)
    if (!ym) continue
    by.set(ym, [...(by.get(ym) || []), r])
  }
  return Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ym, rs]) => {
    const overallAll = rs.map(r => pct(r.overall_score))
    const finished = overallAll.filter((o): o is number => o !== null && o > UNFINISHED_AT_OR_BELOW)
    return {
      month: ym, label: labelOf(ym), rows: rs.length,
      attendance: mean(rs.map(r => pct(r.attendance))), accuracy: mean(rs.map(r => pct(r.accuracy))), efficiency: mean(rs.map(r => pct(r.efficiency))),
      feedback: mean(rs.map(r => pct(r.feedback))), compliance: mean(rs.map(r => pct(r.compliance_score))),
      overall: finished.length ? mean(finished) : null,
      incomplete: overallAll.some(o => o !== null && o <= UNFINISHED_AT_OR_BELOW) || (finished.length === 0 && overallAll.every(o => o === null)),
    }
  })
}

export type HistStats = {
  months: number, latest: HistRow | null, previous: HistRow | null, change: number | null
  avgAll: number | null, avgYear: number | null, avgLast3: number | null, avgAttendance: number | null
  best: HistRow | null, lowest: HistRow | null, belowBar: number, incomplete: number
}
// year: the calendar year to summarise ("this year"); bar: the at-risk line (97).
export function historyStats(h: HistRow[], year: number, bar = 97): HistStats {
  const scored = h.filter(r => r.overall !== null)
  const latest = scored.length ? scored[scored.length - 1] : null
  const previous = scored.length > 1 ? scored[scored.length - 2] : null
  const pick = (cmp: (a: HistRow, b: HistRow) => boolean) => scored.length ? scored.reduce((a, b) => (cmp(b, a) ? b : a)) : null
  return {
    months: h.length, latest, previous,
    change: latest && previous ? Math.round(((latest.overall as number) - (previous.overall as number)) * 100) / 100 : null,
    avgAll: mean(scored.map(r => r.overall)),
    avgYear: mean(scored.filter(r => r.month.startsWith(String(year))).map(r => r.overall)),
    avgLast3: mean(scored.slice(-3).map(r => r.overall)),
    avgAttendance: mean(h.map(r => r.attendance)),
    best: pick((a, b) => (a.overall as number) > (b.overall as number)),
    lowest: pick((a, b) => (a.overall as number) < (b.overall as number)),
    belowBar: scored.filter(r => (r.overall as number) < bar).length,
    incomplete: h.filter(r => r.incomplete).length,
  }
}
export const tone = (v: number | null, bar = 97): 'none' | 'good' | 'watch' | 'bad' => v === null ? 'none' : v >= bar ? 'good' : v >= bar - 3 ? 'watch' : 'bad'

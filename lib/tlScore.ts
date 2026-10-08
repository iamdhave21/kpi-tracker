// Pure rules for the Team Lead Scorecard (no React, no database, so they can be tested).
//
// Principle: a Team Lead is scored on what she can actually do. The one deliberate
// exception is Attendance (20%), which is her own record and is entered by management.
//
// KPI Entry Compliance = the share of her ACTIVE team members who have a KPI record for
// the month. It used to check whether a record existed about the Team Lead herself,
// which she cannot create, so entering her whole team's scores never moved it.

export type KpiCoverage = {
  total: number            // active team members expected to have a record
  done: number             // how many of them have one
  score: number            // 0-100
  applicable: boolean      // false when she has no active team members: nothing to score
  missing: string[]        // names still without a record
}

export function kpiEntryCoverage(
  members: { id: string, name: string }[],
  recordedEmployeeIds: string[],
  teamLeadId: string,
): KpiCoverage {
  const seen = new Set<string>()
  const expected = members.filter(m => {
    if (!m.id || m.id === teamLeadId || seen.has(m.id)) return false   // not herself, no double counting
    seen.add(m.id)
    return true
  })
  const recorded = new Set(recordedEmployeeIds)
  const missing = expected.filter(m => !recorded.has(m.id)).map(m => m.name).sort((a, b) => a.localeCompare(b))
  const total = expected.length
  const done = total - missing.length
  return { total, done, score: total > 0 ? (done / total) * 100 : 0, applicable: total > 0, missing }
}

// Average of the compliance parts that apply (a part with nothing to measure is left out,
// the same way coaching already works, instead of giving a free 100% or an unfair 0%).
export function averageApplicable(parts: { score: number, applicable: boolean }[]): number {
  const used = parts.filter(p => p.applicable)
  return used.length ? used.reduce((s, p) => s + p.score, 0) / used.length : 0
}

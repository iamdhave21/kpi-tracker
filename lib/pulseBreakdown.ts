// "Where is the dip coming from?" for the Weekly Pulse Check (pure functions, so they can be tested).
// Every number is an average over the people who responded; scores are 1 to 5.

export type PulseCat = { key: string, label: string, questions: { key: string, text: string }[] }
export type QStat = { key: string, text: string, current: number | null, prev: number | null, delta: number | null, windowAvg: number | null }
export type CatStat = {
  key: string, label: string, current: number | null, prev: number | null, delta: number | null, windowAvg: number | null,
  series: { week: string, avg: number | null }[], questions: QStat[], lowestQuestion: QStat | null,
}
export type Breakdown = {
  week: string, prevWeek: string | null, responders: number, weeksWithData: number,
  categories: CatStat[],
  retention: { current: number | null, prev: number | null, delta: number | null, windowAvg: number | null, series: { week: string, avg: number | null }[] },
  weakest: CatStat | null, biggestDrop: CatStat | null, lowestQuestion: QStat | null,
}

const r2 = (x: number) => Math.round(x * 100) / 100
const mean = (xs: number[]): number | null => xs.length ? r2(xs.reduce((s, v) => s + v, 0) / xs.length) : null
const nums = (rows: any[], keys: string[]) => rows.flatMap(r => keys.map(k => r[k]).filter((v: any) => typeof v === 'number')) as number[]
const diff = (a: number | null, b: number | null) => (a === null || b === null) ? null : r2(a - b)

// rows: pulse_surveys rows (week_start, one numeric column per question, retention).
// weeks: the window, any order. selectedWeek: the week being looked at.
export function breakdown(rows: any[], cats: PulseCat[], weeks: string[], selectedWeek: string, retentionKey = 'retention'): Breakdown {
  const asc = [...weeks].sort()
  const inWindow = rows.filter(r => asc.includes(r.week_start))
  const byWeek = (w: string) => inWindow.filter(r => r.week_start === w)
  const cur = byWeek(selectedWeek)
  const prevWeek = [...asc].filter(w => w < selectedWeek && byWeek(w).length > 0).pop() || null
  const prev = prevWeek ? byWeek(prevWeek) : []

  const stat = (keys: string[]) => {
    const current = mean(nums(cur, keys)), previous = mean(nums(prev, keys))
    return { current, prev: previous, delta: diff(current, previous), windowAvg: mean(nums(inWindow, keys)) }
  }
  const series = (keys: string[]) => asc.map(w => ({ week: w, avg: mean(nums(byWeek(w), keys)) }))

  const categories: CatStat[] = cats.map(c => {
    const questions: QStat[] = c.questions.map(q => ({ key: q.key, text: q.text, ...stat([q.key]) }))
    const answered = questions.filter(q => q.current !== null)
    const lowest = answered.length ? answered.reduce((a, b) => (b.current! < a.current! ? b : a)) : null
    return { key: c.key, label: c.label, ...stat(c.questions.map(q => q.key)), series: series(c.questions.map(q => q.key)), questions, lowestQuestion: lowest }
  })
  const withCur = categories.filter(c => c.current !== null)
  const weakest = withCur.length ? withCur.reduce((a, b) => (b.current! < a.current! ? b : a)) : null
  const dropping = categories.filter(c => c.delta !== null && c.delta <= -0.1)
  const biggestDrop = dropping.length ? dropping.reduce((a, b) => (b.delta! < a.delta! ? b : a)) : null
  const allQ = categories.flatMap(c => c.questions).filter(q => q.current !== null)
  const lowestQuestion = allQ.length ? allQ.reduce((a, b) => (b.current! < a.current! ? b : a)) : null

  return {
    week: selectedWeek, prevWeek, responders: cur.length, weeksWithData: asc.filter(w => byWeek(w).length > 0).length,
    categories, retention: { ...stat([retentionKey]), series: series([retentionKey]) }, weakest, biggestDrop, lowestQuestion,
  }
}

// green from 3.5, amber below that, red at or under the at-risk line (2.5)
export const scoreTone = (v: number | null): 'none' | 'good' | 'watch' | 'bad' => v === null ? 'none' : v <= 2.5 ? 'bad' : v < 3.5 ? 'watch' : 'good'

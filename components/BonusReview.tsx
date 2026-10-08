'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { staffApi } from '@/lib/staffFetch'
import { BonusConfig, Person, Override, Status, computeRun, presetAnnual, presetMonthly } from '@/lib/bonus'

const API = '/api/bonus/staff'
const call = (body: Record<string, any>) => staffApi(body, API)
type Toast = (m: string, t?: 'success' | 'error') => void

const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { maximumFractionDigits: 2 })
const monthLabel = (ym: string) => { if (!/^\d{4}-\d{2}$/.test(ym)) return ym; const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) }
const dateLabel = (d: string | null) => d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const inputCls = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const btn = 'px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50'
const STATUS: Record<Status, { label: string, cls: string }> = {
  pays: { label: 'Qualifies', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  exception: { label: 'Exception', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  gated: { label: 'NTE gate', cls: 'bg-red-50 text-red-700 border-red-200' },
  not_met: { label: 'Not met', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  no_data: { label: 'No data', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  no_hire: { label: 'No hire date', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  excluded: { label: 'Left out', cls: 'bg-gray-50 text-gray-400 border-gray-200' },
}
const mark = (c: string) => c === 'pass' ? <span className="text-emerald-600">✓</span> : c === 'fail' ? <span className="text-red-600">✗</span> : c === 'nodata' ? <span className="text-amber-600">?</span> : <span className="text-gray-300">–</span>

function describe(cfg: BonusConfig): string[] {
  const l: string[] = [`Period measured: ${monthLabel(cfg.periodFrom)} to ${monthLabel(cfg.periodTo)}. Tenure counted to ${monthLabel(cfg.payoutMonth)} in whole months, ignoring the day.`]
  if (cfg.tiers.length) l.push('Tenure bonus: ' + [...cfg.tiers].sort((a, b) => b.minMonths - a.minMonths).map(t => `${t.minMonths}+ months ${peso(t.amount)}`).join(', ') + (cfg.basket ? `; everyone also receives ${peso(cfg.basket)}.` : '.'))
  else if (cfg.basket) l.push(`Everyone included receives ${peso(cfg.basket)}.`)
  const crit: string[] = []
  if (cfg.tenure.on) crit.push(`at least ${cfg.tenure.minMonths} months of service`)
  if (cfg.attendance.on) crit.push(cfg.attendance.mode === 'every' ? `attendance of ${cfg.attendance.min}% in every month` : `average attendance of ${cfg.attendance.min}%`)
  if (cfg.performance.on) crit.push(`average overall performance of ${cfg.performance.min}% or above`)
  if (cfg.nte.on) crit.push(cfg.nte.maxAllowed === 0 ? 'no Notice to Explain' : `at most ${cfg.nte.maxAllowed} Notice to Explain`)
  if (cfg.escalations.on) crit.push(cfg.escalations.maxAllowed === 0 ? 'no escalations' : `at most ${cfg.escalations.maxAllowed} escalations`)
  const pay = cfg.reward.mode === 'pool' ? `a budget of ${peso(cfg.reward.budget)} split equally among those who qualify` : `${peso(cfg.reward.amount)} for each person who qualifies`
  l.push(`Performance reward: ${pay}${crit.length ? ', for people with ' + crit.join(', ') : ''}.`)
  if (cfg.nte.on) l.push(`Gatekeeper: anyone over the Notice to Explain limit does not receive the performance reward${cfg.nte.tierPct < 100 ? ` and the tenure bonus is paid at ${cfg.nte.tierPct}%` : ''}. An exception cannot override it.`)
  return l
}

export default function BonusReview({ showToast }: { showToast: Toast }) {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [meta, setMeta] = useState<{ hireColumn: boolean, escSource: string, escObservations: number } | null>(null)
  const [error, setError] = useState('')
  const [cfg, setCfg] = useState<BonusConfig>(presetAnnual())
  const [ov, setOv] = useState<Record<string, Override>>({})
  const [saved, setSaved] = useState<{ id: string, name: string, config: BonusConfig }[]>([])
  const [setupNote, setSetupNote] = useState('')
  const [runs, setRuns] = useState<any[]>([])
  const [view, setView] = useState<any | null>(null)
  const [showNoHire, setShowNoHire] = useState(false)
  const [showRuns, setShowRuns] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadPeople = useCallback(async () => {
    const r = await call({ action: 'people' })
    if (!r.ok) { setError(r.data.error || 'Could not load the data.'); return }
    setError(''); setPeople(r.data.people); setMeta(r.data.meta)
  }, [])
  const loadSaved = useCallback(async () => {
    const [p, h] = await Promise.all([call({ action: 'presets_list' }), call({ action: 'runs_list' })])
    if (p.ok) setSaved(p.data.presets); else setSetupNote(p.data.error || '')
    if (h.ok) setRuns(h.data.runs); else if (!setupNote) setSetupNote(h.data.error || '')
  }, [setupNote])
  useEffect(() => { loadPeople(); loadSaved() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The 2025-2026 annual run starts with the Director's two exceptions already ticked.
  useEffect(() => {
    if (!people || cfg.name !== 'Annual bonus' || Object.keys(ov).length) return
    const next: Record<string, Override> = {}
    for (const p of people) {
      const n = p.name.toLowerCase()
      if (n.includes('latimer, azeliza') || n.includes('czareena')) next[p.key] = { exception: true, note: 'Included at the Director\'s decision.' }
    }
    if (Object.keys(next).length) setOv(next)
  }, [people, cfg.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const needsHire = cfg.tenure.on || cfg.tiers.length > 0
  const run = useMemo(() => people ? computeRun(people, cfg, ov) : null, [people, cfg, ov])
  const rows = useMemo(() => (run?.rows || []).filter(r => showNoHire || !(needsHire && r.ev.status === 'no_hire')), [run, showNoHire, needsHire])
  const hiddenNoHire = (run?.rows || []).filter(r => needsHire && r.ev.status === 'no_hire').length

  const set = (patch: Partial<BonusConfig>) => setCfg(c => ({ ...c, ...patch }))
  const setOvFor = (key: string, patch: Override) => setOv(o => ({ ...o, [key]: { ...(o[key] || {}), ...patch } }))

  function pickPreset(v: string) {
    if (v === '__annual') { setCfg(presetAnnual()); setOv({}) }
    else if (v === '__monthly') { setCfg(presetMonthly()); setOv({}) }
    else { const s = saved.find(x => x.id === v); if (s) { setCfg(s.config); setOv({}) } }
  }
  async function savePreset() {
    const name = prompt('Name this preset', cfg.name)?.trim(); if (!name) return
    const r = await call({ action: 'preset_save', name, config: cfg })
    if (!r.ok) { showToast(r.data.error || 'Could not save', 'error'); return }
    set({ name }); showToast('Preset saved.', 'success'); loadSaved()
  }
  async function deletePreset(id: string) {
    if (!confirm('Delete this saved preset?')) return
    const r = await call({ action: 'preset_delete', id }); if (r.ok) { showToast('Deleted.', 'success'); loadSaved() } else showToast(r.data.error || 'Could not delete', 'error')
  }
  async function saveRun(status: 'draft' | 'final') {
    if (!run) return
    const title = prompt('Title for this run', `${cfg.name}, ${monthLabel(cfg.periodFrom)} to ${monthLabel(cfg.periodTo)}`)?.trim(); if (!title) return
    setBusy(true)
    const results = run.rows.filter(r => r.ev.status !== 'excluded').map(r => ({
      name: r.person.name, team: r.person.team, hire: r.person.hire, months: r.ev.months, tier: r.ev.tier, basket: r.ev.basket, reward: r.ev.reward, total: r.ev.total, status: r.ev.status, reasons: r.ev.reasons, facts: r.ev.facts,
    }))
    const r = await call({ action: 'run_save', title, status, config: cfg, overrides: ov, results, totals: run.totals })
    setBusy(false)
    if (!r.ok) { showToast(r.data.error || 'Could not save', 'error'); return }
    showToast(status === 'final' ? 'Saved as final.' : 'Saved as a draft.', 'success'); loadSaved()
  }
  async function openRun(id: string) {
    const r = await call({ action: 'run_get', id }); if (r.ok) setView(r.data.run); else showToast(r.data.error || 'Could not open', 'error')
  }
  async function deleteRun(id: string) {
    if (!confirm('Delete this saved run?')) return
    const r = await call({ action: 'run_delete', id }); if (r.ok) { showToast('Deleted.', 'success'); loadSaved() }
  }
  async function setHire(p: Person, d: string) {
    if (!d || !p.ids) return
    const r = await call({ action: 'set_hire', ids: p.ids, hire_date: d })
    if (!r.ok) { showToast(r.data.error || 'Could not save the date', 'error'); return }
    setPeople(ps => ps ? ps.map(x => x.key === p.key ? { ...x, hire: d } : x) : ps)
  }

  const printCss = <style>{`@media print{body *{visibility:hidden}#bonus-print,#bonus-print *{visibility:visible}#bonus-print{position:absolute;left:0;top:0;width:100%}.no-print{display:none!important}}`}</style>

  // ---------- a saved run, read only ----------
  if (view) {
    const c = view.config as BonusConfig, t = view.totals, res: any[] = view.results || []
    return (
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-4">
        {printCss}
        <div className="flex gap-2 no-print"><button onClick={() => setView(null)} className="text-sm text-blue-600 hover:underline">← Back</button><button onClick={() => window.print()} className={`${btn} bg-blue-600 text-white ml-auto`}>Print or save as PDF</button></div>
        <div id="bonus-print" className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h1 className="text-xl font-bold text-gray-900">{view.title}</h1>
          <p className="text-xs text-gray-500">{view.status === 'final' ? 'Final' : 'Draft'}. Saved {dateLabel(view.created_at)} by {view.created_by_name || 'Super Admin'}.</p>
          <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1">{describe(c).map((l, i) => <li key={i}>{l}</li>)}</ul>
          <p className="text-sm text-gray-900"><b>{t.payers}</b> qualify for the reward. Tenure bonuses {peso(t.tiers)}, baskets {peso(t.baskets)}, rewards {peso(t.rewards)}. <b>Total {peso(t.grand)}.</b></p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 text-left"><tr><th className="px-2 py-2">Name</th><th className="px-2 py-2">Hired</th><th className="px-2 py-2 text-right">Months</th><th className="px-2 py-2 text-right">Tenure bonus</th><th className="px-2 py-2 text-right">Basket</th><th className="px-2 py-2 text-right">Reward</th><th className="px-2 py-2 text-right">Total</th><th className="px-2 py-2">Basis</th></tr></thead>
            <tbody>{res.map((r, i) => (
              <tr key={i} className="border-t border-gray-100 align-top"><td className="px-2 py-2 font-medium text-gray-900">{r.name}<div className="text-xs font-normal text-gray-400">{r.team}</div></td><td className="px-2 py-2 text-gray-600">{dateLabel(r.hire)}</td><td className="px-2 py-2 text-right">{r.months ?? '—'}</td><td className="px-2 py-2 text-right">{peso(r.tier)}</td><td className="px-2 py-2 text-right">{peso(r.basket)}</td><td className="px-2 py-2 text-right">{r.reward ? peso(r.reward) : '—'}</td><td className="px-2 py-2 text-right font-semibold">{peso(r.total)}</td>
                <td className="px-2 py-2 text-xs text-gray-600"><b>{STATUS[r.status as Status]?.label || r.status}.</b> {(r.reasons || []).join(' ')}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>
    )
  }

  // ---------- the working screen ----------
  const tiles = run ? [
    { l: 'People in this run', v: String(run.totals.people) },
    { l: 'Qualify for the reward', v: String(run.totals.payers) },
    { l: 'Tenure bonuses and baskets', v: peso(run.totals.tiers + run.totals.baskets) },
    { l: cfg.reward.mode === 'pool' ? `Rewards (${peso(run.totals.share)} each)` : 'Rewards', v: peso(run.totals.rewards) },
    { l: 'Total to pay', v: peso(run.totals.grand) },
  ] : []

  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-6 space-y-4">
      {printCss}
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonus Review</h1>
          <p className="text-sm text-gray-500 mt-1">Super Admin only. Pick a period and the criteria, set the budget, and see who qualifies and what it costs.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRuns(!showRuns)} className={`${btn} border border-gray-300 text-gray-700 bg-white`}>Saved runs ({runs.length})</button>
          <button onClick={() => window.print()} className={`${btn} border border-gray-300 text-gray-700 bg-white`}>Print or save as PDF</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 no-print">{error}</div>}
      {meta && !meta.hireColumn && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3 no-print">Hire dates are not set up yet. Run blocks 1 to 5 of <b>bonus-review-schema.sql</b> in the Supabase SQL editor, then refresh.</div>}
      {setupNote && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3 no-print">Saving presets and runs is not set up yet: {setupNote}. Run blocks 2 and 3 of <b>bonus-review-schema.sql</b>.</div>}
      {meta && meta.escSource === 'unavailable' && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3 no-print">Client observations could not be read, so escalations are not counted automatically. You can still enter them by hand in the table.</div>}

      {showRuns && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 no-print">
          <h2 className="font-semibold text-gray-900 mb-2">Saved runs</h2>
          {runs.length === 0 ? <p className="text-sm text-gray-500">Nothing saved yet. Use “Save run” below to keep a version you can show Andi.</p> : (
            <div className="divide-y divide-gray-100">{runs.map(r => (
              <div key={r.id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
                <button onClick={() => openRun(r.id)} className="font-medium text-blue-700 hover:underline text-left">{r.title}</button>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${r.status === 'final' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{r.status === 'final' ? 'Final' : 'Draft'}</span>
                <span className="text-gray-500">{peso(r.totals?.grand || 0)} · {dateLabel(r.created_at)}</span>
                <button onClick={() => deleteRun(r.id)} className="text-xs text-red-600 hover:underline ml-auto">Delete</button>
              </div>))}</div>)}
        </div>
      )}

      {/* preset and period */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600">Preset
            <select value="" onChange={e => e.target.value && pickPreset(e.target.value)} className={`${inputCls} md:w-64`}>
              <option value="">{cfg.name} (current)</option>
              <option value="__annual">Annual bonus (starting point)</option>
              <option value="__monthly">Monthly performance bonus (starting point)</option>
              {saved.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button onClick={savePreset} className={`${btn} border border-blue-300 text-blue-700 bg-white`}>Save as preset</button>
          {saved.find(s => s.name.toLowerCase() === cfg.name.toLowerCase()) && <button onClick={() => deletePreset(saved.find(s => s.name.toLowerCase() === cfg.name.toLowerCase())!.id)} className="text-xs text-red-600 hover:underline pb-2">Delete this saved preset</button>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <label className="text-xs text-gray-600">Measure from<input type="month" value={cfg.periodFrom} onChange={e => e.target.value && set({ periodFrom: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-gray-600">Measure to<input type="month" value={cfg.periodTo} onChange={e => e.target.value && set({ periodTo: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-gray-600">Payout month (tenure counted to)<input type="month" value={cfg.payoutMonth} onChange={e => e.target.value && set({ payoutMonth: e.target.value })} className={inputCls} /></label>
          <div className="col-span-2 flex flex-wrap items-end gap-2 text-xs">
            <button onClick={() => set({ periodFrom: '2025-01', periodTo: '2026-12' })} className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-700">2025 to 2026</button>
            <button onClick={() => { const y = new Date().getFullYear(); set({ periodFrom: `${y}-01`, periodTo: `${y}-12` }) }} className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-700">This year</button>
            <button onClick={() => { const m = presetMonthly().periodFrom; set({ periodFrom: m, periodTo: m }) }} className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-700">Last month</button>
          </div>
        </div>
      </div>

      {/* criteria */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 no-print">
        <Crit title="Tenure" on={cfg.tenure.on} setOn={v => set({ tenure: { ...cfg.tenure, on: v } })} hint="Months of service to the payout month, ignoring the day.">
          <label className="text-xs text-gray-600">Reward needs at least (months)<input type="number" min={0} value={cfg.tenure.minMonths} onChange={e => set({ tenure: { ...cfg.tenure, minMonths: Number(e.target.value) } })} className={inputCls} /></label>
          <div className="text-xs text-gray-600 mt-2">Tenure bonus tiers (paid to everyone included)</div>
          {cfg.tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 mt-1">
              <input type="number" min={0} value={t.minMonths} onChange={e => set({ tiers: cfg.tiers.map((x, j) => j === i ? { ...x, minMonths: Number(e.target.value) } : x) })} className={`${inputCls} w-20`} aria-label="Months" /><span className="text-xs text-gray-500">+ months</span>
              <input type="number" min={0} value={t.amount} onChange={e => set({ tiers: cfg.tiers.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x) })} className={`${inputCls} w-24`} aria-label="Amount" />
              <button onClick={() => set({ tiers: cfg.tiers.filter((_, j) => j !== i) })} className="text-xs text-red-600">Remove</button>
            </div>))}
          <button onClick={() => set({ tiers: [...cfg.tiers, { minMonths: 12, amount: 0 }] })} className="text-xs text-blue-600 mt-1">+ Add a tier</button>
          <label className="text-xs text-gray-600 block mt-2">Basket or fixed amount for everyone (₱)<input type="number" min={0} value={cfg.basket} onChange={e => set({ basket: Number(e.target.value) })} className={inputCls} /></label>
        </Crit>
        <Crit title="Attendance" on={cfg.attendance.on} setOn={v => set({ attendance: { ...cfg.attendance, on: v } })} hint="From the monthly KPI attendance score.">
          <label className="text-xs text-gray-600">At least (%)<input type="number" min={0} max={100} step="0.1" value={cfg.attendance.min} onChange={e => set({ attendance: { ...cfg.attendance, min: Number(e.target.value) } })} className={inputCls} /></label>
          <label className="text-xs text-gray-600 block mt-2">Measured as
            <select value={cfg.attendance.mode} onChange={e => set({ attendance: { ...cfg.attendance, mode: e.target.value as 'every' | 'average' } })} className={inputCls}>
              <option value="every">Every month must reach it</option><option value="average">The average must reach it</option>
            </select></label>
        </Crit>
        <Crit title="Overall performance" on={cfg.performance.on} setOn={v => set({ performance: { ...cfg.performance, on: v } })} hint="Average overall KPI score. Months scored 25% or less are treated as unfinished entries and ignored.">
          <label className="text-xs text-gray-600">Average at least (%)<input type="number" min={0} max={100} step="0.1" value={cfg.performance.min} onChange={e => set({ performance: { ...cfg.performance, min: Number(e.target.value) } })} className={inputCls} /></label>
        </Crit>
        <Crit title="Notices to Explain" on={cfg.nte.on} setOn={v => set({ nte: { ...cfg.nte, on: v } })} hint="The gatekeeper. Over the limit, the reward is withheld and an exception cannot override it.">
          <label className="text-xs text-gray-600">Allowed in the period<input type="number" min={0} value={cfg.nte.maxAllowed} onChange={e => set({ nte: { ...cfg.nte, maxAllowed: Number(e.target.value) } })} className={inputCls} /></label>
          <label className="text-xs text-gray-600 block mt-2">Tenure bonus paid to them at (%)<input type="number" min={0} max={100} value={cfg.nte.tierPct} onChange={e => set({ nte: { ...cfg.nte, tierPct: Number(e.target.value) } })} className={inputCls} /></label>
        </Crit>
        <Crit title="Escalations" on={cfg.escalations.on} setOn={v => set({ escalations: { ...cfg.escalations, on: v } })} hint={meta?.escSource === 'ok' ? `Counted from client observations marked concern or risk that name the person (${meta.escObservations} on file). Escalations kept elsewhere can be entered by hand in the table.` : 'Enter escalations by hand in the table.'}>
          <label className="text-xs text-gray-600">Allowed in the period<input type="number" min={0} value={cfg.escalations.maxAllowed} onChange={e => set({ escalations: { ...cfg.escalations, maxAllowed: Number(e.target.value) } })} className={inputCls} /></label>
        </Crit>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="font-semibold text-gray-900 mb-1">Reward and budget</div>
          <label className="text-xs text-gray-600 block">How the reward is paid
            <select value={cfg.reward.mode} onChange={e => set({ reward: { ...cfg.reward, mode: e.target.value as 'per_person' | 'pool' } })} className={inputCls}>
              <option value="per_person">A set amount for each person who qualifies</option><option value="pool">A budget shared equally among those who qualify</option>
            </select></label>
          {cfg.reward.mode === 'per_person' ? <>
            <label className="text-xs text-gray-600 block mt-2">Amount each (₱)<input type="number" min={0} value={cfg.reward.amount} onChange={e => set({ reward: { ...cfg.reward, amount: Number(e.target.value) } })} className={inputCls} /></label>
            <label className="text-xs text-gray-600 block mt-2">Budget limit, optional (₱)<input type="number" min={0} value={cfg.reward.budget || ''} onChange={e => set({ reward: { ...cfg.reward, budget: Number(e.target.value) } })} className={inputCls} /></label>
          </> : <label className="text-xs text-gray-600 block mt-2">Budget to share (₱)<input type="number" min={0} value={cfg.reward.budget} onChange={e => set({ reward: { ...cfg.reward, budget: Number(e.target.value) } })} className={inputCls} /></label>}
          {run && run.totals.overBudget > 0 && <p className="text-xs text-red-600 mt-2">Over budget by {peso(run.totals.overBudget)}.</p>}
          {run && cfg.reward.mode === 'pool' && <p className="text-xs text-gray-500 mt-2">{run.totals.payers ? `${peso(run.totals.share)} each, ${peso(run.totals.unallocated)} left unallocated.` : 'Nobody qualifies yet, so nothing is shared.'}</p>}
        </div>
      </div>

      {/* results */}
      <div id="bonus-print" className="space-y-3">
        <div className="hidden print:block">
          <h1 className="text-xl font-bold text-gray-900">{cfg.name}</h1>
          <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1 mt-2">{describe(cfg).map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{tiles.map(t => <div key={t.l} className="bg-white border border-gray-200 rounded-xl p-3"><div className="text-lg font-bold text-gray-900">{t.v}</div><div className="text-xs text-gray-500">{t.l}</div></div>)}</div>
        {!people ? <div className="text-sm text-gray-500">Loading…</div> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 text-left"><tr>
                <th className="px-2 py-2">Name</th><th className="px-2 py-2">Hired</th><th className="px-2 py-2 text-right">Months</th><th className="px-2 py-2 text-right">Tenure bonus</th>
                <th className="px-2 py-2 text-right">Attendance</th><th className="px-2 py-2 text-right">Performance</th><th className="px-2 py-2 text-right">NTEs</th><th className="px-2 py-2 text-right">Escalations</th>
                <th className="px-2 py-2 no-print">Exception</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Reward</th><th className="px-2 py-2 text-right">Total</th><th className="px-2 py-2">Basis</th></tr></thead>
              <tbody>
                {rows.map(({ person: p, ov: o, ev }) => (
                  <tr key={p.key} className={`border-t border-gray-100 align-top ${ev.status === 'excluded' ? 'opacity-50' : ''}`}>
                    <td className="px-2 py-2"><div className="font-medium text-gray-900">{p.name}</div><div className="text-xs text-gray-400">{p.team || ''}</div>
                      <label className="text-xs text-gray-400 no-print flex items-center gap-1"><input type="checkbox" checked={o.include !== false} onChange={e => setOvFor(p.key, { include: e.target.checked })} /> in this run</label></td>
                    <td className="px-2 py-2 whitespace-nowrap">{p.hire ? dateLabel(p.hire) : <span className="no-print"><input type="date" onChange={e => setHire(p, e.target.value)} className="border border-amber-300 rounded px-1 py-0.5 text-xs text-gray-900" aria-label={`Hire date for ${p.name}`} /></span>}</td>
                    <td className="px-2 py-2 text-right">{ev.months ?? '—'} {mark(ev.checks.tenure)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{peso(ev.tier)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{ev.facts.attendance !== null ? ev.facts.attendance.toFixed(1) + '%' : '—'} {mark(ev.checks.attendance)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{ev.facts.performance !== null ? ev.facts.performance.toFixed(1) + '%' : '—'} {mark(ev.checks.performance)}</td>
                    <td className="px-2 py-2 text-right">{ev.facts.ntes} {mark(ev.checks.nte)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap"><input type="number" min={0} value={o.escalations ?? ''} placeholder={String(p.escDates.filter(d => d.slice(0, 7) >= cfg.periodFrom && d.slice(0, 7) <= cfg.periodTo).length)} onChange={e => setOvFor(p.key, { escalations: e.target.value === '' ? null : Number(e.target.value) })} className="w-14 border border-gray-300 rounded px-1 py-0.5 text-xs text-right text-gray-900 no-print" aria-label={`Escalations for ${p.name}`} /><span className="hidden print:inline">{ev.facts.escalations}</span> {mark(ev.checks.escalations)}</td>
                    <td className="px-2 py-2 no-print"><input type="checkbox" checked={!!o.exception} onChange={e => setOvFor(p.key, { exception: e.target.checked })} aria-label={`Exception for ${p.name}`} /></td>
                    <td className="px-2 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS[ev.status].cls}`}>{STATUS[ev.status].label}</span></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{ev.reward ? peso(ev.reward) : '—'}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap font-semibold text-gray-900">{peso(ev.total)}</td>
                    <td className="px-2 py-2 text-xs text-gray-500 max-w-[320px]">{ev.reasons.join(' ')}</td>
                  </tr>))}
                {run && <tr className="border-t-2 border-gray-300 font-semibold"><td className="px-2 py-2" colSpan={3}>Total</td><td className="px-2 py-2 text-right">{peso(run.totals.tiers)}</td><td colSpan={6}></td><td className="px-2 py-2 text-right">{peso(run.totals.rewards)}</td><td className="px-2 py-2 text-right">{peso(run.totals.grand)}</td><td></td></tr>}
              </tbody>
            </table>
          </div>)}
        {hiddenNoHire > 0 && <p className="text-xs text-gray-500 no-print">{hiddenNoHire} active {hiddenNoHire === 1 ? 'person has' : 'people have'} no hire date and {hiddenNoHire === 1 ? 'is' : 'are'} hidden. <button onClick={() => setShowNoHire(!showNoHire)} className="text-blue-600 hover:underline">{showNoHire ? 'Hide them' : 'Show them to add a date'}</button></p>}
        <ul className="text-xs text-gray-500 list-disc ml-5 space-y-0.5 hidden print:block">{describe(cfg).slice(0, 0).map(() => null)}</ul>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        <button disabled={busy || !run} onClick={() => saveRun('draft')} className={`${btn} border border-gray-300 text-gray-700 bg-white`}>Save run as draft</button>
        <button disabled={busy || !run} onClick={() => saveRun('final')} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>Save run as final</button>
        <span className="text-xs text-gray-400 self-center">A saved run keeps these exact figures so you can show Andi the same list later.</span>
      </div>
    </div>
  )
}

function Crit({ title, on, setOn, hint, children }: { title: string, on: boolean, setOn: (v: boolean) => void, hint: string, children: React.ReactNode }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${on ? 'border-blue-300' : 'border-gray-200'}`}>
      <label className="flex items-center gap-2 font-semibold text-gray-900"><input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} />{title}</label>
      <p className="text-xs text-gray-400 mt-1 mb-2">{hint}</p>
      <div className={on ? '' : 'opacity-40 pointer-events-none'}>{children}</div>
    </div>
  )
}

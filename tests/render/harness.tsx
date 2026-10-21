// Renders the REAL Pulse screen and Dashboard in a simulated browser (jsdom) against a mocked database, and clicks
// through the dropdowns the way a user would. Run it with: npm run test:render
// Why it exists: the TypeScript compiler and the unit tests do not draw screens. A "Cannot access 'x' before
// initialization" crash in the Pulse screen passed both and only showed up in the live app. This reproduces it.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from '@/lib/supabase'
import { PulseCheckPanel, PerformanceDashboard, PULSE_CATEGORIES, getWeekStart, BCPPanel } from '@/components/KPIApp.smoke.tmp'

const errors: string[] = []
const origErr = console.error
console.error = (...a: any[]) => { const m = a.map(String).join(' '); if (!/not wrapped in act|ResizeObserver|The width\(0\)|width\(-1\)/.test(m)) errors.push(m.slice(0, 300)); }
const results: string[] = []
const check = (name: string, ok: boolean, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!ok) errors.push('FAILED CHECK: ' + name) }

// ---- mock data
const E = (id: string, name: string, email: string, o: any = {}) => ({ id, name, email, employee_id: 'ABBSS-' + id, designation: 'AP', client: 'EMMA', clients_supported: ['EMMA'], active: true, hire_date: '2024-01-09', employment_type: 'Contractor', contract_type: 'Contractual', created_at: '2024-01-01', ...o })
const employees: any[] = [
  E('e1', 'Latimer, Azeliza', 'azeliza.ignacio@ab-businesssupport.com', { designation: 'Team Lead' }),
  E('e2', 'Padua, Katrina Joy Claveria', 'katrina@ab-businesssupport.com'),
  E('e3', 'Canoy, Madelyn', 'madelyn@ab-businesssupport.com'),
  E('e3b', 'Canoy, Madelyn', 'madelyn2@ab-businesssupport.com', { client: 'AB BSS', clients_supported: ['AB BSS'] }),   // same person, second client row
  E('e4', 'Cornel, Precilla Guillermo', 'precilla@ab-businesssupport.com'),
  E('e5', 'Remulla, Jefferson', 'jefferson@ab-businesssupport.com', { active: false }),
]
const mondays: string[] = []; { const d = new Date(); for (let i = 0; i < 6; i++) { mondays.push(getWeekStart(new Date(d.getTime() - i * 7 * 86400000))) } }
let pid = 0
const pulse: any[] = []
for (const id of ['e2', 'e3', 'e4']) for (const [i, w] of mondays.entries()) {
  const row: any = { id: 'p' + pid++, employee_id: id, employee_name: employees.find(e => e.id === id).name, week_start: w, retention: i === 2 ? 2 : 4, feedback: i === 0 ? 'Busy week' : null, tl_note: i === 1 ? 'Checked in' : null, created_at: w }
  for (const c of PULSE_CATEGORIES) for (const q of c.questions) row[q.key] = (id === 'e3' && c.key === 'wlb' && i < 2) ? 2 : 4
  pulse.push(row)
}
const months = ['January 2026', 'February 2026', 'March 2026', 'June - 2025']
const kpi: any[] = []
for (const id of ['e2', 'e3', 'e3b', 'e4']) for (const [i, m] of months.entries()) kpi.push({ id: 'k' + id + i, employee_id: id, employee_name: employees.find(e => e.id === id).name, designation: 'AP', month_label: m, attendance: i === 1 ? 0.95 : 1, accuracy: 0.98, efficiency: 0.97, feedback: 1, compliance_score: 1, overall_score: i === 0 && id === 'e2' ? 0.2 : 0.98, ranking: null, notes: null, coached: false, created_at: '2026-01-01', updated_at: '2026-01-01' })
const DATA: Record<string, any[]> = {
  employees, pulse_surveys: pulse, kpi_records: kpi,
  teams: [{ id: 't1', name: 'AP-EMM', team_lead_id: 'e1', team_lead: { client: 'EMMA' } }],
  team_members: [{ team_id: 't1', employee_id: 'e2' }, { team_id: 't1', employee_id: 'e3' }, { team_id: 't1', employee_id: 'e4' }],
}
function builder(table: string): any {
  const st: any = { table, f: [] as any[], single: false }
  const api: any = new Proxy(function () {}, { get(_t, prop: string) {
    if (prop === 'then') return (res: any, rej: any) => Promise.resolve(run(st)).then(res, rej)
    if (prop === 'single' || prop === 'maybeSingle') return () => { st.single = true; return api }
    return (...a: any[]) => { if (prop === 'eq' || prop === 'in') st.f.push([prop, a[0], a[1]]); return api }
  } })
  return api
}
function run(st: any) {
  let rows = (DATA[st.table] || []).slice()
  for (const [op, k, v] of st.f) rows = rows.filter(r => op === 'eq' ? String(r[k]).toLowerCase() === String(v).toLowerCase() : (v as any[]).includes(r[k]))
  return { data: st.single ? (rows[0] || null) : rows, error: null, count: rows.length }
}
;(supabase as any).from = builder
;(supabase as any).auth = { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }

const tick = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => setTimeout(r, 15)) }) }
const text = (el: Element) => el.textContent || ''
async function select(container: HTMLElement, label: string, index: number) {
  const sel = container.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement | null
  if (!sel) return null
  const opt = sel.options[index]; if (!opt) return null
  await act(async () => { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!; set.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })) })
  await tick()
  return opt.text
}
async function mount(node: React.ReactElement) { const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container); await act(async () => { root.render(node) }); await tick(); return { container, root } }

async function main() {
  const noop = () => {}
  // ---- 1. Pulse: Super Admin
  for (const [who, role, user] of [['Super Admin', 'super_admin', 'operations@ab-businesssupport.com'], ['Team Lead', 'Team Lead', 'azeliza.ignacio@ab-businesssupport.com'], ['Agent', 'agent', 'katrina@ab-businesssupport.com']] as const) {
    try {
      const { container, root } = await mount(<PulseCheckPanel employees={employees} currentUser={user} userRole={role} showToast={noop} isPreviewing={false} />)
      check(`Pulse renders for ${who}`, text(container).length > 50)
      if (role !== 'agent') {
        // A Team Lead also submits their own check-in, so the screen opens on that tab: go to the team tab ("My Team" for a Team Lead, "Team Status" otherwise).
        const tab = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Team Status' || b.textContent === 'My Team')
        if (tab) { await act(async () => { tab.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await tick(8) }
        const sel = container.querySelector('select[aria-label="View a person\'s survey history"]') as HTMLSelectElement | null
        check(`Pulse (${who}): person dropdown is there`, !!sel)
        if (sel) {
          const names = Array.from(sel.options).map(o => o.text).filter(t => !t.startsWith('View'))
          check(`Pulse (${who}): each person once, inactive left out`, new Set(names).size === names.length && !names.some(n => n.includes('Remulla')), names.join(' | '))
          const picked = await select(container, "View a person's survey history", names.length > 1 ? 2 : 1)
          check(`Pulse (${who}): choosing ${picked} opens the history`, /survey history/.test(text(container)) && /Check-ins/.test(text(container)))
          const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Answers')
          if (btn) { await act(async () => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await tick(2); check(`Pulse (${who}): "Answers" expands`, /Open feedback|Work Environment/.test(text(container))) }
          check(`Pulse (${who}): "What is driving the score" card shows`, /What is driving the score/.test(text(container)))
        }
      }
      await act(async () => { root.unmount() })
    } catch (e: any) { errors.push(`Pulse ${who} threw: ${e?.message}`); results.push(`FAIL Pulse ${who} threw: ${e?.message}`) }
  }
  // ---- 2. Dashboard: Super Admin
  try {
    const { container, root } = await mount(<PerformanceDashboard records={kpi} employees={employees} activeEmpIds={new Set(employees.filter(e => e.active).map(e => e.id))} perfView={'monthly' as any} setPerfView={noop} selMonth="March" selYear="2026" selQuarter={0} setSelMonth={noop} setSelYear={noop} setSelQuarter={noop} searchQ="" setSearchQ={noop} onEditRecord={noop} showToast={noop} currentUser="operations@ab-businesssupport.com" userRole="super_admin" />)
    check('Dashboard renders', text(container).length > 50)
    const sel = container.querySelector('select[aria-label="Check one agent"]') as HTMLSelectElement | null
    check('Dashboard: agent dropdown is there', !!sel)
    if (sel) {
      const names = Array.from(sel.options).map(o => o.text).filter(t => !t.startsWith('Check'))
      check('Dashboard: a person with two client rows appears once; inactive left out', names.filter(n => n.startsWith('Canoy')).length === 1 && !names.some(n => n.includes('Remulla')), names.join(' | '))
      const picked = await select(container, 'Check one agent', 2)
      const t = text(container)
      check(`Dashboard: choosing ${picked} opens the history`, /months on record/.test(t) && /Average 2026/.test(t))
      check('Dashboard: the history table lists the months', /March 2026/.test(t) && /June 2025/.test(t))
      const close = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Close')
      if (close) { await act(async () => { close.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await tick(2); check('Dashboard: Close hides it', !/months on record/.test(text(container))) }
      // the person whose January is the unfinished 0.20 month
      const katrina = Array.from(sel.options).findIndex(o => o.text.startsWith('Padua'))
      if (katrina > 0) { await select(container, 'Check one agent', katrina); check('Dashboard: an unfinished 0.20 month is flagged, not averaged', /Unfinished entry/.test(text(container))) }
    }
    await act(async () => { root.unmount() })
  } catch (e: any) { errors.push(`Dashboard threw: ${e?.message}`); results.push(`FAIL Dashboard threw: ${e?.message}`) }

  // ---- 3. BCP: Risk Management Plan first, clickable tiles, no Coverage Matrix
  const click = async (el: Element | null | undefined) => { if (el) { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) }); await tick(2) } }
  const btn = (c: HTMLElement, pred: (b: HTMLButtonElement) => boolean) => Array.from(c.querySelectorAll('button')).find(pred) as HTMLButtonElement | undefined
  try {
    const { container, root } = await mount(<BCPPanel userRole="admin" />)
    const tabs = Array.from(container.querySelectorAll('.border-b button')).map(b => b.textContent)
    check('BCP: tabs are Risk Management Plan, then Escalation Matrix', JSON.stringify(tabs) === JSON.stringify(['Risk Management Plan', 'Escalation Matrix']), JSON.stringify(tabs))
    check('BCP: no Coverage Matrix anywhere', !/Coverage Matrix|\+ New Task/.test(text(container)))
    check('BCP: opens on the Risk Management Plan', /Four risk areas|Overview/.test(text(container)) && /Click a box on the diagram/.test(text(container)))
    const tiles = Array.from(container.querySelectorAll('button[aria-label]')).map(b => b.getAttribute('aria-label') || '')
    check('BCP: the five diagram tiles are clickable', tiles.length === 5 && tiles.some(t => t.startsWith('Operations:')) && tiles.some(t => t.startsWith('Security, access:')), String(tiles.length))
    for (const [tile, expect] of [['Operations:', /Operational risk centers/], ['Payroll, finance:', /Payroll exposure comes from/], ['HR, workforce:', /act on warning signs/], ['Security, access:', /main exposure is data breach/], ['Shared by all four', /Three standard processes/]] as const) {
      await click(btn(container, b => /Back to the diagram/.test(b.textContent || '')))   // reopen the diagram (no-op the first time)
      await click(btn(container, b => (b.getAttribute('aria-label') || '').startsWith(tile)))
      check(`BCP: clicking the "${tile.replace(':', '')}" tile opens its section`, expect.test(text(container)))
    }
    await click(btn(container, b => /Back to the diagram/.test(b.textContent || '')))
    await click(btn(container, b => (b.getAttribute('aria-label') || '').startsWith('Operations:')))
    check('BCP: the section says where the instructions sit', /Where the instructions sit/.test(text(container)))
    await click(btn(container, b => /Workforce continuity steps/.test(b.textContent || '')))
    check('BCP: a pointer opens the continuity steps', /Validation is the gate/.test(text(container)))
    await click(btn(container, b => /Escalation Matrix \(AB-ESC-01\)/.test(b.textContent || '')) || btn(container, b => /Open the full Escalation Matrix/.test(b.textContent || '')))
    check('BCP: the Escalation Matrix pointer switches to that tab', /Start Here/.test(text(container)) && /Draft v0\.1/.test(text(container)))
    await act(async () => { root.unmount() })
    for (const role of ['agent']) {
      const m = await mount(<BCPPanel userRole={role} />)
      const t2 = Array.from(m.container.querySelectorAll('.border-b button')).map(b => b.textContent)
      check(`BCP: ${role} sees only the Escalation Matrix`, JSON.stringify(t2) === JSON.stringify(['Escalation Matrix']) && /Start Here/.test(text(m.container)) && !/Risk Management Plan/.test(text(m.container)))
      await act(async () => { m.root.unmount() })
    }
  } catch (e: any) { errors.push(`BCP threw: ${e?.message}`); results.push(`FAIL BCP threw: ${e?.message}`) }

  console.error = origErr
  console.log(results.join('\n'))
  const bad = errors.filter(e => /Cannot access|before initialization|is not defined|Rendered (more|fewer) hooks|Minified React|Error:|FAILED CHECK|threw/i.test(e))
  if (bad.length) { console.log('\nPROBLEMS:'); bad.forEach(b => console.log(' -', b)); process.exit(1) }
  console.log(`\nALL PASSED (${results.length} checks, no render errors)`); process.exit(0)
}
main().catch(e => { console.log('HARNESS CRASH:', e?.stack || e); process.exit(2) })

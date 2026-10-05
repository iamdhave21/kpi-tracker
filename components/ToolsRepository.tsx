'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import { supabase, Employee } from '@/lib/supabase'
import { addMonths, CYCLE_MONTHS, monthlyEquivalent, nextAction, urgency } from '@/lib/toolsRepo'

type Tool = {
  id: string, tool_name: string, vendor: string | null, category: string | null, purpose: string | null,
  access_name: string | null, account_holder: string | null, owner_name: string | null, users_with_access: string | null,
  ownership: 'ab_bss' | 'client', client: string | null,
  plan: string | null, billing_cycle: string | null, cost: number | null, currency: string,
  seats_bought: number | null, seats_used: number | null,
  start_date: string | null, end_date: string | null, renewal_date: string | null, payment_due_date: string | null,
  auto_renew: boolean, notice_period_days: number | null,
  payment_method: string | null, credentials_location: string | null,
  status: 'active' | 'trial' | 'cancelled' | 'expired', last_access_review: string | null, notes: string | null,
  created_by: string | null, updated_by: string | null, created_at: string, updated_at: string,
}

const CATEGORIES = ['Communication', 'HR / Payroll', 'Finance', 'IT / Security', 'Operations / Workforce', 'Project / Productivity', 'Client-provided', 'Other']
const CYCLES = [
  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annual', label: 'Annual' },
  { value: 'one_time', label: 'One-time' }, { value: 'other', label: 'Other' },
]
const CURRENCIES = ['USD', 'PHP', 'EUR', 'GBP', 'AUD', 'SGD']
const STATUSES = [
  { value: 'active', label: 'Active', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'trial', label: 'Trial', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'cancelled', label: 'Cancelled', style: 'bg-gray-100 text-gray-500 border-gray-200' },
  { value: 'expired', label: 'Expired', style: 'bg-red-50 text-red-600 border-red-200' },
]
const URGENCY_STYLE: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700 border-red-300',
  d7: 'bg-red-50 text-red-600 border-red-200',
  d14: 'bg-amber-50 text-amber-700 border-amber-200',
  d30: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  ok: 'bg-gray-50 text-gray-500 border-gray-200',
}

const emptyForm = {
  tool_name: '', vendor: '', category: '', purpose: '',
  access_name: '', account_holder: '', owner_name: '', users_with_access: '',
  ownership: 'ab_bss', client: '',
  plan: '', billing_cycle: 'monthly', cost: '', currency: 'USD', seats_bought: '', seats_used: '',
  start_date: '', end_date: '', renewal_date: '', payment_due_date: '', auto_renew: false, notice_period_days: '',
  payment_method: '', credentials_location: '', status: 'active', last_access_review: '', notes: '',
}
type FormState = { [K in keyof typeof emptyForm]: (typeof emptyForm)[K] extends boolean ? boolean : string }

function toForm(t: Tool): FormState {
  const v = (x: string | number | null) => (x == null ? '' : String(x))
  return {
    tool_name: t.tool_name, vendor: v(t.vendor), category: v(t.category), purpose: v(t.purpose),
    access_name: v(t.access_name), account_holder: v(t.account_holder), owner_name: v(t.owner_name), users_with_access: v(t.users_with_access),
    ownership: t.ownership, client: v(t.client),
    plan: v(t.plan), billing_cycle: v(t.billing_cycle) || 'monthly', cost: v(t.cost), currency: t.currency, seats_bought: v(t.seats_bought), seats_used: v(t.seats_used),
    start_date: v(t.start_date), end_date: v(t.end_date), renewal_date: v(t.renewal_date), payment_due_date: v(t.payment_due_date),
    auto_renew: t.auto_renew, notice_period_days: v(t.notice_period_days),
    payment_method: v(t.payment_method), credentials_location: v(t.credentials_location), status: t.status, last_access_review: v(t.last_access_review), notes: v(t.notes),
  }
}
function toPayload(f: FormState) {
  const s = (x: string) => x.trim() || null
  const n = (x: string) => (x.trim() === '' ? null : Number(x))
  return {
    tool_name: f.tool_name.trim(), vendor: s(f.vendor), category: s(f.category), purpose: s(f.purpose),
    access_name: s(f.access_name), account_holder: s(f.account_holder), owner_name: s(f.owner_name), users_with_access: s(f.users_with_access),
    ownership: f.ownership, client: f.ownership === 'client' ? s(f.client) : null,
    plan: s(f.plan), billing_cycle: s(f.billing_cycle), cost: n(f.cost), currency: f.currency, seats_bought: n(f.seats_bought), seats_used: n(f.seats_used),
    start_date: s(f.start_date), end_date: s(f.end_date), renewal_date: s(f.renewal_date), payment_due_date: s(f.payment_due_date),
    auto_renew: f.auto_renew, notice_period_days: n(f.notice_period_days),
    payment_method: s(f.payment_method), credentials_location: s(f.credentials_location), status: f.status, last_access_review: s(f.last_access_review), notes: s(f.notes),
  }
}
function money(amount: number | null, currency: string) {
  if (amount == null) return '—'
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount) } catch { return `${currency} ${amount}` }
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ToolsRepository({ currentUser, employees, showToast }: {
  currentUser: string | null, employees: Employee[], showToast: (m: string, t?: 'success' | 'error') => void,
}) {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [ownershipFilter, setOwnershipFilter] = useState('all')
  const [attentionOnly, setAttentionOnly] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('tool_subscriptions').select('*').order('tool_name')
    if (error) setLoadError(error.message)
    else { setLoadError(''); setTools((data || []) as Tool[]) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const activeEmployeeNames = employees.filter(e => e.active).map(e => e.name)
  const clientNames = Array.from(new Set(employees.map(e => e.client).filter(Boolean))) as string[]

  const rows = useMemo(() => tools.map(t => ({ tool: t, next: nextAction(t) })), [tools])

  const summary = useMemo(() => {
    const inUse = rows.filter(r => r.tool.status === 'active' || r.tool.status === 'trial')
    const overdue = inUse.filter(r => r.next && r.next.days < 0).length
    const soon = inUse.filter(r => r.next && r.next.days >= 0 && r.next.days <= 30).length
    const perCurrency: Record<string, number> = {}
    inUse.forEach(r => {
      const m = monthlyEquivalent(r.tool.cost, r.tool.billing_cycle)
      if (m != null) perCurrency[r.tool.currency] = (perCurrency[r.tool.currency] || 0) + m
    })
    return { inUse: inUse.length, overdue, soon, perCurrency }
  }, [rows])

  const visible = rows.filter(({ tool: t, next }) => {
    const q = search.trim().toLowerCase()
    if (q && ![t.tool_name, t.vendor, t.access_name, t.account_holder, t.owner_name, t.purpose].some(x => (x || '').toLowerCase().includes(q))) return false
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
    if (ownershipFilter !== 'all' && t.ownership !== ownershipFilter) return false
    if (attentionOnly && !(next && next.days <= 30)) return false
    return true
  }).sort((a, b) => {
    // Soonest action first; tools with no upcoming date go to the bottom
    const da = a.next ? a.next.days : Infinity, db = b.next ? b.next.days : Infinity
    return da !== db ? da - db : a.tool.tool_name.localeCompare(b.tool.tool_name)
  })

  function openAdd() { setEditingId(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(t: Tool) { setEditingId(t.id); setForm(toForm(t)); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tool_name.trim()) return
    if (form.ownership === 'client' && !form.client.trim()) { showToast('Pick or type which client owns this', 'error'); return }
    setSaving(true)
    const payload = { ...toPayload(form), updated_by: currentUser, updated_at: new Date().toISOString() }
    const { error } = editingId
      ? await supabase.from('tool_subscriptions').update(payload).eq('id', editingId)
      : await supabase.from('tool_subscriptions').insert({ ...payload, created_by: currentUser })
    if (error) showToast(error.message, 'error')
    else { showToast(editingId ? 'Updated!' : 'Added!'); setShowForm(false); setEditingId(null); load() }
    setSaving(false)
  }

  async function remove(t: Tool) {
    if (!confirm(`Delete "${t.tool_name}" from the repository? If it was cancelled, mark it Cancelled instead so there's a record of it.`)) return
    const { error } = await supabase.from('tool_subscriptions').delete().eq('id', t.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Deleted'); load() }
  }

  // Rolls the renewal (and payment due) date forward by one billing cycle
  // after a renewal has actually happened, so the next-action date doesn't
  // sit in the past and show as overdue forever.
  async function markRenewed(t: Tool) {
    const months = t.billing_cycle ? CYCLE_MONTHS[t.billing_cycle] : null
    if (!months || (!t.renewal_date && !t.payment_due_date)) { showToast('Set a billing cycle and a renewal or due date first', 'error'); return }
    const newRenewal = t.renewal_date ? addMonths(t.renewal_date, months) : null
    const newDue = t.payment_due_date ? addMonths(t.payment_due_date, months) : null
    if (!confirm(`Mark "${t.tool_name}" as renewed?\n${newRenewal ? `Next renewal: ${fmtDate(newRenewal)}\n` : ''}${newDue ? `Next payment due: ${fmtDate(newDue)}` : ''}`)) return
    const { error } = await supabase.from('tool_subscriptions').update({
      renewal_date: newRenewal, payment_due_date: newDue, updated_by: currentUser, updated_at: new Date().toISOString(),
    }).eq('id', t.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Renewal dates moved forward'); load() }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900'
  const label = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 text-gray-800">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Access and Tools Repository</h2>
          <p className="text-sm text-gray-500">Every tool, subscription and access account the company pays for or depends on — what it is, who owns it, what it costs, and when it renews.</p>
        </div>
        <button onClick={() => (showForm ? setShowForm(false) : openAdd())} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          {showForm ? 'Cancel' : '+ Add Tool'}
        </button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load the repository: {loadError}. If this is the first time using it, the table hasn&apos;t been created yet — run <code>tools-repository-schema.sql</code> in the Supabase SQL Editor.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">In use</p>
          <p className="text-2xl font-bold text-blue-900">{summary.inUse}</p>
          <p className="text-xs text-gray-400">active or on trial</p>
        </div>
        <button onClick={() => setAttentionOnly(!attentionOnly)} className={`text-left bg-white border rounded-xl p-4 transition ${attentionOnly ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}>
          <p className="text-xs text-gray-500">Due within 30 days</p>
          <p className="text-2xl font-bold text-amber-600">{summary.soon}</p>
          <p className="text-xs text-gray-400">{attentionOnly ? 'showing only these + overdue (click to clear)' : 'click to filter'}</p>
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Overdue</p>
          <p className={`text-2xl font-bold ${summary.overdue ? 'text-red-600' : 'text-gray-400'}`}>{summary.overdue}</p>
          <p className="text-xs text-gray-400">date has passed, not marked renewed</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Monthly run-rate</p>
          {Object.keys(summary.perCurrency).length === 0 ? <p className="text-2xl font-bold text-gray-300">—</p> : (
            Object.entries(summary.perCurrency).map(([cur, amt]) => <p key={cur} className="text-lg font-bold text-blue-900 leading-tight">{money(amt, cur)}</p>)
          )}
          <p className="text-xs text-gray-400">per currency, no conversion; one-time costs excluded</p>
        </div>
      </div>

      {/* Add / edit form */}
      {showForm && (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-blue-900">{editingId ? 'Edit tool' : 'Add a tool'}</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            Don&apos;t enter passwords, API keys or card numbers here. &ldquo;Where the login is kept&rdquo; is for the <em>location</em> (e.g. &ldquo;Password manager, Admin vault&rdquo;), and the payment method is a label only.
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">The tool</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={label}>Tool name *</label><input required value={form.tool_name} onChange={e => set('tool_name', e.target.value)} className={input} placeholder="e.g. Vercel" /></div>
              <div><label className={label}>Vendor</label><input value={form.vendor} onChange={e => set('vendor', e.target.value)} className={input} placeholder="e.g. Vercel Inc." /></div>
              <div><label className={label}>Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className={input}>
                  <option value="">Select…</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-3"><label className={label}>What it&apos;s used for</label><input value={form.purpose} onChange={e => set('purpose', e.target.value)} className={input} placeholder="e.g. Hosts the Ops Portal" /></div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Access</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={label}>Access / account name</label><input value={form.access_name} onChange={e => set('access_name', e.target.value)} className={input} placeholder="e.g. Pro plan — company team" /></div>
              <div><label className={label}>Account / admin holder</label><input value={form.account_holder} onChange={e => set('account_holder', e.target.value)} className={input} placeholder="the login email or account ID" /></div>
              <div><label className={label}>Internal owner</label>
                <input list="tool-owner-list" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} className={input} placeholder="who is responsible for it" />
                <datalist id="tool-owner-list">{activeEmployeeNames.map(n => <option key={n} value={n} />)}</datalist>
              </div>
              <div className="sm:col-span-2"><label className={label}>Who has access</label><input value={form.users_with_access} onChange={e => set('users_with_access', e.target.value)} className={input} placeholder="names or groups, e.g. Ops leadership; all Team Leads" /></div>
              <div><label className={label}>Where the login is kept</label><input value={form.credentials_location} onChange={e => set('credentials_location', e.target.value)} className={input} placeholder="e.g. Password manager, Admin vault" /></div>
              <div><label className={label}>Whose is it</label>
                <select value={form.ownership} onChange={e => set('ownership', e.target.value)} className={input}>
                  <option value="ab_bss">AB BSS</option><option value="client">A client&apos;s</option>
                </select>
              </div>
              {form.ownership === 'client' && (
                <div><label className={label}>Which client *</label>
                  <input list="tool-client-list" value={form.client} onChange={e => set('client', e.target.value)} className={input} />
                  <datalist id="tool-client-list">{clientNames.map(n => <option key={n} value={n} />)}</datalist>
                </div>
              )}
              <div><label className={label}>Seats bought</label><input type="number" min={0} value={form.seats_bought} onChange={e => set('seats_bought', e.target.value)} className={input} /></div>
              <div><label className={label}>Seats in use</label><input type="number" min={0} value={form.seats_used} onChange={e => set('seats_used', e.target.value)} className={input} /></div>
              <div><label className={label}>Last access review</label><input type="date" value={form.last_access_review} onChange={e => set('last_access_review', e.target.value)} className={input} /></div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cost and billing</legend>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div><label className={label}>Plan / subscription</label><input value={form.plan} onChange={e => set('plan', e.target.value)} className={input} placeholder="e.g. Pro, 5 seats" /></div>
              <div><label className={label}>Billing cycle</label>
                <select value={form.billing_cycle} onChange={e => set('billing_cycle', e.target.value)} className={input}>{CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              </div>
              <div><label className={label}>Cost per cycle</label><input type="number" min={0} step="0.01" value={form.cost} onChange={e => set('cost', e.target.value)} className={input} /></div>
              <div><label className={label}>Currency</label>
                <select value={form.currency} onChange={e => set('currency', e.target.value)} className={input}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="sm:col-span-2"><label className={label}>Payment method (label only)</label><input value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={input} placeholder="e.g. Company card, GCash business" /></div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dates and status</legend>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div><label className={label}>Start date</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={input} /></div>
              <div><label className={label}>Renewal date</label><input type="date" value={form.renewal_date} onChange={e => set('renewal_date', e.target.value)} className={input} /></div>
              <div><label className={label}>Payment due date</label><input type="date" value={form.payment_due_date} onChange={e => set('payment_due_date', e.target.value)} className={input} /></div>
              <div><label className={label}>End date (contract / access ends)</label><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={input} /></div>
              <div><label className={label}>Notice needed to cancel (days)</label><input type="number" min={0} value={form.notice_period_days} onChange={e => set('notice_period_days', e.target.value)} className={input} /></div>
              <div><label className={label}>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={input}>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 pt-5"><input type="checkbox" checked={form.auto_renew} onChange={e => set('auto_renew', e.target.checked)} /> Renews automatically</label>
              <div className="sm:col-span-4"><label className={label}>Notes</label><textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className={input} /></div>
            </div>
          </fieldset>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add tool'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="text-sm text-gray-500 px-3">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tool, vendor, account, owner…" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white w-72 focus:outline-none focus:ring-2 focus:ring-blue-900" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
          <option value="all">All statuses</option>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
          <option value="all">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={ownershipFilter} onChange={e => setOwnershipFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
          <option value="all">AB BSS and client</option><option value="ab_bss">AB BSS only</option><option value="client">Client-owned only</option>
        </select>
        {(search || statusFilter !== 'all' || categoryFilter !== 'all' || ownershipFilter !== 'all' || attentionOnly) && (
          <button onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); setOwnershipFilter('all'); setAttentionOnly(false) }} className="text-xs text-blue-600 hover:underline">Clear filters</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{visible.length} of {tools.length}</span>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-2 font-medium text-gray-500">Tool</th>
              <th className="px-4 py-2 font-medium text-gray-500">Access / account</th>
              <th className="px-4 py-2 font-medium text-gray-500">Owner</th>
              <th className="px-4 py-2 font-medium text-gray-500">Cost</th>
              <th className="px-4 py-2 font-medium text-gray-500">Seats</th>
              <th className="px-4 py-2 font-medium text-gray-500">Next date</th>
              <th className="px-4 py-2 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
              : visible.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{tools.length === 0 ? 'Nothing here yet — add the first tool.' : 'No tools match these filters.'}</td></tr>
              : visible.map(({ tool: t, next }) => {
                const open = expandedId === t.id
                const st = STATUSES.find(s => s.value === t.status)!
                const over = t.seats_bought != null && t.seats_used != null && t.seats_used > t.seats_bought
                return (
                  <Fragment key={t.id}>
                    <tr onClick={() => setExpandedId(open ? null : t.id)} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{t.tool_name}</p>
                        <p className="text-xs text-gray-400">{[t.vendor, t.category].filter(Boolean).join(' · ') || '—'}{t.ownership === 'client' ? ` · client: ${t.client}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600"><p>{t.access_name || '—'}</p><p className="text-xs text-gray-400">{t.account_holder || ''}</p></td>
                      <td className="px-4 py-3 text-gray-600">{t.owner_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{money(t.cost, t.currency)}{t.billing_cycle && t.cost != null ? <span className="text-xs text-gray-400"> / {CYCLES.find(c => c.value === t.billing_cycle)?.label.toLowerCase()}</span> : null}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {t.seats_bought == null && t.seats_used == null ? '—' : <span className={over ? 'text-red-600 font-medium' : ''}>{t.seats_used ?? '?'} / {t.seats_bought ?? '?'}{over ? ' over' : ''}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {next ? (
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${URGENCY_STYLE[urgency(next.days)]}`}>
                            {next.label} {fmtDate(next.date)} · {next.days < 0 ? `${-next.days}d overdue` : next.days === 0 ? 'today' : `in ${next.days}d`}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${st.style}`}>{st.label}</span></td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                            {([
                              ['Purpose', t.purpose], ['Plan', t.plan], ['Who has access', t.users_with_access],
                              ['Login kept in', t.credentials_location], ['Payment method', t.payment_method],
                              ['Start date', fmtDate(t.start_date)], ['Renewal date', fmtDate(t.renewal_date)], ['Payment due', fmtDate(t.payment_due_date)],
                              ['End date', fmtDate(t.end_date)], ['Auto-renews', t.auto_renew ? 'Yes' : 'No'],
                              ['Notice to cancel', t.notice_period_days != null ? `${t.notice_period_days} days` : null],
                              ['Last access review', fmtDate(t.last_access_review)],
                              ['Last updated', `${new Date(t.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}${t.updated_by ? ` by ${t.updated_by.split('@')[0]}` : ''}`],
                            ] as [string, string | null][]).map(([k, v]) => (
                              <div key={k}><p className="text-gray-400">{k}</p><p className="text-gray-800">{v && v !== '—' ? v : '—'}</p></div>
                            ))}
                            {t.notes && <div className="sm:col-span-3"><p className="text-gray-400">Notes</p><p className="text-gray-800 whitespace-pre-wrap">{t.notes}</p></div>}
                          </div>
                          <div className="flex gap-4 mt-4 text-xs">
                            <button onClick={e => { e.stopPropagation(); openEdit(t) }} className="text-blue-600 hover:underline">Edit</button>
                            {(t.status === 'active' || t.status === 'trial') && <button onClick={e => { e.stopPropagation(); markRenewed(t) }} className="text-emerald-700 hover:underline">Mark renewed</button>}
                            <button onClick={e => { e.stopPropagation(); remove(t) }} className="text-red-500 hover:underline">Delete</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

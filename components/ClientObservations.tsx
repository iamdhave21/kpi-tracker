'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, Employee } from '@/lib/supabase'
import { ymdLocal, daysUntil } from '@/lib/toolsRepo'
import { canSeeEntry, canEditEntry, OBS_CATEGORIES, OBS_TONES, OBS_SIGNIFICANCE, OBS_PERSON_ROLES } from '@/lib/clientObs'

type Entry = {
  id: string, client: string, event_date: string, category: string, tone: string, significance: string,
  title: string, details: string, client_person: string | null, client_person_role: string | null,
  staff_involved: string | null, links: string | null,
  follow_up_needed: boolean, follow_up_owner: string | null, follow_up_due: string | null, follow_up_done: boolean,
  created_by: string, created_by_name: string | null, created_at: string, updated_at: string,
}

const SIG_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200', medium: 'bg-amber-50 text-amber-700 border-amber-200', low: 'bg-gray-50 text-gray-500 border-gray-200',
}
const OTHER = '__other__'

function emptyForm() {
  return {
    client: '', customClient: '', event_date: ymdLocal(new Date()), category: OBS_CATEGORIES[0], tone: 'neutral', significance: 'medium',
    title: '', details: '', client_person: '', client_person_role: '', staff_involved: '', links: '',
    follow_up_needed: false, follow_up_owner: '', follow_up_due: '',
  }
}
type FormState = ReturnType<typeof emptyForm>

function fmt(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function clientsOf(e: Employee | undefined): string[] {
  if (!e) return []
  if (e.clients_supported && e.clients_supported.length > 0) return e.clients_supported
  return e.client ? [e.client] : []
}
function linkList(links: string | null): string[] {
  return (links || '').split('\n').map(l => l.trim()).filter(l => /^https?:\/\//i.test(l))
}

export default function ClientObservations({ currentUser, userRole, employees, isPreviewing, showToast }: {
  currentUser: string | null, userRole: string, employees: Employee[], isPreviewing: boolean,
  showToast: (m: string, t?: 'success' | 'error') => void,
}) {
  const me = (currentUser || '').toLowerCase()
  const myEmp = employees.find(e => (e.email || '').toLowerCase() === me)
  const myName = myEmp?.name || currentUser || ''
  const myClients = clientsOf(myEmp)
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'

  const [entries, setEntries] = useState<Entry[]>([])
  const [knownClients, setKnownClients] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [toneFilter, setToneFilter] = useState('all')
  const [sigFilter, setSigFilter] = useState('all')
  const [range, setRange] = useState<'30' | '90' | 'all'>('90')
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyFollowUps, setOnlyFollowUps] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data, error }, { data: c1 }, { data: c2 }] = await Promise.all([
      supabase.from('client_observations').select('*').order('event_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('client_contacts').select('client'),
      supabase.from('handover_pack_records').select('client'),
    ])
    if (error) setLoadError(error.message)
    else { setLoadError(''); setEntries((data || []) as Entry[]) }
    // Client choices: anything already known to the portal, plus what staff support
    const names = new Set<string>()
    ;(c1 || []).forEach((r: any) => r.client && names.add(r.client))
    ;(c2 || []).forEach((r: any) => r.client && names.add(r.client))
    employees.forEach(e => { clientsOf(e).forEach(c => names.add(c)) })
    ;(data || []).forEach((r: any) => r.client && names.add(r.client))
    setKnownClients(Array.from(names).sort())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // The visibility rule lives in lib/clientObs.ts (tested); everything below
  // only ever works from this already-filtered list.
  const mine = useMemo(() => entries.filter(e => canSeeEntry(e, userRole, me, myClients)), [entries, userRole, me, myClients.join('|')])

  const visible = mine.filter(e => {
    const q = search.trim().toLowerCase()
    if (q && ![e.title, e.details, e.client, e.client_person, e.staff_involved, e.created_by_name].some(x => (x || '').toLowerCase().includes(q))) return false
    if (clientFilter !== 'all' && e.client !== clientFilter) return false
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
    if (toneFilter !== 'all' && e.tone !== toneFilter) return false
    if (sigFilter !== 'all' && e.significance !== sigFilter) return false
    if (range !== 'all' && daysUntil(e.event_date) < -Number(range)) return false
    if (onlyMine && e.created_by.toLowerCase() !== me) return false
    if (onlyFollowUps && !(e.follow_up_needed && !e.follow_up_done)) return false
    return true
  })

  const summary = useMemo(() => {
    const month = ymdLocal(new Date()).slice(0, 7)
    const open = mine.filter(e => e.follow_up_needed && !e.follow_up_done)
    return {
      thisMonth: mine.filter(e => e.event_date.startsWith(month)).length,
      concerns: mine.filter(e => (e.tone === 'concern' || e.tone === 'risk') && daysUntil(e.event_date) >= -30).length,
      high: mine.filter(e => e.significance === 'high' && daysUntil(e.event_date) >= -30).length,
      followOpen: open.length,
      followOverdue: open.filter(e => e.follow_up_due && daysUntil(e.follow_up_due) < 0).length,
    }
  }, [mine])

  function openAdd() { setEditingId(null); setForm(emptyForm()); setShowForm(true) }
  function openEdit(e: Entry) {
    setEditingId(e.id)
    const known = knownClients.includes(e.client)
    setForm({
      client: known ? e.client : OTHER, customClient: known ? '' : e.client, event_date: e.event_date, category: e.category, tone: e.tone, significance: e.significance,
      title: e.title, details: e.details, client_person: e.client_person || '', client_person_role: e.client_person_role || '',
      staff_involved: e.staff_involved || '', links: e.links || '', follow_up_needed: e.follow_up_needed, follow_up_owner: e.follow_up_owner || '', follow_up_due: e.follow_up_due || '',
    })
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    if (isPreviewing) { showToast('Preview mode is view-only — switch back to log an entry', 'error'); return }
    const client = form.client === OTHER ? form.customClient.trim() : form.client
    if (!client || !form.title.trim() || !form.details.trim()) return
    setSaving(true)
    const s = (x: string) => x.trim() || null
    const payload = {
      client, event_date: form.event_date, category: form.category, tone: form.tone, significance: form.significance,
      title: form.title.trim(), details: form.details.trim(), client_person: s(form.client_person), client_person_role: form.client_person ? s(form.client_person_role) : null,
      staff_involved: s(form.staff_involved), links: s(form.links),
      follow_up_needed: form.follow_up_needed, follow_up_owner: form.follow_up_needed ? s(form.follow_up_owner) : null,
      follow_up_due: form.follow_up_needed ? s(form.follow_up_due) : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = editingId
      ? await supabase.from('client_observations').update(payload).eq('id', editingId)
      : await supabase.from('client_observations').insert({ ...payload, created_by: me, created_by_name: myName })
    if (error) showToast(error.message, 'error')
    else { showToast(editingId ? 'Updated!' : 'Entry logged!'); setShowForm(false); setEditingId(null); load() }
    setSaving(false)
  }

  async function toggleFollowUp(e: Entry) {
    if (isPreviewing) { showToast('Preview mode is view-only', 'error'); return }
    const { error } = await supabase.from('client_observations').update({ follow_up_done: !e.follow_up_done, updated_at: new Date().toISOString() }).eq('id', e.id)
    if (error) showToast(error.message, 'error'); else load()
  }
  async function remove(e: Entry) {
    if (isPreviewing) { showToast('Preview mode is view-only', 'error'); return }
    if (!confirm('Delete this entry? This cannot be undone.')) return
    const { error } = await supabase.from('client_observations').delete().eq('id', e.id)
    if (error) showToast(error.message, 'error'); else { showToast('Deleted'); load() }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }))
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900'
  const label = 'block text-xs font-medium text-gray-600 mb-1'
  const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white'

  const scopeNote = isAdmin ? 'You can see every entry.'
    : userRole === 'Team Lead' ? (myClients.length ? `You see your own entries and entries for ${myClients.join(', ')}.` : 'You see your own entries. Entries for a client show here once your profile lists the clients you support.')
    : 'You see the entries you logged.'

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 text-gray-800">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Client Observations</h2>
          <p className="text-sm text-gray-500">Anything you experience with a client — events, process, behavior, performance gaps, praise, risks. Internal only; clients never see this.</p>
          <p className="text-xs text-gray-400 mt-0.5">{scopeNote}</p>
        </div>
        <button onClick={() => (showForm ? setShowForm(false) : openAdd())} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">{showForm ? 'Cancel' : '+ Log Entry'}</button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load entries: {loadError}. If this is the first time using it, run <code>client-observations-schema.sql</code> in the Supabase SQL Editor.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Logged this month</p><p className="text-2xl font-bold text-blue-900">{summary.thisMonth}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Concerns and risks (30 days)</p><p className={`text-2xl font-bold ${summary.concerns ? 'text-amber-600' : 'text-gray-400'}`}>{summary.concerns}</p><p className="text-xs text-gray-400">{summary.high} high significance</p></div>
        <button onClick={() => setOnlyFollowUps(!onlyFollowUps)} className={`text-left bg-white border rounded-xl p-4 transition ${onlyFollowUps ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}>
          <p className="text-xs text-gray-500">Open follow-ups</p><p className="text-2xl font-bold text-blue-900">{summary.followOpen}</p><p className="text-xs text-gray-400">{onlyFollowUps ? 'showing only these (click to clear)' : 'click to filter'}</p>
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Follow-ups overdue</p><p className={`text-2xl font-bold ${summary.followOverdue ? 'text-red-600' : 'text-gray-400'}`}>{summary.followOverdue}</p></div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-blue-900">{editingId ? 'Edit entry' : 'Log an entry'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div><label className={label}>Client *</label>
              <select required value={form.client} onChange={e => set('client', e.target.value)} className={input}>
                <option value="">Select…</option>{knownClients.map(c => <option key={c} value={c}>{c}</option>)}<option value={OTHER}>Other (type a name)…</option>
              </select>
              {form.client === OTHER && <input required placeholder="Client name" value={form.customClient} onChange={e => set('customClient', e.target.value)} className={`${input} mt-2`} />}
            </div>
            <div><label className={label}>When it happened *</label><input required type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} className={input} /></div>
            <div><label className={label}>Type *</label><select value={form.category} onChange={e => set('category', e.target.value)} className={input}>{OBS_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={label}>Tone</label><select value={form.tone} onChange={e => set('tone', e.target.value)} className={input}>{OBS_TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label className={label}>Significance</label><select value={form.significance} onChange={e => set('significance', e.target.value)} className={input}>{OBS_SIGNIFICANCE.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></div>
            </div>
            <div className="sm:col-span-4"><label className={label}>Summary *</label><input required value={form.title} onChange={e => set('title', e.target.value)} className={input} placeholder="One line, e.g. Client changed the refund approval step without notice" /></div>
            <div className="sm:col-span-4"><label className={label}>What happened *</label><textarea required rows={4} value={form.details} onChange={e => set('details', e.target.value)} className={input} placeholder="Facts first: what was said or done, by whom, the impact, and what you did about it." /></div>
            <div><label className={label}>Client person involved</label>
              <input list="cobs-person-list" value={form.client_person} onChange={e => set('client_person', e.target.value)} className={input} placeholder="name" />
              <datalist id="cobs-person-list">{Array.from(new Set(entries.map(e => e.client_person).filter(Boolean))).map(n => <option key={n as string} value={n as string} />)}</datalist>
            </div>
            <div><label className={label}>Their role</label><select value={form.client_person_role} onChange={e => set('client_person_role', e.target.value)} className={input} disabled={!form.client_person}><option value="">—</option>{OBS_PERSON_ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
            <div className="sm:col-span-2"><label className={label}>AB BSS people involved</label>
              <input list="cobs-staff-list" value={form.staff_involved} onChange={e => set('staff_involved', e.target.value)} className={input} placeholder="names, comma-separated" />
              <datalist id="cobs-staff-list">{employees.filter(e => e.active).map(e => <option key={e.id} value={e.name} />)}</datalist>
            </div>
            <div className="sm:col-span-4"><label className={label}>Links (one per line — Drive, email thread, recording)</label><textarea rows={2} value={form.links} onChange={e => set('links', e.target.value)} className={input} placeholder="https://…" /></div>
            <label className="sm:col-span-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.follow_up_needed} onChange={e => set('follow_up_needed', e.target.checked)} /> This needs a follow-up</label>
            {form.follow_up_needed && (<>
              <div className="sm:col-span-2"><label className={label}>Follow-up owner</label>
                <input list="cobs-staff-list" value={form.follow_up_owner} onChange={e => set('follow_up_owner', e.target.value)} className={input} />
              </div>
              <div><label className={label}>Follow up by</label><input type="date" value={form.follow_up_due} onChange={e => set('follow_up_due', e.target.value)} className={input} /></div>
            </>)}
          </div>
          <p className="text-xs text-gray-400">Entries are internal, but keep them factual — they may be read by leadership. File attachments aren&apos;t supported yet; link to the file instead.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Log entry'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="text-sm text-gray-500 px-3">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white w-60 focus:outline-none focus:ring-2 focus:ring-blue-900" />
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className={sel}><option value="all">All clients</option>{Array.from(new Set(mine.map(e => e.client))).sort().map(c => <option key={c}>{c}</option>)}</select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={sel}><option value="all">All types</option>{OBS_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <select value={toneFilter} onChange={e => setToneFilter(e.target.value)} className={sel}><option value="all">Any tone</option>{OBS_TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <select value={sigFilter} onChange={e => setSigFilter(e.target.value)} className={sel}><option value="all">Any significance</option>{OBS_SIGNIFICANCE.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
        <select value={range} onChange={e => setRange(e.target.value as any)} className={sel}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select>
        {(isAdmin || userRole === 'Team Lead') && <label className="text-sm text-gray-600 flex items-center gap-1.5"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /> Only mine</label>}
        <span className="text-xs text-gray-400 ml-auto">{visible.length} of {mine.length}</span>
      </div>

      <div className="space-y-3">
        {loading ? <p className="text-center py-8 text-gray-400">Loading…</p>
          : visible.length === 0 ? <p className="text-center py-8 text-gray-400 bg-white border border-gray-200 rounded-xl">{mine.length === 0 ? 'No entries yet — log the first one.' : 'No entries match these filters.'}</p>
          : visible.map(e => {
            const tone = OBS_TONES.find(t => t.value === e.tone)!
            const open = expanded === e.id
            const links = linkList(e.links)
            const fuOverdue = e.follow_up_needed && !e.follow_up_done && e.follow_up_due && daysUntil(e.follow_up_due) < 0
            return (
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} title={tone.label} />
                      <span className="text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{e.client}</span>
                      <span className="text-xs text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">{e.category}</span>
                      <span className={`text-xs border rounded-full px-2 py-0.5 ${SIG_STYLE[e.significance]}`}>{e.significance}</span>
                      <span className="text-xs text-gray-400">{fmt(e.event_date)}</span>
                    </div>
                    <p className="font-medium text-gray-900">{e.title}</p>
                  </div>
                  <button onClick={() => setExpanded(open ? null : e.id)} className="text-xs text-blue-600 hover:underline flex-shrink-0">{open ? 'Hide' : 'Read'}</button>
                </div>
                {open && <p className="text-sm text-gray-700 whitespace-pre-wrap mt-3">{e.details}</p>}
                <div className="text-xs text-gray-400 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {e.client_person && <span>Client: {e.client_person}{e.client_person_role ? ` (${e.client_person_role})` : ''}</span>}
                  {e.staff_involved && <span>AB BSS: {e.staff_involved}</span>}
                  <span>Logged by {e.created_by_name || e.created_by.split('@')[0]} on {new Date(e.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{links.map((l, i) => <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">🔗 Link {i + 1}</a>)}</div>}
                {e.follow_up_needed && (
                  <div className={`mt-3 text-xs rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap border ${e.follow_up_done ? 'bg-gray-50 border-gray-200 text-gray-400' : fuOverdue ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <span>{e.follow_up_done ? 'Follow-up done' : 'Follow-up'}{e.follow_up_owner ? ` · ${e.follow_up_owner}` : ''}{e.follow_up_due ? ` · by ${fmt(e.follow_up_due)}${fuOverdue ? ` (${-daysUntil(e.follow_up_due)}d overdue)` : ''}` : ''}</span>
                    {canEditEntry(e, userRole, me) && <button onClick={() => toggleFollowUp(e)} className="underline">{e.follow_up_done ? 'Reopen' : 'Mark done'}</button>}
                  </div>
                )}
                {canEditEntry(e, userRole, me) && (
                  <div className="flex gap-4 mt-3 text-xs"><button onClick={() => openEdit(e)} className="text-blue-600 hover:underline">Edit</button><button onClick={() => remove(e)} className="text-red-500 hover:underline">Delete</button></div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Contact = { id: string, name: string, email: string, client: string, active: boolean, created_at: string }
type PackItem = { id: string, section: string, label: string, description: string | null, sort_order: number, retired_at: string | null }
type PackRecord = { id: string, client: string, account_name: string | null, contract_start_date: string | null, target_go_live_date: string | null, status: string, created_at: string }
type Submission = { id: string, pack_record_id: string, item_id: string, received: boolean, file_path: string | null, file_name: string | null, drive_link: string | null, notes: string | null, submitted_by: string | null, submitted_at: string | null, received_by: string | null, received_at: string | null }
type Gap = { id: string, pack_record_id: string, missing_item: string, impact: string | null, owner: string | null, due_date: string | null, status: string }
type ReadinessItem = { id: string, section: string, label: string, done_means: string | null, critical: boolean, sort_order: number, retired_at: string | null }
type ReadinessStatus = { id: string, pack_record_id: string, item_id: string, status: string, evidence: string | null, owner: string | null, updated_by: string | null, updated_at: string }
const READINESS_STATUS_OPTIONS = [
  { value: 'not_ready', label: 'Not Ready', color: 'bg-gray-100 text-gray-500 border-gray-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'ready', label: 'Ready', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'n_a', label: 'N/A', color: 'bg-gray-50 text-gray-400 border-gray-100' },
]

const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'accepted_with_gaps', label: 'Accepted with Logged Gaps' },
  { value: 'not_accepted', label: 'Not Accepted' },
]

export default function ClientPortalAdmin({ currentUser, showToast }: { currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [tab, setTab] = useState<'contacts'|'packs'|'items'|'readiness-items'>('packs')

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-blue-900">Client Onboarding</h2>
        <p className="text-sm text-gray-500">Manages the external Client Portal (abbss-ops-portal.vercel.app/client-portal) — contacts, onboarding progress, and the shared checklist template.</p>
      </div>
      <div className="flex gap-2 border-b border-gray-200">
        {[['packs','Handover Packs'],['contacts','Client Contacts'],['items','Checklist Items'],['readiness-items','Readiness Items']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab===id ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>
      {tab === 'packs' && <PacksTab currentUser={currentUser} showToast={showToast} />}
      {tab === 'contacts' && <ContactsTab currentUser={currentUser} showToast={showToast} />}
      {tab === 'items' && <ItemsTab showToast={showToast} />}
      {tab === 'readiness-items' && <ReadinessItemsTab showToast={showToast} />}
    </div>
  )
}

// -- Client Contacts ---------------------------------------------------
function ContactsTab({ currentUser, showToast }: { currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', client: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('client_contacts').select('*').order('created_at', { ascending: false })
    setContacts(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.client.trim()) return
    setSaving(true)
    const { error } = await supabase.from('client_contacts').insert({
      name: form.name.trim(), email: form.email.trim().toLowerCase(), client: form.client.trim(), created_by: currentUser,
    })
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    // Best-effort welcome email -- the contact is created either way.
    try {
      await fetch('/api/notify/client-portal-welcome', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: form.email.trim(), name: form.name.trim(), client: form.client.trim() }),
      })
    } catch {}
    showToast('Client contact added, welcome email sent!')
    setForm({ name: '', email: '', client: '' }); setShowForm(false); load()
    setSaving(false)
  }

  async function toggleActive(c: Contact) {
    await supabase.from('client_contacts').update({ active: !c.active }).eq('id', c.id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">+ Add Client Contact</button>
      </div>
      {showForm && (
        <form onSubmit={addContact} className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input required placeholder="Contact name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input required placeholder="Client / account name" value={form.client} onChange={e => setForm({...form, client: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <div className="sm:col-span-3">
            <button type="submit" disabled={saving} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">{saving ? 'Saving...' : 'Save & Send Welcome Email'}</button>
          </div>
        </form>
      )}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-2 font-medium text-gray-500">Name</th>
            <th className="text-left px-4 py-2 font-medium text-gray-500">Email</th>
            <th className="text-left px-4 py-2 font-medium text-gray-500">Client</th>
            <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
            <th className="text-right px-4 py-2 font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-6 text-gray-400">Loading...</td></tr> :
            contacts.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-gray-400">No client contacts yet.</td></tr> :
            contacts.map(c => (
              <tr key={c.id} className="border-b border-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-2.5 text-gray-600">{c.email}</td>
                <td className="px-4 py-2.5 text-gray-600">{c.client}</td>
                <td className="px-4 py-2.5">{c.active ? <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Active</span> : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Deactivated</span>}</td>
                <td className="px-4 py-2.5 text-right"><button onClick={() => toggleActive(c)} className="text-xs text-blue-600 hover:underline">{c.active ? 'Deactivate' : 'Reactivate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -- Handover Packs (with drill-down detail) ---------------------------
function PacksTab({ currentUser, showToast }: { currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [packs, setPacks] = useState<PackRecord[]>([])
  const [contactClients, setContactClients] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ client: '', customClient: '', account_name: '', contract_start_date: '', target_go_live_date: '' })
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('handover_pack_records').select('*').order('created_at', { ascending: false }),
      supabase.from('client_contacts').select('client'),
    ])
    setPacks(p || [])
    // Distinct client names already registered as a Client Contact -- this
    // is what the dropdown below is built from, so a pack's `client`
    // field always matches a contact's `client` field exactly. Free-typed
    // values previously risked a silent typo/case mismatch that would
    // leave a client's portal showing "no checklist set up yet" even
    // though a pack existed for them.
    setContactClients(Array.from(new Set((c || []).map((r: any) => r.client))).sort())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function createPack(e: React.FormEvent) {
    e.preventDefault()
    const clientValue = form.client === '__other__' ? form.customClient.trim() : form.client
    if (!clientValue) return
    setSaving(true)
    const { error } = await supabase.from('handover_pack_records').insert({
      client: clientValue, account_name: form.account_name.trim() || null,
      contract_start_date: form.contract_start_date || null, target_go_live_date: form.target_go_live_date || null,
      created_by: currentUser,
    })
    if (error) showToast(error.message, 'error')
    else { showToast('Handover pack created!'); setForm({ client: '', customClient: '', account_name: '', contract_start_date: '', target_go_live_date: '' }); setShowForm(false); load() }
    setSaving(false)
  }

  if (selectedId) return <PackDetail packId={selectedId} currentUser={currentUser} showToast={showToast} onBack={() => { setSelectedId(null); load() }} />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">+ New Handover Pack</button>
      </div>
      {showForm && (
        <form onSubmit={createPack} className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <select required value={form.client} onChange={e => setForm({...form, client: e.target.value})} className="w-full border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm">
              <option value="">Select a client contact...</option>
              {contactClients.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__other__">Other (type a new client name)...</option>
            </select>
            {contactClients.length === 0 && <p className="text-xs text-amber-600 mt-1">No Client Contacts added yet -- add one first on the Client Contacts tab so this list isn't empty.</p>}
            {form.client === '__other__' && (
              <input required placeholder="Client name" value={form.customClient} onChange={e => setForm({...form, customClient: e.target.value})} className="w-full border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm mt-2" />
            )}
          </div>
          <input placeholder="Account / process (optional)" value={form.account_name} onChange={e => setForm({...form, account_name: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input type="date" placeholder="Contract start" value={form.contract_start_date} onChange={e => setForm({...form, contract_start_date: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input type="date" placeholder="Target go-live" value={form.target_go_live_date} onChange={e => setForm({...form, target_go_live_date: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <div className="sm:col-span-4">
            <button type="submit" disabled={saving} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">{saving ? 'Creating...' : 'Create Pack'}</button>
          </div>
        </form>
      )}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-2 font-medium text-gray-500">Client</th>
            <th className="text-left px-4 py-2 font-medium text-gray-500">Account</th>
            <th className="text-left px-4 py-2 font-medium text-gray-500">Target Go-Live</th>
            <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-6 text-gray-400">Loading...</td></tr> :
            packs.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-gray-400">No handover packs yet.</td></tr> :
            packs.map(p => (
              <tr key={p.id} onClick={() => setSelectedId(p.id)} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{p.client}</td>
                <td className="px-4 py-2.5 text-gray-600">{p.account_name || '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{p.target_go_live_date ? new Date(p.target_go_live_date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2.5">{STATUS_OPTIONS.find(s => s.value === p.status)?.label}</td>
                <td className="px-4 py-2.5 text-right text-blue-600 text-xs">View →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// One drill-down screen: everything about a single client's pack in one
// place (checklist, gaps, acceptance status) -- per explicit request,
// so staff don't have to jump between separate screens for one client.
function PackDetail({ packId, currentUser, showToast, onBack }: { packId: string, currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void, onBack: () => void }) {
  const [pack, setPack] = useState<PackRecord | null>(null)
  const [items, setItems] = useState<PackItem[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [gaps, setGaps] = useState<Gap[]>([])
  const [readinessItems, setReadinessItems] = useState<ReadinessItem[]>([])
  const [readinessStatuses, setReadinessStatuses] = useState<ReadinessStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [gapForm, setGapForm] = useState({ missing_item: '', impact: '', owner: '', due_date: '' })
  const [showGapForm, setShowGapForm] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: i }, { data: s }, { data: g }, { data: ri }, { data: rs }] = await Promise.all([
      supabase.from('handover_pack_records').select('*').eq('id', packId).single(),
      supabase.from('handover_pack_items').select('*').is('retired_at', null).order('sort_order'),
      supabase.from('handover_pack_submissions').select('*').eq('pack_record_id', packId),
      supabase.from('handover_gaps_log').select('*').eq('pack_record_id', packId).order('created_at', { ascending: false }),
      supabase.from('go_live_readiness_items').select('*').is('retired_at', null).order('sort_order'),
      supabase.from('go_live_readiness_statuses').select('*').eq('pack_record_id', packId),
    ])
    setPack(p); setItems(i || []); setSubmissions(s || []); setGaps(g || [])
    setReadinessItems(ri || []); setReadinessStatuses(rs || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [packId])

  async function setReadinessStatus(itemId: string, status: string, existing?: ReadinessStatus) {
    if (existing) {
      await supabase.from('go_live_readiness_statuses').update({ status, updated_by: currentUser, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('go_live_readiness_statuses').insert({ pack_record_id: packId, item_id: itemId, status, updated_by: currentUser })
    }
    load()
  }

  async function updateStatus(status: string) {
    await supabase.from('handover_pack_records').update({ status, updated_at: new Date().toISOString() }).eq('id', packId)
    load()
  }

  async function toggleReceived(itemId: string, current?: Submission) {
    if (current) {
      await supabase.from('handover_pack_submissions').update({
        received: !current.received, received_by: !current.received ? currentUser : null, received_at: !current.received ? new Date().toISOString() : null,
      }).eq('id', current.id)
    } else {
      await supabase.from('handover_pack_submissions').insert({
        pack_record_id: packId, item_id: itemId, received: true, received_by: currentUser, received_at: new Date().toISOString(),
      })
    }
    load()
  }

  async function viewFile(sub: Submission) {
    if (!sub.file_path || !currentUser) return
    const res = await fetch('/api/client-portal/staff-file', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: sub.id, staff_email: currentUser }),
    })
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
    else showToast(data.error || 'Could not open file', 'error')
  }

  async function addGap(e: React.FormEvent) {
    e.preventDefault()
    if (!gapForm.missing_item.trim()) return
    await supabase.from('handover_gaps_log').insert({
      pack_record_id: packId, missing_item: gapForm.missing_item.trim(), impact: gapForm.impact.trim() || null,
      owner: gapForm.owner.trim() || null, due_date: gapForm.due_date || null,
    })
    setGapForm({ missing_item: '', impact: '', owner: '', due_date: '' }); setShowGapForm(false); load()
  }
  async function closeGap(id: string) {
    await supabase.from('handover_gaps_log').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  if (loading || !pack) return <div className="text-center py-12 text-gray-400">Loading...</div>

  const bySection: Record<string, PackItem[]> = {}
  items.forEach(i => { (bySection[i.section] ||= []).push(i) })
  const subByItem: Record<string, Submission> = {}
  submissions.forEach(s => { subByItem[s.item_id] = s })
  const receivedCount = submissions.filter(s => s.received).length

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Back to all packs</button>

      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-blue-900">{pack.client}</h3>
          <p className="text-sm text-gray-500">{pack.account_name || 'No account name set'} · {receivedCount}/{items.length} items received</p>
        </div>
        <select value={pack.status} onChange={e => updateStatus(e.target.value)} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm">
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {Object.entries(bySection).map(([section, sectionItems]) => (
        <div key={section} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 bg-gray-50 border-b border-gray-100">{section}</p>
          <div className="divide-y divide-gray-50">
            {sectionItems.map(item => {
              const sub = subByItem[item.id]
              return (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    {sub?.submitted_at && <p className="text-xs text-gray-400 mt-0.5">Submitted by {sub.submitted_by} on {new Date(sub.submitted_at).toLocaleDateString()}{sub.notes ? ` — "${sub.notes}"` : ''}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sub?.file_path && <button onClick={() => viewFile(sub)} className="text-xs text-blue-600 hover:underline">View file</button>}
                    {sub?.drive_link && <a href={sub.drive_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Open link</a>}
                    <button onClick={() => toggleReceived(item.id, sub)} className={`text-xs px-2.5 py-1 rounded-full border transition ${sub?.received ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'}`}>
                      {sub?.received ? '✓ Received' : 'Mark Received'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h4 className="text-sm font-semibold text-blue-900">Go-Live Readiness (internal)</h4>
          {(() => {
            const criticalItems = readinessItems.filter(i => i.critical)
            const statusByItem: Record<string, ReadinessStatus> = {}
            readinessStatuses.forEach(s => { statusByItem[s.item_id] = s })
            const readyCritical = criticalItems.filter(i => statusByItem[i.id]?.status === 'ready').length
            return <span className="text-xs text-gray-500">{readyCritical}/{criticalItems.length} critical items ready — this % is what the client sees, nothing else on this list</span>
          })()}
        </div>
        {(() => {
          const bySection: Record<string, ReadinessItem[]> = {}
          readinessItems.forEach(i => { (bySection[i.section] ||= []).push(i) })
          const statusByItem: Record<string, ReadinessStatus> = {}
          readinessStatuses.forEach(s => { statusByItem[s.item_id] = s })
          return (
            <div className="mt-3 space-y-3">
              {Object.entries(bySection).map(([section, sectionItems]) => (
                <div key={section}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{section}</p>
                  <div className="space-y-1">
                    {sectionItems.map(item => {
                      const st = statusByItem[item.id]
                      const current = st?.status || 'not_ready'
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                          <div className="min-w-0 flex items-center gap-2">
                            {item.critical && <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 flex-shrink-0">Critical</span>}
                            <span className="text-sm text-gray-700 truncate">{item.label}</span>
                          </div>
                          <select value={current} onChange={e => setReadinessStatus(item.id, e.target.value, st)} className={`text-xs px-2 py-1 rounded-full border flex-shrink-0 ${READINESS_STATUS_OPTIONS.find(o=>o.value===current)?.color}`}>
                            {READINESS_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-blue-900">Gaps Log</h4>
          <button onClick={() => setShowGapForm(!showGapForm)} className="text-xs text-blue-600 hover:underline">+ Log a gap</button>
        </div>
        {showGapForm && (
          <form onSubmit={addGap} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
            <input required placeholder="Missing item" value={gapForm.missing_item} onChange={e => setGapForm({...gapForm, missing_item: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-1.5 text-xs sm:col-span-2" />
            <input placeholder="Owner" value={gapForm.owner} onChange={e => setGapForm({...gapForm, owner: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-1.5 text-xs" />
            <input type="date" value={gapForm.due_date} onChange={e => setGapForm({...gapForm, due_date: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-1.5 text-xs" />
            <input placeholder="Impact if not resolved" value={gapForm.impact} onChange={e => setGapForm({...gapForm, impact: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-1.5 text-xs sm:col-span-3" />
            <button type="submit" className="bg-blue-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg">Add</button>
          </form>
        )}
        {gaps.length === 0 ? <p className="text-sm text-gray-400">No gaps logged.</p> : (
          <div className="space-y-1.5">
            {gaps.map(g => (
              <div key={g.id} className={`flex items-center justify-between text-sm border rounded-lg px-3 py-2 ${g.status==='closed' ? 'bg-gray-50 border-gray-100 text-gray-400' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <span>{g.missing_item}{g.owner ? ` · ${g.owner}` : ''}{g.due_date ? ` · due ${new Date(g.due_date).toLocaleDateString()}` : ''}</span>
                {g.status !== 'closed' && <button onClick={() => closeGap(g.id)} className="text-xs underline flex-shrink-0 ml-2">Mark closed</button>}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">The client can see this Gaps Log (read-only) in their own portal.</p>
      </div>
    </div>
  )
}

// -- Checklist Items (shared, editable template) ------------------------
function ItemsTab({ showToast }: { showToast: (m: string, t?: 'success'|'error') => void }) {
  const [items, setItems] = useState<PackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ section: '', label: '', description: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ section: '', label: '', description: '' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('handover_pack_items').select('*').is('retired_at', null).order('sort_order')
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.section.trim() || !form.label.trim()) return
    const id = `custom-${Date.now()}`
    const maxOrder = Math.max(0, ...items.map(i => i.sort_order)) + 1
    const { error } = await supabase.from('handover_pack_items').insert({
      id, section: form.section.trim(), label: form.label.trim(), description: form.description.trim() || null, sort_order: maxOrder,
    })
    if (error) showToast(error.message, 'error')
    else { showToast('Item added!'); setForm({ section: '', label: '', description: '' }); setShowForm(false); load() }
  }

  function startEdit(item: PackItem) {
    setEditingId(item.id)
    setEditDraft({ section: item.section, label: item.label, description: item.description || '' })
  }
  async function saveEdit(id: string) {
    await supabase.from('handover_pack_items').update({
      section: editDraft.section.trim(), label: editDraft.label.trim(), description: editDraft.description.trim() || null,
    }).eq('id', id)
    setEditingId(null); load()
  }
  async function retireItem(id: string) {
    if (!confirm('Retire this item? Existing client submissions against it are kept, but it will no longer appear on any checklist.')) return
    await supabase.from('handover_pack_items').update({ retired_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const bySection: Record<string, PackItem[]> = {}
  items.forEach(i => { (bySection[i.section] ||= []).push(i) })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">+ Add Checklist Item</button>
      </div>
      {showForm && (
        <form onSubmit={addItem} className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input required placeholder="Section (e.g. A. Contract & Terms)" value={form.section} onChange={e => setForm({...form, section: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input required placeholder="Item label" value={form.label} onChange={e => setForm({...form, label: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input placeholder="Description (optional)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <div className="sm:col-span-3">
            <button type="submit" className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">Add Item</button>
          </div>
        </form>
      )}
      {loading ? <p className="text-center py-6 text-gray-400">Loading...</p> : Object.entries(bySection).map(([section, sectionItems]) => (
        <div key={section} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 bg-gray-50 border-b border-gray-100">{section}</p>
          <div className="divide-y divide-gray-50">
            {sectionItems.map(item => (
              <div key={item.id} className="px-4 py-3">
                {editingId === item.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input value={editDraft.section} onChange={e => setEditDraft({...editDraft, section: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-2 py-1 text-xs" />
                    <input value={editDraft.label} onChange={e => setEditDraft({...editDraft, label: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-2 py-1 text-xs" />
                    <input value={editDraft.description} onChange={e => setEditDraft({...editDraft, description: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-2 py-1 text-xs" />
                    <div className="sm:col-span-3 flex gap-2">
                      <button onClick={() => saveEdit(item.id)} className="text-xs bg-blue-900 text-white px-3 py-1 rounded-lg">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => retireItem(item.id)} className="text-xs text-red-500 hover:underline">Retire</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// -- Go-Live Readiness Items (shared, editable template) ---------------
function ReadinessItemsTab({ showToast }: { showToast: (m: string, t?: 'success'|'error') => void }) {
  const [items, setItems] = useState<ReadinessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ section: '', label: '', done_means: '', critical: true })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ section: '', label: '', done_means: '', critical: true })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('go_live_readiness_items').select('*').is('retired_at', null).order('sort_order')
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.section.trim() || !form.label.trim()) return
    const id = `custom-${Date.now()}`
    const maxOrder = Math.max(0, ...items.map(i => i.sort_order)) + 1
    const { error } = await supabase.from('go_live_readiness_items').insert({
      id, section: form.section.trim(), label: form.label.trim(), done_means: form.done_means.trim() || null, critical: form.critical, sort_order: maxOrder,
    })
    if (error) showToast(error.message, 'error')
    else { showToast('Item added!'); setForm({ section: '', label: '', done_means: '', critical: true }); setShowForm(false); load() }
  }

  function startEdit(item: ReadinessItem) {
    setEditingId(item.id)
    setEditDraft({ section: item.section, label: item.label, done_means: item.done_means || '', critical: item.critical })
  }
  async function saveEdit(id: string) {
    await supabase.from('go_live_readiness_items').update({
      section: editDraft.section.trim(), label: editDraft.label.trim(), done_means: editDraft.done_means.trim() || null, critical: editDraft.critical,
    }).eq('id', id)
    setEditingId(null); load()
  }
  async function retireItem(id: string) {
    if (!confirm('Retire this item? It will no longer count toward any client\'s readiness %.')) return
    await supabase.from('go_live_readiness_items').update({ retired_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const bySection: Record<string, ReadinessItem[]> = {}
  items.forEach(i => { (bySection[i.section] ||= []).push(i) })
  const criticalCount = items.filter(i => i.critical).length

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Only <strong>Critical</strong> items count toward the readiness % shown to clients. {criticalCount} of {items.length} items are currently marked Critical.</p>
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">+ Add Readiness Item</button>
      </div>
      {showForm && (
        <form onSubmit={addItem} className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input required placeholder="Section (e.g. K. Something New)" value={form.section} onChange={e => setForm({...form, section: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input required placeholder="Item label" value={form.label} onChange={e => setForm({...form, label: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <input placeholder="Done means... (optional)" value={form.done_means} onChange={e => setForm({...form, done_means: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.critical} onChange={e => setForm({...form, critical: e.target.checked})} /> Critical</label>
          <div className="sm:col-span-4">
            <button type="submit" className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">Add Item</button>
          </div>
        </form>
      )}
      {loading ? <p className="text-center py-6 text-gray-400">Loading...</p> : Object.entries(bySection).map(([section, sectionItems]) => (
        <div key={section} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 bg-gray-50 border-b border-gray-100">{section}</p>
          <div className="divide-y divide-gray-50">
            {sectionItems.map(item => (
              <div key={item.id} className="px-4 py-3">
                {editingId === item.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input value={editDraft.section} onChange={e => setEditDraft({...editDraft, section: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-2 py-1 text-xs" />
                    <input value={editDraft.label} onChange={e => setEditDraft({...editDraft, label: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-2 py-1 text-xs" />
                    <input value={editDraft.done_means} onChange={e => setEditDraft({...editDraft, done_means: e.target.value})} className="border border-gray-300 rounded-lg text-gray-900 px-2 py-1 text-xs" />
                    <label className="flex items-center gap-1.5 text-xs text-gray-700"><input type="checkbox" checked={editDraft.critical} onChange={e => setEditDraft({...editDraft, critical: e.target.checked})} /> Critical</label>
                    <div className="sm:col-span-4 flex gap-2">
                      <button onClick={() => saveEdit(item.id)} className="text-xs bg-blue-900 text-white px-3 py-1 rounded-lg">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.critical && <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 flex-shrink-0">Critical</span>}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        {item.done_means && <p className="text-xs text-gray-400">{item.done_means}</p>}
                      </div>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => retireItem(item.id)} className="text-xs text-red-500 hover:underline">Retire</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

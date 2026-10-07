'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Employee } from '@/lib/supabase'
import { staffApi } from '@/lib/staffFetch'
import { SOP_DEPARTMENTS, SOP_TYPES, Card, reviewState, statusLabel } from '@/lib/sop'

const API = '/api/sop/staff'
const call = (body: Record<string, any> | FormData) => staffApi(body, API)

type DocRow = {
  id: string, code: string, title: string, doc_type: string, department: string | null, client: string | null, owner_name: string | null,
  status: string, created_by: string, updated_at: string, can_manage: boolean, needs_my_ack: boolean, awaiting_my_approval: boolean,
  current: { id: string, version_no: number, effectivity_date: string | null, next_review_date: string | null, approval_date: string | null, receiver_mode: string } | null,
  latest: { id: string, version_no: number, status: string } | null,
  acks: { expected: number, acked: number } | null,
}
type Person = { email: string, name: string, role?: string }
type Approval = { approver_email: string, approver_name: string | null, decision: string, comment: string | null, decided_at: string | null }
type Version = {
  id: string, version_no: number, status: string, summary: string | null, supersedes: string | null, cards: Card[], receiver_mode: string,
  effectivity_date: string | null, next_review_date: string | null, approval_date: string | null, created_at: string,
  approvals?: Approval[], receivers?: string[],
}
type Detail = {
  doc: any, versions: Version[], can_manage: boolean, is_manager_view: boolean,
  acks: null | { my_acked: boolean, i_am_receiver: boolean, expected?: number, acked?: number, pending?: Person[] },
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200', draft: 'bg-gray-50 text-gray-600 border-gray-200',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200', approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-red-50 text-red-700 border-red-200', superseded: 'bg-gray-50 text-gray-500 border-gray-200', retired: 'bg-gray-100 text-gray-500 border-gray-300',
}
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const btn = 'px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50'
const newId = () => 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
const Badge = ({ s, label }: { s: string, label?: string }) => (
  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[s] || STATUS_STYLE.draft}`}>{label || statusLabel(s)}</span>
)
function clientsOf(e: Employee): string[] {
  if (e.clients_supported && e.clients_supported.length > 0) return e.clients_supported
  return e.client ? [e.client] : []
}

export default function SopRepository({ userRole, employees, isPreviewing, showToast }: {
  userRole: string, employees: Employee[], isPreviewing: boolean, showToast: (m: string, t?: 'success' | 'error') => void,
}) {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [me, setMe] = useState<{ email: string, role: string, can_author: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [q, setQ] = useState(''), [fType, setFType] = useState(''), [fDept, setFDept] = useState(''), [fStatus, setFStatus] = useState('current')

  const guard = () => { if (isPreviewing) { showToast('Preview mode is view-only. Nothing was changed.', 'error'); return true } return false }

  const load = useCallback(async () => {
    const r = await call({ action: 'list' })
    if (!r.ok) { setLoadError(r.data.error || 'Could not load the repository.'); setLoading(false); return }
    setLoadError(''); setDocs(r.data.docs || []); setMe(r.data.me); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const clients = useMemo(() => Array.from(new Set(employees.flatMap(clientsOf))).sort(), [employees])
  const today = new Date()
  const filtered = useMemo(() => docs.filter(d => {
    if (fType && d.doc_type !== fType) return false
    if (fDept && d.department !== fDept) return false
    if (q) { const n = q.toLowerCase(); if (!`${d.code} ${d.title} ${d.owner_name || ''} ${d.client || ''}`.toLowerCase().includes(n)) return false }
    if (fStatus === 'current') return d.status !== 'retired'
    if (fStatus === 'needs_ack') return d.needs_my_ack
    if (fStatus === 'awaiting') return d.awaiting_my_approval
    if (fStatus === 'in_progress') return !!d.latest && ['draft', 'pending_approval', 'declined'].includes(d.latest.status)
    if (fStatus === 'retired') return d.status === 'retired'
    return true
  }), [docs, q, fType, fDept, fStatus])

  const tiles = {
    active: docs.filter(d => d.status === 'active').length,
    ack: docs.filter(d => d.needs_my_ack).length,
    approve: docs.filter(d => d.awaiting_my_approval).length,
    review: docs.filter(d => d.status === 'active' && d.can_manage && ['overdue', 'due_soon'].includes(reviewState(d.current?.next_review_date, today))).length,
  }

  if (openId) {
    return <DocDetail id={openId} me={me} isPreviewing={isPreviewing} guard={guard} showToast={showToast} clients={clients} employees={employees}
      onBack={() => { setOpenId(null); load() }} />
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SOP and LWI Repository</h1>
          <p className="text-sm text-gray-500 mt-1">Standard operating procedures and local work instructions. Read the current version, then acknowledge it.</p>
        </div>
        {me?.can_author && <button onClick={() => { if (!guard()) setShowNew(true) }} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>+ New SOP / LWI</button>}
      </div>

      {isPreviewing && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">Preview note: this screen is checked by the server for the real signed-in account, so it shows the Super Admin view here. Actions are disabled in preview.</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active documents', n: tiles.active, tone: 'text-gray-900', f: 'current' },
          { label: 'Need my acknowledgment', n: tiles.ack, tone: tiles.ack ? 'text-red-600' : 'text-gray-900', f: 'needs_ack' },
          { label: 'Waiting for my approval', n: tiles.approve, tone: tiles.approve ? 'text-amber-600' : 'text-gray-900', f: 'awaiting' },
          ...(me?.can_author ? [{ label: 'Reviews due (30 days)', n: tiles.review, tone: tiles.review ? 'text-amber-600' : 'text-gray-900', f: 'current' }] : []),
        ].map(t => (
          <button key={t.label} onClick={() => setFStatus(t.f)} className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300">
            <div className={`text-2xl font-bold ${t.tone}`}>{t.n}</div>
            <div className="text-xs text-gray-500 mt-1">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code, title, owner, client" className={`${inputCls} md:max-w-xs`} />
        <select value={fType} onChange={e => setFType(e.target.value)} className={`${inputCls} md:w-32`}><option value="">All types</option>{SOP_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <select value={fDept} onChange={e => setFDept(e.target.value)} className={`${inputCls} md:w-48`}><option value="">All departments</option>{SOP_DEPARTMENTS.map(t => <option key={t}>{t}</option>)}</select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={`${inputCls} md:w-56`}>
          <option value="current">Current (not retired)</option><option value="needs_ack">Needs my acknowledgment</option>
          {me?.can_author && <option value="in_progress">Drafts and in approval</option>}
          <option value="awaiting">Waiting for my approval</option><option value="retired">Retired</option><option value="all">Everything</option>
        </select>
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : loadError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{loadError}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
          {docs.length === 0 ? 'No documents yet.' + (me?.can_author ? ' Create the first one with “New SOP / LWI”.' : '') : 'Nothing matches these filters.'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 text-left">
              <tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Title</th><th className="px-4 py-2">Dept / client</th><th className="px-4 py-2">Version</th>
                <th className="px-4 py-2">Status</th><th className="px-4 py-2">Effective</th><th className="px-4 py-2">Next review</th><th className="px-4 py-2">Acknowledged</th></tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const rs = reviewState(d.current?.next_review_date, today)
                return (
                  <tr key={d.id} onClick={() => setOpenId(d.id)} className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{d.code} <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{d.doc_type}</span></td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{d.title}{d.owner_name && <div className="text-xs font-normal text-gray-400">Owner: {d.owner_name}</div>}</td>
                    <td className="px-4 py-3 text-gray-600">{d.department || '—'}{d.client && <div className="text-xs text-gray-400">{d.client}</div>}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {d.current ? `v${d.current.version_no}` : '—'}
                      {d.latest && ['draft', 'pending_approval', 'declined'].includes(d.latest.status) && <div className="text-xs text-amber-600">v{d.latest.version_no} {statusLabel(d.latest.status).toLowerCase()}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge s={d.status} />
                      {d.needs_my_ack && <span className="ml-1 text-xs font-medium text-red-600">Acknowledge</span>}
                      {d.awaiting_my_approval && <span className="ml-1 text-xs font-medium text-amber-600">Approve</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(d.current?.effectivity_date)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${rs === 'overdue' ? 'text-red-600 font-medium' : rs === 'due_soon' ? 'text-amber-600' : 'text-gray-600'}`}>
                      {fmt(d.current?.next_review_date)}{rs === 'overdue' && ' (overdue)'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.acks ? `${d.acks.acked} / ${d.acks.expected}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewDocModal clients={clients} employees={employees} onClose={() => setShowNew(false)} showToast={showToast}
        onCreated={id => { setShowNew(false); setOpenId(id) }} />}
    </div>
  )
}

// ---------------------------------------------------------------- create
function NewDocModal({ clients, employees, onClose, onCreated, showToast }: {
  clients: string[], employees: Employee[], onClose: () => void, onCreated: (id: string) => void, showToast: (m: string, t?: 'success' | 'error') => void,
}) {
  const [f, setF] = useState({ code: '', title: '', doc_type: 'SOP', department: 'Operations', client: '', owner_email: '' })
  const [saving, setSaving] = useState(false)
  const people = employees.filter(e => e.active && e.email).sort((a, b) => a.name.localeCompare(b.name))
  async function save() {
    setSaving(true)
    const r = await call({ action: 'create', ...f })
    setSaving(false)
    if (!r.ok) { showToast(r.data.error || 'Could not create', 'error'); return }
    onCreated(r.data.id)
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">New SOP / LWI</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">Code<input value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="OPS-SOP-001" className={inputCls} /></label>
          <label className="text-xs text-gray-600">Type<select value={f.doc_type} onChange={e => setF({ ...f, doc_type: e.target.value })} className={inputCls}>{SOP_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
        </div>
        <label className="text-xs text-gray-600 block">Title<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className={inputCls} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">Department<select value={f.department} onChange={e => setF({ ...f, department: e.target.value })} className={inputCls}>{SOP_DEPARTMENTS.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-gray-600">Client (optional)<select value={f.client} onChange={e => setF({ ...f, client: e.target.value })} className={inputCls}><option value="">None / all clients</option>{clients.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label className="text-xs text-gray-600 block">Owner (defaults to you)
          <select value={f.owner_email} onChange={e => setF({ ...f, owner_email: e.target.value })} className={inputCls}><option value="">Me</option>{people.map(p => <option key={p.id} value={p.email!}>{p.name}</option>)}</select>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={`${btn} border border-gray-300 text-gray-700`}>Cancel</button>
          <button onClick={save} disabled={saving} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>{saving ? 'Creating…' : 'Create draft'}</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- detail
function FileLink({ docId, versionId, att, showToast }: { docId: string, versionId: string, att: { name: string, path: string, size: number }, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const isImg = /\.(png|jpe?g)$/i.test(att.name)
  const [url, setUrl] = useState('')
  const fetchUrl = useCallback(async () => {
    const r = await call({ action: 'file_url', id: docId, version_id: versionId, path: att.path })
    if (r.ok && r.data.url) return r.data.url as string
    showToast(r.data.error || 'Could not open that file', 'error'); return ''
  }, [docId, versionId, att.path, showToast])
  useEffect(() => { if (isImg) fetchUrl().then(setUrl) }, [isImg, fetchUrl])
  return (
    <div className="mt-2">
      {isImg && url && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={att.name} className="max-h-80 rounded-lg border border-gray-200" /></a>}
      <button onClick={async () => { const u = await fetchUrl(); if (u) window.open(u, '_blank', 'noopener') }} className="text-sm text-blue-600 hover:underline">
        {att.name} <span className="text-xs text-gray-400">({Math.max(1, Math.round(att.size / 1024))} KB)</span>
      </button>
    </div>
  )
}

function CardView({ c, docId, versionId, showToast }: { c: Card, docId: string, versionId: string, showToast: (m: string, t?: 'success' | 'error') => void }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      {c.title && <div className="font-semibold text-gray-900 mb-1">{c.title}</div>}
      {c.body && <div className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</div>}
      {c.type === 'link' && c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{c.url}</a>}
      {c.type === 'file' && c.attachments.map(a => <FileLink key={a.path} docId={docId} versionId={versionId} att={a} showToast={showToast} />)}
    </div>
  )
}

function DocDetail({ id, me, isPreviewing, guard, showToast, clients, employees, onBack }: {
  id: string, me: { email: string, role: string, can_author: boolean } | null, isPreviewing: boolean, guard: () => boolean,
  showToast: (m: string, t?: 'success' | 'error') => void, clients: string[], employees: Employee[], onBack: () => void,
}) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [declineNote, setDeclineNote] = useState('')
  const [showPending, setShowPending] = useState(false)

  const reload = useCallback(async (keepView = true) => {
    const r = await call({ action: 'get', id })
    if (!r.ok) { setErr(r.data.error || 'Could not open this document.'); return }
    setD(r.data as Detail)
    setViewId(prev => (keepView && prev && (r.data.versions as Version[]).some(v => v.id === prev)) ? prev : null)
  }, [id])
  useEffect(() => { reload(false) }, [reload])

  if (err) return <div className="p-6 max-w-3xl mx-auto"><button onClick={onBack} className="text-sm text-blue-600 mb-3">← Back</button><div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{err}</div></div>
  if (!d) return <div className="p-6 text-sm text-gray-500">Loading…</div>

  const doc = d.doc
  const current = d.versions.find(v => v.id === doc.current_version_id) || null
  const latest = d.versions[0]   // versions arrive newest first
  const inProgress = d.versions.find(v => ['draft', 'pending_approval', 'declined'].includes(v.status)) || null
  const shown = d.versions.find(v => v.id === viewId) || current || latest
  const canManage = d.can_manage
  const iAmPendingApprover = !!inProgress && inProgress.status === 'pending_approval' && !!inProgress.approvals?.some(a => a.decision === 'pending' && me && a.approver_email.toLowerCase().split('@')[0] === me.email.split('@')[0])

  async function act(action: string, extra: Record<string, any> = {}, okMsg?: string) {
    if (guard()) return false
    setBusy(true)
    const r = await call({ action, ...extra })
    setBusy(false)
    if (!r.ok) { showToast(r.data.error || 'That did not work', 'error'); return false }
    if (okMsg) showToast(okMsg, 'success')
    await reload(false)
    return r.data
  }

  async function acknowledge() { await act('acknowledge', { id, version_id: current!.id }, 'Acknowledged. Thank you.') }
  async function decide(decision: 'approved' | 'declined') {
    const r = await act('decide', { version_id: inProgress!.id, decision, comment: declineNote }, decision === 'approved' ? 'Your approval was recorded.' : 'Declined. The author was notified.')
    if (r) setDeclineNote('')
  }
  async function newVersion() {
    const r = await act('new_version', { id }, 'New draft version created.')
    if (r) setEditing(true)
  }
  async function retire() { if (confirm('Retire this document? It disappears for everyone except managers.')) await act('retire', { id }, 'Retired.') }
  async function remind() {
    if (guard()) return
    setBusy(true); const r = await call({ action: 'remind', id }); setBusy(false)
    if (!r.ok) showToast(r.data.error || 'Could not send', 'error'); else showToast(r.data.sent ? `Reminder sent to ${r.data.sent} people.` : 'Nobody is pending, or email is not configured.', 'success')
  }

  const backBtn = <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← All documents</button>

  if (editing && inProgress && inProgress.status === 'draft' && canManage) {
    return <Editor doc={doc} version={inProgress} me={me} guard={guard} showToast={showToast} clients={clients} employees={employees}
      onClose={async () => { setEditing(false); await reload(false) }} />
  }

  const showAck = !!(d.acks && shown && current && shown.id === current.id)
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      {backBtn}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-gray-500">{doc.code} · {doc.doc_type}</div>
            <h1 className="text-xl font-bold text-gray-900">{doc.title}</h1>
            <div className="text-sm text-gray-500 mt-1">{[doc.department, doc.client, doc.owner_name && `Owner: ${doc.owner_name}`].filter(Boolean).join(' · ')}</div>
          </div>
          <Badge s={doc.status} />
        </div>
        {shown && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
            <div><div className="text-xs text-gray-400">Viewing</div><div className="text-gray-900">v{shown.version_no} <Badge s={shown.status} /></div></div>
            <div><div className="text-xs text-gray-400">Approved</div><div className="text-gray-900">{fmt(shown.approval_date)}</div></div>
            <div><div className="text-xs text-gray-400">Effective</div><div className="text-gray-900">{fmt(shown.effectivity_date)}</div></div>
            <div><div className="text-xs text-gray-400">Next review</div><div className="text-gray-900">{fmt(shown.next_review_date)}</div></div>
          </div>
        )}
        {shown?.summary && <div className="mt-3 text-sm text-gray-600"><span className="text-xs text-gray-400">What changed: </span>{shown.summary}</div>}
        {shown?.supersedes && <div className="mt-1 text-xs text-gray-400">Supersedes {shown.supersedes}</div>}
        {canManage && doc.status !== 'retired' && (
          <div className="flex flex-wrap gap-2 mt-4">
            {inProgress?.status === 'draft' && <button onClick={() => { if (!guard()) setEditing(true) }} className={`${btn} bg-blue-600 text-white`}>Edit draft v{inProgress.version_no}</button>}
            {inProgress && ['pending_approval', 'declined'].includes(inProgress.status) && <button disabled={busy} onClick={() => act('reopen', { version_id: inProgress.id }, 'Back to draft.')} className={`${btn} border border-gray-300 text-gray-700`}>{inProgress.status === 'declined' ? 'Reopen to fix' : 'Withdraw to draft'}</button>}
            {doc.status === 'active' && !inProgress && <button disabled={busy} onClick={newVersion} className={`${btn} bg-blue-600 text-white`}>New version</button>}
            {doc.status === 'active' && <button disabled={busy} onClick={retire} className={`${btn} border border-red-300 text-red-600`}>Retire</button>}
          </div>
        )}
      </div>

      {/* approval panel */}
      {inProgress && d.is_manager_view && inProgress.status !== 'draft' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Approval for v{inProgress.version_no} <Badge s={inProgress.status} /></h2>
          <div className="space-y-1.5">
            {(inProgress.approvals || []).map(a => (
              <div key={a.approver_email} className="text-sm flex flex-wrap gap-2 items-baseline">
                <span className="text-gray-900">{a.approver_name || a.approver_email}</span>
                <Badge s={a.decision === 'approved' ? 'approved' : a.decision === 'declined' ? 'declined' : 'pending_approval'} label={a.decision === 'pending' ? 'Pending' : a.decision === 'approved' ? 'Approved' : 'Declined'} />
                {a.comment && <span className="text-xs text-gray-500">“{a.comment}”</span>}
              </div>
            ))}
          </div>
          {iAmPendingApprover && (
            <div className="mt-3 space-y-2">
              <textarea value={declineNote} onChange={e => setDeclineNote(e.target.value)} rows={2} placeholder="Comment (required if you decline)" className={inputCls} />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => decide('approved')} className={`${btn} bg-emerald-600 text-white`}>Approve v{inProgress.version_no}</button>
                <button disabled={busy} onClick={() => decide('declined')} className={`${btn} border border-red-300 text-red-600`}>Decline</button>
              </div>
              <p className="text-xs text-gray-400">You are reviewing {shown && shown.id === inProgress.id ? 'the version shown below' : 'v' + inProgress.version_no + '. Pick it in version history to read it first'}.</p>
            </div>
          )}
        </div>
      )}

      {/* acknowledgment panel */}
      {showAck && d.acks && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {d.acks.i_am_receiver && (d.acks.my_acked
            ? <div className="text-sm text-emerald-700 font-medium">✓ You have acknowledged v{current!.version_no}.</div>
            : <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-red-800">Read the content below, then confirm you have read and understood v{current!.version_no}.</span>
                <button disabled={busy} onClick={acknowledge} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>I have read and understood this</button>
              </div>)}
          {d.is_manager_view && d.acks.expected !== undefined && (
            <div className={d.acks.i_am_receiver ? 'mt-4' : ''}>
              <div className="flex items-center justify-between text-sm"><span className="font-medium text-gray-900">Acknowledged {d.acks.acked} of {d.acks.expected}</span>
                {canManage && (d.acks.pending?.length || 0) > 0 && <button disabled={busy} onClick={remind} className="text-sm text-blue-600 hover:underline">Send reminder to pending</button>}</div>
              <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${d.acks.expected ? Math.round(((d.acks.acked || 0) / d.acks.expected) * 100) : 0}%` }} /></div>
              {(d.acks.pending?.length || 0) > 0 && <>
                <button onClick={() => setShowPending(!showPending)} className="text-xs text-gray-500 mt-2 hover:underline">{showPending ? 'Hide' : 'Show'} who is pending</button>
                {showPending && <div className="text-sm text-gray-600 mt-1 columns-2 md:columns-3">{d.acks.pending!.map(p => <div key={p.email}>{p.name}</div>)}</div>}
              </>}
            </div>
          )}
        </div>
      )}

      {/* content */}
      <div className="space-y-3">
        {shown && shown.status !== 'approved' && shown.status !== 'superseded' && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">This is v{shown.version_no} ({statusLabel(shown.status).toLowerCase()}). It is not the active version yet.</div>}
        {shown && shown.status === 'superseded' && <div className="text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-lg px-3 py-2">This is an older version (superseded). It is shown for history only.</div>}
        {shown && shown.cards.length === 0 && <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-6 text-center">No content yet.</div>}
        {shown?.cards.map(c => <CardView key={c.id} c={c} docId={doc.id} versionId={shown.id} showToast={showToast} />)}
      </div>

      {/* history (managers see all, others see only the current one) */}
      {d.is_manager_view && d.versions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Version history</h2>
          <div className="divide-y divide-gray-100">
            {d.versions.map(v => (
              <button key={v.id} onClick={() => { setViewId(v.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="w-full text-left py-2 flex flex-wrap items-center gap-2 hover:bg-gray-50 px-1 rounded">
                <span className="font-medium text-gray-900 text-sm">v{v.version_no}</span><Badge s={v.status} />
                <span className="text-xs text-gray-500">{v.approval_date ? `approved ${fmt(v.approval_date)}` : `created ${fmt(v.created_at)}`}</span>
                {v.summary && <span className="text-xs text-gray-400 truncate">{v.summary}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {isPreviewing && <div className="text-xs text-amber-700">Preview mode: actions are disabled.</div>}
    </div>
  )
}

// ---------------------------------------------------------------- editor
function Editor({ doc, version, me, guard, showToast, clients, employees, onClose }: {
  doc: any, version: Version, me: { email: string, role: string, can_author: boolean } | null, guard: () => boolean,
  showToast: (m: string, t?: 'success' | 'error') => void, clients: string[], employees: Employee[], onClose: () => void,
}) {
  const [meta, setMeta] = useState({ title: doc.title as string, doc_type: doc.doc_type as string, department: (doc.department || '') as string, client: (doc.client || '') as string })
  const [f, setF] = useState({
    summary: version.summary || '', supersedes: version.supersedes || '', effectivity_date: version.effectivity_date || '', next_review_date: version.next_review_date || '',
    receiver_mode: version.receiver_mode,
  })
  const [cards, setCards] = useState<Card[]>(version.cards || [])
  const [approvers, setApprovers] = useState<string[]>((version.approvals || []).map(a => a.approver_email.toLowerCase()))
  const [receivers, setReceivers] = useState<string[]>((version.receivers || []).map(e => e.toLowerCase()))
  const [people, setPeople] = useState<{ approvers: Person[], receivers: Person[] }>({ approvers: [], receivers: [] })
  const [recvFilter, setRecvFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const isAdmin = me?.role === 'admin' || me?.role === 'super_admin'
  const myLocal = (me?.email || '').toLowerCase().split('@')[0]

  useEffect(() => { call({ action: 'people' }).then(r => { if (r.ok) setPeople(r.data) }) }, [])

  const upd = (i: number, patch: Partial<Card>) => setCards(cs => cs.map((c, j) => j === i ? { ...c, ...patch } : c))
  const move = (i: number, dir: -1 | 1) => setCards(cs => { const j = i + dir; if (j < 0 || j >= cs.length) return cs; const n = cs.slice(); [n[i], n[j]] = [n[j], n[i]]; return n })
  const add = (type: Card['type']) => setCards(cs => [...cs, { id: newId(), type, title: '', body: '', url: '', attachments: [] }])
  const has = (list: string[], e: string) => list.some(x => x.split('@')[0] === e.toLowerCase().split('@')[0])
  const toggle = (list: string[], set: (v: string[]) => void, e: string) => set(has(list, e) ? list.filter(x => x.split('@')[0] !== e.toLowerCase().split('@')[0]) : [...list, e.toLowerCase()])

  async function save(silent = false): Promise<boolean> {
    if (guard()) return false
    const m = await call({ action: 'update_meta', id: doc.id, ...meta })
    if (!m.ok) { showToast(m.data.error || 'Could not save details', 'error'); return false }
    const r = await call({ action: 'save_version', version_id: version.id, ...f, cards, approvers, receivers })
    if (!r.ok) { showToast(r.data.error || 'Could not save', 'error'); return false }
    if (!silent) showToast('Draft saved.', 'success')
    return true
  }
  async function saveClick() { setBusy(true); await save(); setBusy(false) }
  async function submit() {
    setBusy(true)
    if (await save(true)) {
      const r = await call({ action: 'submit', version_id: version.id })
      if (!r.ok) showToast(r.data.error || 'Could not submit', 'error')
      else { showToast('Submitted for approval. Approvers were emailed.', 'success'); setBusy(false); onClose(); return }
    }
    setBusy(false)
  }
  async function upload(i: number, list: FileList | null) {
    if (!list || list.length === 0 || guard()) return
    setBusy(true)
    if (!(await save(true))) { setBusy(false); return }   // the card must exist on the server first
    const form = new FormData()
    form.append('action', 'add_file'); form.append('version_id', version.id); form.append('card_id', cards[i].id)
    Array.from(list).forEach(file => form.append('files', file))
    const r = await call(form)
    setBusy(false)
    if (!r.ok) { showToast(r.data.error || 'Upload failed', 'error'); return }
    upd(i, { attachments: r.data.attachments })
  }
  async function removeFile(i: number, path: string) {
    if (guard()) return
    const r = await call({ action: 'remove_file', version_id: version.id, card_id: cards[i].id, path })
    if (!r.ok) { showToast(r.data.error || 'Could not remove', 'error'); return }
    upd(i, { attachments: r.data.attachments })
  }

  const recvShown = people.receivers.filter(p => !recvFilter || p.name.toLowerCase().includes(recvFilter.toLowerCase()))
  const approverChoices = people.approvers.filter(p => isAdmin || p.email.split('@')[0] !== myLocal)

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-blue-600 hover:underline">← Back to document</button>
        <div className="text-xs text-gray-500">{doc.code} · editing draft v{version.version_no}</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Details</h2>
        <label className="text-xs text-gray-600 block">Title<input value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} className={inputCls} /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-gray-600">Type<select value={meta.doc_type} onChange={e => setMeta({ ...meta, doc_type: e.target.value })} className={inputCls}>{SOP_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-gray-600">Department<select value={meta.department} onChange={e => setMeta({ ...meta, department: e.target.value })} className={inputCls}><option value="">—</option>{SOP_DEPARTMENTS.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-gray-600">Client<select value={meta.client} onChange={e => setMeta({ ...meta, client: e.target.value })} className={inputCls}><option value="">None / all</option>{clients.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">Effectivity date (required)<input type="date" value={f.effectivity_date} onChange={e => setF({ ...f, effectivity_date: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-gray-600">Next review date<input type="date" value={f.next_review_date} onChange={e => setF({ ...f, next_review_date: e.target.value })} className={inputCls} /></label>
        </div>
        <label className="text-xs text-gray-600 block">Change summary {version.version_no > 1 ? '(required for a new version)' : '(optional for v1)'}
          <textarea value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} rows={2} className={inputCls} /></label>
        <label className="text-xs text-gray-600 block">Supersedes (what this replaces, optional)<input value={f.supersedes} onChange={e => setF({ ...f, supersedes: e.target.value })} className={inputCls} /></label>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">Content</h2>
        {cards.map((c, i) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500 uppercase">{c.type === 'file' ? 'Files / screenshots' : c.type}</span>
              <div className="flex gap-1 text-xs">
                <button onClick={() => move(i, -1)} className="px-2 py-1 border border-gray-200 rounded text-gray-600">↑</button>
                <button onClick={() => move(i, 1)} className="px-2 py-1 border border-gray-200 rounded text-gray-600">↓</button>
                <button onClick={() => { if (c.attachments.length === 0 || confirm('Delete this card and its files?')) setCards(cs => cs.filter((_, j) => j !== i)) }} className="px-2 py-1 border border-red-200 rounded text-red-600">Delete</button>
              </div>
            </div>
            <input value={c.title} onChange={e => upd(i, { title: e.target.value })} placeholder="Card title" className={inputCls} />
            {c.type === 'link' && <input value={c.url} onChange={e => upd(i, { url: e.target.value })} placeholder="https://…" className={inputCls} />}
            <textarea value={c.body} onChange={e => upd(i, { body: e.target.value })} rows={c.type === 'text' ? 6 : 2} placeholder={c.type === 'text' ? 'Steps, rules, notes…' : 'Optional description'} className={inputCls} />
            {c.type === 'file' && (
              <div className="space-y-1">
                {c.attachments.map(a => (
                  <div key={a.path} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1"><span className="text-gray-700 truncate">{a.name}</span>
                    <button onClick={() => removeFile(i, a.path)} className="text-xs text-red-600">Remove</button></div>
                ))}
                <label className="inline-block text-sm text-blue-600 cursor-pointer hover:underline">+ Attach files (PDF, images, Office, up to 4 MB total per upload)
                  <input type="file" multiple className="hidden" disabled={busy} onChange={e => { upload(i, e.target.files); e.target.value = '' }} /></label>
              </div>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => add('text')} className={`${btn} border border-gray-300 text-gray-700`}>+ Text</button>
          <button onClick={() => add('link')} className={`${btn} border border-gray-300 text-gray-700`}>+ Link</button>
          <button onClick={() => add('file')} className={`${btn} border border-gray-300 text-gray-700`}>+ Files / screenshots</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Approvers (all must approve)</h2>
        <div className="grid sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
          {approverChoices.length === 0 && <div className="text-sm text-gray-400">Loading…</div>}
          {approverChoices.map(p => (
            <label key={p.email} className="flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={has(approvers, p.email)} onChange={() => toggle(approvers, setApprovers, p.email)} />
              {p.name} <span className="text-xs text-gray-400">{p.role === 'Team Lead' ? 'Team Lead' : 'Admin'}</span></label>
          ))}
        </div>
        <h2 className="font-semibold text-gray-900 pt-2">Who must acknowledge</h2>
        <div className="flex gap-4 text-sm text-gray-800">
          <label className="flex items-center gap-2"><input type="radio" checked={f.receiver_mode === 'all'} onChange={() => setF({ ...f, receiver_mode: 'all' })} /> Everyone</label>
          <label className="flex items-center gap-2"><input type="radio" checked={f.receiver_mode === 'selected'} onChange={() => setF({ ...f, receiver_mode: 'selected' })} /> Selected people only</label>
        </div>
        {f.receiver_mode === 'selected' && (
          <div className="space-y-2">
            <input value={recvFilter} onChange={e => setRecvFilter(e.target.value)} placeholder="Filter names" className={inputCls} />
            <div className="grid sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto">
              {recvShown.map(p => <label key={p.email} className="flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={has(receivers, p.email)} onChange={() => toggle(receivers, setReceivers, p.email)} />{p.name}</label>)}
            </div>
            <div className="text-xs text-gray-400">{receivers.length} selected. Only these people can see the document.</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 sticky bottom-3">
        <button disabled={busy} onClick={saveClick} className={`${btn} bg-white border border-gray-300 text-gray-700 shadow`}>{busy ? 'Working…' : 'Save draft'}</button>
        <button disabled={busy} onClick={submit} className={`${btn} bg-blue-600 text-white hover:bg-blue-700 shadow`}>Save and submit for approval</button>
      </div>
    </div>
  )
}

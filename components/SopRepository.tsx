'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Employee } from '@/lib/supabase'
import { staffApi } from '@/lib/staffFetch'
import { SOP_DEPARTMENTS, SOP_TYPES, Card, reviewState, statusLabel, methodLabel } from '@/lib/sop'
import { ymdLocal } from '@/lib/toolsRepo'

const API = '/api/sop/staff'
const call = (body: Record<string, any> | FormData) => staffApi(body, API)

type DocRow = {
  id: string, code: string, title: string, doc_type: string, department: string | null, client: string | null, owner_name: string | null, added_by_name: string | null, approved_by: string | null, approval_source: string | null, proof_missing: boolean,
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
  approvals?: Approval[], receivers?: string[], approval_source: string, proofs?: Proof[],
}
type ProofFile = { name: string, path: string, size: number, added_by_name?: string, added_at?: string }
type Proof = { id?: string, approved_by_name: string, approved_by_role: string | null, approved_on: string, method: string, note?: string | null, attachments?: ProofFile[], added_by_name?: string | null, created_at?: string }
type Change = { id: string, version_id: string, version_no: number, version_status: string, summary: string, previous_text?: string | null, reason: string | null, requested_by: string | null, requested_by_role: string | null, requested_on: string | null, effective_date: string | null, approval_path: string, request_ref?: string | null, added_by_name: string | null, created_at: string, approved: Proof[] }
type EditRow = { id: string, note: string, edited_by_name: string | null, created_at: string }
type Detail = {
  doc: any, versions: Version[], can_manage: boolean, is_manager_view: boolean, proof_missing: boolean, changes: Change[], edits: EditRow[],
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
  const [showQuick, setShowQuick] = useState(false)
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
        {me?.can_author && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { if (!guard()) setShowQuick(true) }} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>+ Add document</button>
            <button onClick={() => { if (!guard()) setShowNew(true) }} className={`${btn} border border-gray-300 text-gray-700 bg-white`}>New draft (needs approval)</button>
          </div>
        )}
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
                <th className="px-4 py-2">Status</th><th className="px-4 py-2">Effective</th><th className="px-4 py-2">Next review</th><th className="px-4 py-2">Acknowledged</th><th className="px-4 py-2">Added by</th><th className="px-4 py-2">Approved by</th></tr>
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
                    <td className="px-4 py-3 text-gray-600">{d.added_by_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.approved_by || '—'}{d.proof_missing && <div className="text-xs font-medium text-amber-600">Proof missing</div>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showQuick && <QuickAddModal clients={clients} showToast={showToast} onClose={() => setShowQuick(false)} onDone={id => { setShowQuick(false); setOpenId(id) }} />}
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

// ---------------------------------------------------------------- shared bits
type Toast = (m: string, t?: 'success' | 'error') => void
const METHOD_OPTIONS = ['email', 'chat', 'call', 'meeting', 'other']
type ProofForm = { approved_by_name: string, approved_by_role: string, approved_on: string, method: string, note: string }
const emptyProof = (): ProofForm => ({ approved_by_name: '', approved_by_role: '', approved_on: ymdLocal(new Date()), method: 'chat', note: '' })
const MAX_BYTES = 4 * 1024 * 1024

// Returns a readable problem with a file selection, or ''.
function fileProblem(files: File[]): string {
  if (files.length > 5) return 'Attach up to 5 files at a time.'
  if (files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) return 'Files are limited to 4 MB in total per upload. Send the rest in a second upload, or use a smaller screenshot.'
  return ''
}
function sendFiles(fields: Record<string, string>, files: File[]) {
  const form = new FormData()
  Object.entries(fields).forEach(([k, v]) => form.append(k, v))
  files.forEach(f => form.append('files', f))
  return call(form)
}

function ProofFields({ v, set }: { v: ProofForm, set: (p: ProofForm) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-600">Approved by (name)<input value={v.approved_by_name} onChange={e => set({ ...v, approved_by_name: e.target.value })} className={inputCls} /></label>
        <label className="text-xs text-gray-600">Their role (e.g. Client POC)<input value={v.approved_by_role} onChange={e => set({ ...v, approved_by_role: e.target.value })} className={inputCls} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-600">Date approved<input type="date" value={v.approved_on} onChange={e => set({ ...v, approved_on: e.target.value })} className={inputCls} /></label>
        <label className="text-xs text-gray-600">How<select value={v.method} onChange={e => set({ ...v, method: e.target.value })} className={inputCls}>{METHOD_OPTIONS.map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}</select></label>
      </div>
      <label className="text-xs text-gray-600 block">Note (optional)<input value={v.note} onChange={e => set({ ...v, note: e.target.value })} className={inputCls} /></label>
    </div>
  )
}

function FilePicker({ label, files, setFiles, hint }: { label: string, files: File[], setFiles: (f: File[]) => void, hint?: string }) {
  return (
    <div>
      <label className="inline-block text-sm text-blue-600 cursor-pointer hover:underline">{label}
        <input type="file" multiple className="hidden" onChange={e => { setFiles(Array.from(e.target.files || [])); }} /></label>
      {hint && <div className="text-xs text-gray-400">{hint}</div>}
      {files.length > 0 && <div className="text-xs text-gray-600 mt-1">{files.map(f => f.name).join(', ')} <button onClick={() => setFiles([])} className="text-red-600 ml-1">clear</button></div>}
    </div>
  )
}

// ---------------------------------------------------------------- quick add
// For a document that was already approved elsewhere (for example by the client
// in a chat). It goes live straight away, marked with who approved it and when.
function QuickAddModal({ clients, onClose, onDone, showToast }: { clients: string[], onClose: () => void, onDone: (id: string) => void, showToast: Toast }) {
  const [f, setF] = useState({ code: '', title: '', doc_type: 'SOP', department: 'Operations', client: '', description: '', link: '', effectivity_date: ymdLocal(new Date()), next_review_date: '' })
  const [proof, setProof] = useState<ProofForm>(emptyProof())
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [busy, setBusy] = useState('')

  async function submit() {
    const problem = fileProblem(docFiles) || fileProblem(proofFiles)
    if (problem) { showToast(problem, 'error'); return }
    if (!f.description.trim() && !f.link.trim() && docFiles.length === 0) { showToast('Add the document itself: a file, a link, or a short description.', 'error'); return }
    setBusy('Saving…')
    const r = await call({ action: 'quick_add', ...f, ...proof })
    if (!r.ok) { setBusy(''); showToast(r.data.error || 'Could not add the document', 'error'); return }
    const { id, version_id, file_card_id, proof_id } = r.data
    if (docFiles.length) {
      setBusy('Uploading the document…')
      const u = await sendFiles({ action: 'add_file', version_id, card_id: file_card_id }, docFiles)
      if (!u.ok) { setBusy(''); showToast(`Saved as a draft, but the document file failed: ${u.data.error || 'upload error'}. Open it to retry.`, 'error'); onDone(id); return }
    }
    if (proofFiles.length) {
      setBusy('Uploading the approval screenshots…')
      const u = await sendFiles({ action: 'add_proof_files', proof_id }, proofFiles)
      if (!u.ok) showToast(`The screenshots did not upload (${u.data.error || 'error'}). You can add them later from the document.`, 'error')
    }
    setBusy('Publishing…')
    const p = await call({ action: 'publish_external', version_id })
    setBusy('')
    if (!p.ok) { showToast(`Saved as a draft: ${p.data.error || 'could not publish'}.`, 'error'); onDone(id); return }
    showToast('Added and live. Everyone was asked to acknowledge it.', 'success')
    onDone(id)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 space-y-4 my-6" onClick={e => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Add document</h2>
          <p className="text-xs text-gray-500">For a document that is already approved. It goes live right away and everyone is asked to acknowledge it. “Added by” is you.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-gray-600 col-span-2">Document number<input value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="OPS-SOP-001" className={inputCls} /></label>
          <label className="text-xs text-gray-600">Type<select value={f.doc_type} onChange={e => setF({ ...f, doc_type: e.target.value })} className={inputCls}>{SOP_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
        </div>
        <label className="text-xs text-gray-600 block">Title<input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className={inputCls} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">Department<select value={f.department} onChange={e => setF({ ...f, department: e.target.value })} className={inputCls}>{SOP_DEPARTMENTS.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-gray-600">Client (optional)<select value={f.client} onChange={e => setF({ ...f, client: e.target.value })} className={inputCls}><option value="">None / all clients</option>{clients.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>

        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="text-sm font-semibold text-gray-900">The document</div>
          <FilePicker label="+ Attach the document (PDF, Word, Excel, image)" files={docFiles} setFiles={setDocFiles} hint="Up to 4 MB per upload." />
          <input value={f.link} onChange={e => setF({ ...f, link: e.target.value })} placeholder="or a link: https://…" className={inputCls} />
          <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={3} placeholder="or type the steps / a short description" className={inputCls} />
        </div>

        <div className="border border-gray-200 rounded-xl p-3 space-y-3">
          <div className="text-sm font-semibold text-gray-900">Who approved it, and proof</div>
          <ProofFields v={proof} set={setProof} />
          <FilePicker label="+ Attach screenshots of the approval" files={proofFiles} setFiles={setProofFiles} hint="Only managers can open these. Others see who approved and when. You can add more later." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">Effective from<input type="date" value={f.effectivity_date} onChange={e => setF({ ...f, effectivity_date: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-gray-600">Next review (optional)<input type="date" value={f.next_review_date} onChange={e => setF({ ...f, next_review_date: e.target.value })} className={inputCls} /></label>
        </div>
        <div className="flex items-center justify-end gap-2">
          {busy && <span className="text-sm text-gray-500">{busy}</span>}
          <button onClick={onClose} disabled={!!busy} className={`${btn} border border-gray-300 text-gray-700`}>Cancel</button>
          <button onClick={submit} disabled={!!busy} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>Add and publish</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- process change
function ChangeModal({ docId, onClose, onDone, showToast }: { docId: string, onClose: () => void, onDone: () => void, showToast: Toast }) {
  const [f, setF] = useState({ summary: '', previous_text: '', reason: '', requested_by: '', requested_by_role: '', requested_on: '', effective_date: ymdLocal(new Date()), request_ref: '', approval_path: 'already_approved' })
  const [proof, setProof] = useState<ProofForm>(emptyProof())
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  async function submit() {
    const problem = fileProblem(files)
    if (problem) { showToast(problem, 'error'); return }
    setBusy(true)
    const r = await call({ action: 'record_change', id: docId, ...f, ...(f.approval_path === 'already_approved' ? proof : {}) })
    if (!r.ok) { setBusy(false); showToast(r.data.error || 'Could not record the change', 'error'); return }
    if (files.length && r.data.proof_id) {
      const u = await sendFiles({ action: 'add_proof_files', proof_id: r.data.proof_id }, files)
      if (!u.ok) showToast(`The screenshots did not upload (${u.data.error || 'error'}). Add them later from the approval section.`, 'error')
    }
    setBusy(false)
    showToast('Change recorded. Now update the content to match, then publish.', 'success')
    onDone()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 space-y-4 my-6" onClick={e => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Record a process change</h2>
          <p className="text-xs text-gray-500">This starts a new version. When it goes live, everyone must acknowledge it again. For a typo or small fix, use “Edit this page” instead.</p>
        </div>
        <label className="text-xs text-gray-600 block">What changed
          <textarea value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} rows={3} className={inputCls} placeholder="e.g. Refunds over €100 now need Team Lead sign-off before processing" /></label>
        <label className="text-xs text-gray-600 block">What it was before (optional)<textarea value={f.previous_text} onChange={e => setF({ ...f, previous_text: e.target.value })} rows={2} className={inputCls} /></label>
        <label className="text-xs text-gray-600 block">Why<input value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="client request, issue found, improvement…" className={inputCls} /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-gray-600 col-span-2">Requested by (name)<input value={f.requested_by} onChange={e => setF({ ...f, requested_by: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-gray-600">Their role<input value={f.requested_by_role} onChange={e => setF({ ...f, requested_by_role: e.target.value })} className={inputCls} /></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-gray-600">Requested on<input type="date" value={f.requested_on} onChange={e => setF({ ...f, requested_on: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-gray-600">Effective from<input type="date" value={f.effective_date} onChange={e => setF({ ...f, effective_date: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-gray-600">Client request no. (optional)<input value={f.request_ref} onChange={e => setF({ ...f, request_ref: e.target.value })} placeholder="CR-0012" className={inputCls} /></label>
        </div>
        <div className="border border-gray-200 rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-gray-800">
            <label className="flex items-center gap-2"><input type="radio" checked={f.approval_path === 'already_approved'} onChange={() => setF({ ...f, approval_path: 'already_approved' })} /> Already approved (client or outside approver)</label>
            <label className="flex items-center gap-2"><input type="radio" checked={f.approval_path === 'needs_approval'} onChange={() => setF({ ...f, approval_path: 'needs_approval' })} /> Needs internal approval first</label>
          </div>
          {f.approval_path === 'already_approved' && <>
            <ProofFields v={proof} set={setProof} />
            <FilePicker label="+ Attach screenshots of the approval" files={files} setFiles={setFiles} hint="Only managers can open these. You can add more later." />
          </>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className={`${btn} border border-gray-300 text-gray-700`}>Cancel</button>
          <button onClick={submit} disabled={busy} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>{busy ? 'Saving…' : 'Record and start the new version'}</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- approval proof
function ProofImage({ docId, proofId, f, showToast }: { docId: string, proofId: string, f: ProofFile, showToast: Toast }) {
  const isImg = /\.(png|jpe?g)$/i.test(f.name)
  const [url, setUrl] = useState('')
  const get = useCallback(async () => {
    const r = await call({ action: 'proof_file_url', id: docId, proof_id: proofId, path: f.path })
    if (r.ok && r.data.url) return r.data.url as string
    showToast(r.data.error || 'Could not open that file', 'error'); return ''
  }, [docId, proofId, f.path, showToast])
  useEffect(() => { if (isImg) get().then(setUrl) }, [isImg, get])
  return (
    <div className="mt-2">
      {isImg && url && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={f.name} className="max-h-64 rounded-lg border border-gray-200" /></a>}
      <button onClick={async () => { const u = await get(); if (u) window.open(u, '_blank', 'noopener') }} className="text-xs text-blue-600 hover:underline">{f.name}{f.added_by_name ? ` · added by ${f.added_by_name}` : ''}</button>
    </div>
  )
}

function ProofSection({ docId, version, manager, isAdmin, missing, guard, showToast, reload }: {
  docId: string, version: Version, manager: boolean, isAdmin: boolean, missing: boolean, guard: () => boolean, showToast: Toast, reload: () => Promise<void>,
}) {
  const [adding, setAdding] = useState(false)
  const [proof, setProof] = useState<ProofForm>(emptyProof())
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const proofs = version.proofs || []
  if (proofs.length === 0 && !manager) return null
  if (proofs.length === 0 && version.approval_source !== 'external' && !adding && version.status !== 'draft') return manager ? (
    <div className="text-right"><button onClick={() => setAdding(true)} className="text-xs text-blue-600 hover:underline">+ Add approval proof (client or POC screenshots)</button></div>
  ) : null

  async function add() {
    if (guard()) return
    const problem = fileProblem(files); if (problem) { showToast(problem, 'error'); return }
    setBusy(true)
    const r = await call({ action: 'add_proof', version_id: version.id, ...proof })
    if (!r.ok) { setBusy(false); showToast(r.data.error || 'Could not save', 'error'); return }
    if (files.length) { const u = await sendFiles({ action: 'add_proof_files', proof_id: r.data.id }, files); if (!u.ok) showToast(u.data.error || 'Files did not upload', 'error') }
    setBusy(false); setAdding(false); setProof(emptyProof()); setFiles([]); await reload()
  }
  async function addFiles(proofId: string, list: FileList | null) {
    const arr = Array.from(list || []); if (arr.length === 0 || guard()) return
    const problem = fileProblem(arr); if (problem) { showToast(problem, 'error'); return }
    setBusy(true); const u = await sendFiles({ action: 'add_proof_files', proof_id: proofId }, arr); setBusy(false)
    if (!u.ok) showToast(u.data.error || 'Upload failed', 'error'); else await reload()
  }
  async function remove(p: Proof) {
    if (guard() || !confirm(`Remove the approval entry from ${p.approved_by_name}? This is logged.`)) return
    const r = await call({ action: 'delete_entry', kind: 'proof', entry_id: p.id }); if (!r.ok) showToast(r.data.error || 'Could not remove', 'error'); else await reload()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">Approval {version.approval_source === 'external' && <span className="text-xs font-normal text-gray-400">(approved outside the portal)</span>}</h2>
        {manager && missing && <span className="text-xs font-medium text-amber-600">Proof screenshots missing</span>}
      </div>
      <div className="space-y-3">
        {proofs.map((p, i) => (
          <div key={p.id || i} className="border border-gray-200 rounded-lg p-3">
            <div className="text-sm text-gray-900">Approved by <b>{p.approved_by_name}</b>{p.approved_by_role ? ` (${p.approved_by_role})` : ''} · {fmt(p.approved_on)} · {methodLabel(p.method)}</div>
            {manager && p.added_by_name && <div className="text-xs text-gray-400">Added by {p.added_by_name}{p.created_at ? ` on ${fmt(p.created_at)}` : ''}</div>}
            {manager && p.note && <div className="text-xs text-gray-500 mt-1">{p.note}</div>}
            {manager && p.id && (p.attachments || []).map(f => <ProofImage key={f.path} docId={docId} proofId={p.id!} f={f} showToast={showToast} />)}
            {manager && p.id && (
              <div className="flex gap-4 mt-2">
                <label className="text-xs text-blue-600 cursor-pointer hover:underline">+ Add screenshots<input type="file" multiple className="hidden" disabled={busy} onChange={e => { addFiles(p.id!, e.target.files); e.target.value = '' }} /></label>
                {isAdmin && <button onClick={() => remove(p)} className="text-xs text-red-600 hover:underline">Remove entry</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {manager && (adding ? (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
          <ProofFields v={proof} set={setProof} />
          <FilePicker label="+ Attach screenshots" files={files} setFiles={setFiles} />
          <div className="flex gap-2"><button disabled={busy} onClick={add} className={`${btn} bg-blue-600 text-white`}>{busy ? 'Saving…' : 'Save approval'}</button><button onClick={() => setAdding(false)} className={`${btn} border border-gray-300 text-gray-700`}>Cancel</button></div>
        </div>
      ) : proofs.length > 0 && <button onClick={() => setAdding(true)} className="mt-3 text-xs text-blue-600 hover:underline">+ Add another approval entry</button>)}
    </div>
  )
}

// ---------------------------------------------------------------- detail
function DocDetail({ id, me, isPreviewing, guard, showToast, clients, employees, onBack }: {
  id: string, me: { email: string, role: string, can_author: boolean } | null, isPreviewing: boolean, guard: () => boolean,
  showToast: Toast, clients: string[], employees: Employee[], onBack: () => void,
}) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)
  const [editing, setEditing] = useState<false | 'draft' | 'minor'>(false)
  const [busy, setBusy] = useState(false)
  const [declineNote, setDeclineNote] = useState('')
  const [showPending, setShowPending] = useState(false)
  const [showChange, setShowChange] = useState(false)
  const [showEdits, setShowEdits] = useState(false)

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
  const isAdmin = me?.role === 'admin' || me?.role === 'super_admin'
  const isCreator = !!me && (doc.created_by || '').toLowerCase().split('@')[0] === me.email.toLowerCase().split('@')[0]
  const current = d.versions.find(v => v.id === doc.current_version_id) || null
  const latest = d.versions[0]   // newest first
  const inProgress = d.versions.find(v => ['draft', 'pending_approval', 'declined'].includes(v.status)) || null
  const shown = d.versions.find(v => v.id === viewId) || current || latest
  const canManage = d.can_manage
  const myLocal = (me?.email || '').toLowerCase().split('@')[0]
  const iAmPendingApprover = !!inProgress && inProgress.status === 'pending_approval' && !!inProgress.approvals?.some(a => a.decision === 'pending' && a.approver_email.toLowerCase().split('@')[0] === myLocal)
  const changeForDraft = inProgress ? d.changes.find(c => c.version_id === inProgress.id) : undefined

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
  async function decide(decision: 'approved' | 'declined') {
    const r = await act('decide', { version_id: inProgress!.id, decision, comment: declineNote }, decision === 'approved' ? 'Your approval was recorded.' : 'Declined. The author was notified.')
    if (r) setDeclineNote('')
  }
  async function retire() { if (confirm('Retire this document? It disappears for everyone except managers.')) await act('retire', { id }, 'Retired.') }
  async function remind() {
    if (guard()) return
    setBusy(true); const r = await call({ action: 'remind', id }); setBusy(false)
    if (!r.ok) showToast(r.data.error || 'Could not send', 'error'); else showToast(r.data.sent ? `Reminder sent to ${r.data.sent} people.` : 'Nobody is pending, or email is not configured.', 'success')
  }
  async function removeChange(c: Change) {
    if (guard() || !confirm('Remove this change entry? This is logged.')) return
    const r = await call({ action: 'delete_entry', kind: 'change', entry_id: c.id }); if (!r.ok) showToast(r.data.error || 'Could not remove', 'error'); else await reload()
  }

  const backBtn = <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← All documents</button>

  if (editing === 'draft' && inProgress && inProgress.status === 'draft' && canManage) {
    return <Editor mode="draft" doc={doc} version={inProgress} change={changeForDraft} me={me} guard={guard} showToast={showToast} clients={clients} employees={employees}
      onClose={async () => { setEditing(false); await reload(false) }} />
  }
  if (editing === 'minor' && current && !inProgress && canManage && doc.status === 'active') {
    return <Editor mode="minor" doc={doc} version={current} me={me} guard={guard} showToast={showToast} clients={clients} employees={employees}
      onClose={async () => { setEditing(false); await reload(false) }} />
  }

  const showAck = !!(d.acks && shown && current && shown.id === current.id)
  const showProof = !!shown && shown.status !== 'draft' && (shown.approval_source === 'external' || (shown.proofs || []).length > 0 || canManage)
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      {backBtn}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-gray-500">{doc.code} · {doc.doc_type}</div>
            <h1 className="text-xl font-bold text-gray-900">{doc.title}</h1>
            <div className="text-sm text-gray-500 mt-1">{[doc.department, doc.client, doc.owner_name && `Owner: ${doc.owner_name}`, doc.created_by_name && `Added by ${doc.created_by_name}`].filter(Boolean).join(' · ')}</div>
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
            {doc.status === 'active' && !inProgress && <button onClick={() => { if (!guard()) setEditing('minor') }} className={`${btn} bg-blue-600 text-white`}>Edit this page</button>}
            {doc.status === 'active' && !inProgress && <button onClick={() => { if (!guard()) setShowChange(true) }} className={`${btn} border border-blue-300 text-blue-700 bg-white`}>Record process change</button>}
            {inProgress?.status === 'draft' && <button onClick={() => { if (!guard()) setEditing('draft') }} className={`${btn} bg-blue-600 text-white`}>Continue editing v{inProgress.version_no}</button>}
            {inProgress && ['pending_approval', 'declined'].includes(inProgress.status) && <button disabled={busy} onClick={() => act('reopen', { version_id: inProgress.id }, 'Back to draft.')} className={`${btn} border border-gray-300 text-gray-700`}>{inProgress.status === 'declined' ? 'Reopen to fix' : 'Withdraw to draft'}</button>}
            {doc.status === 'active' && (isAdmin || isCreator) && <button disabled={busy} onClick={retire} className={`${btn} border border-red-300 text-red-600`}>Retire</button>}
          </div>
        )}
        {canManage && doc.status === 'active' && !inProgress && <p className="text-xs text-gray-400 mt-2">“Edit this page” is for small fixes (logged, no re-acknowledgment). “Record process change” is for a real change (new version, everyone acknowledges again).</p>}
      </div>

      {showProof && shown && <ProofSection docId={doc.id} version={shown} manager={d.is_manager_view && canManage} isAdmin={isAdmin} missing={d.proof_missing && shown.id === current?.id} guard={guard} showToast={showToast} reload={() => reload()} />}

      {/* approval panel (internal approvals) */}
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
              <p className="text-xs text-gray-400">{shown && shown.id === inProgress.id ? 'You are reviewing the version shown below.' : `Pick v${inProgress.version_no} in version history to read it before deciding.`}</p>
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
                <button disabled={busy} onClick={() => act('acknowledge', { id, version_id: current!.id }, 'Acknowledged. Thank you.')} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>I have read and understood this</button>
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

      {/* process change timeline */}
      {d.changes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Process changes</h2>
          <div className="space-y-3">
            {d.changes.map(c => (
              <div key={c.id} className="border-l-4 border-blue-200 pl-3">
                <div className="text-sm text-gray-900"><b>v{c.version_no}</b> · {fmt(c.effective_date || c.created_at)}{c.version_status !== 'approved' && c.version_status !== 'superseded' && <span className="ml-2"><Badge s={c.version_status} /></span>}</div>
                <div className="text-sm text-gray-800 mt-0.5">{c.summary}</div>
                {c.previous_text && <div className="text-xs text-gray-500 mt-0.5">Before: {c.previous_text}</div>}
                {c.reason && <div className="text-xs text-gray-500">Why: {c.reason}</div>}
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.requested_by && `Requested by ${c.requested_by}${c.requested_by_role ? ` (${c.requested_by_role})` : ''}${c.requested_on ? ', ' + fmt(c.requested_on) : ''} · `}
                  {c.approved.length > 0 ? `Approved by ${c.approved.map(a => `${a.approved_by_name}, ${fmt(a.approved_on)}`).join('; ')} · ` : ''}
                  {c.added_by_name && `Recorded by ${c.added_by_name}`}{c.request_ref ? ` · ${c.request_ref}` : ''}
                </div>
                {isAdmin && <button onClick={() => removeChange(c)} className="text-xs text-red-600 hover:underline mt-1">Remove entry</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* small-edit log (managers) */}
      {d.is_manager_view && d.edits.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <button onClick={() => setShowEdits(!showEdits)} className="font-semibold text-gray-900 text-sm">{showEdits ? '▾' : '▸'} Page edit log ({d.edits.length})</button>
          {showEdits && <div className="mt-2 divide-y divide-gray-100">{d.edits.map(e => (
            <div key={e.id} className="py-1.5 text-sm"><span className="text-gray-400 text-xs">{fmt(e.created_at)} · {e.edited_by_name || 'Someone'}</span><div className="text-gray-800">{e.note}</div></div>
          ))}</div>}
        </div>
      )}

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
      {showChange && <ChangeModal docId={doc.id} showToast={showToast} onClose={() => setShowChange(false)} onDone={async () => { setShowChange(false); await reload(false); setEditing('draft') }} />}
    </div>
  )
}

// ---------------------------------------------------------------- editor
// mode "draft": a version that has not gone live (full details, approvers, receivers).
// mode "minor": the LIVE page, for small fixes. Every save is logged with a note.
function Editor({ mode, doc, version, change, me, guard, showToast, clients, employees, onClose }: {
  mode: 'draft' | 'minor', doc: any, version: Version, change?: Change, me: { email: string, role: string, can_author: boolean } | null, guard: () => boolean,
  showToast: Toast, clients: string[], employees: Employee[], onClose: () => void,
}) {
  const minor = mode === 'minor'
  const [meta, setMeta] = useState({ title: doc.title as string, doc_type: doc.doc_type as string, department: (doc.department || '') as string, client: (doc.client || '') as string })
  const [f, setF] = useState({
    summary: version.summary || '', supersedes: version.supersedes || '', effectivity_date: version.effectivity_date || '', next_review_date: version.next_review_date || '',
    receiver_mode: version.receiver_mode,
  })
  const [cards, setCards] = useState<Card[]>(version.cards || [])
  const [serverIds, setServerIds] = useState<Set<string>>(new Set((version.cards || []).map(c => c.id)))
  const [note, setNote] = useState('')
  const [approvers, setApprovers] = useState<string[]>((version.approvals || []).map(a => a.approver_email.toLowerCase()))
  const [receivers, setReceivers] = useState<string[]>((version.receivers || []).map(e => e.toLowerCase()))
  const [people, setPeople] = useState<{ approvers: Person[], receivers: Person[] }>({ approvers: [], receivers: [] })
  const [recvFilter, setRecvFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const isAdmin = me?.role === 'admin' || me?.role === 'super_admin'
  const myLocal = (me?.email || '').toLowerCase().split('@')[0]
  const externalProof = (version.proofs || [])[0]

  useEffect(() => { if (!minor) call({ action: 'people' }).then(r => { if (r.ok) setPeople(r.data) }) }, [minor])

  const upd = (i: number, patch: Partial<Card>) => setCards(cs => cs.map((c, j) => j === i ? { ...c, ...patch } : c))
  const move = (i: number, dir: -1 | 1) => setCards(cs => { const j = i + dir; if (j < 0 || j >= cs.length) return cs; const n = cs.slice(); [n[i], n[j]] = [n[j], n[i]]; return n })
  const add = (type: Card['type']) => setCards(cs => [...cs, { id: newId(), type, title: '', body: '', url: '', attachments: [] }])
  const has = (list: string[], e: string) => list.some(x => x.split('@')[0] === e.toLowerCase().split('@')[0])
  const toggle = (list: string[], set: (v: string[]) => void, e: string) => set(has(list, e) ? list.filter(x => x.split('@')[0] !== e.toLowerCase().split('@')[0]) : [...list, e.toLowerCase()])

  // Saves the draft, or (live page) logs a small edit. Returns true when OK.
  async function save(silent = false): Promise<boolean> {
    if (guard()) return false
    if (minor) {
      if (!note.trim()) { showToast('Add a one-line note saying what you changed.', 'error'); return false }
      const r = await call({ action: 'minor_edit', version_id: version.id, cards, note, next_review_date: f.next_review_date })
      if (!r.ok) { showToast(r.data.error || 'Could not save', 'error'); return false }
      setServerIds(new Set(cards.map(c => c.id)))
      if (!silent) showToast(r.data.unchanged ? 'No changes to save.' : 'Edit saved and logged.', 'success')
      return true
    }
    const m = await call({ action: 'update_meta', id: doc.id, ...meta })
    if (!m.ok) { showToast(m.data.error || 'Could not save details', 'error'); return false }
    const r = await call({ action: 'save_version', version_id: version.id, ...f, cards, approvers, receivers })
    if (!r.ok) { showToast(r.data.error || 'Could not save', 'error'); return false }
    setServerIds(new Set(cards.map(c => c.id)))
    if (!silent) showToast('Draft saved.', 'success')
    return true
  }
  async function saveClick() { setBusy(true); const ok = await save(); setBusy(false); if (ok && minor) onClose() }
  async function submit() {
    setBusy(true)
    if (await save(true)) {
      const r = await call({ action: 'submit', version_id: version.id })
      if (!r.ok) showToast(r.data.error || 'Could not submit', 'error')
      else { showToast('Submitted for approval. Approvers were emailed.', 'success'); setBusy(false); onClose(); return }
    }
    setBusy(false)
  }
  async function publish() {
    setBusy(true)
    if (await save(true)) {
      const r = await call({ action: 'publish_external', version_id: version.id })
      if (!r.ok) showToast(r.data.error || 'Could not publish', 'error')
      else { showToast('Published. Everyone was asked to acknowledge it.', 'success'); setBusy(false); onClose(); return }
    }
    setBusy(false)
  }
  async function upload(i: number, list: FileList | null) {
    if (!list || list.length === 0 || guard()) return
    const arr = Array.from(list); const problem = fileProblem(arr); if (problem) { showToast(problem, 'error'); return }
    setBusy(true)
    // The card must exist on the server before a file can be attached to it.
    if (!serverIds.has(cards[i].id) && !(await save(true))) { setBusy(false); return }
    const r = await sendFiles({ action: 'add_file', version_id: version.id, card_id: cards[i].id, ...(minor ? { minor: 'true' } : {}) }, arr)
    setBusy(false)
    if (!r.ok) { showToast(r.data.error || 'Upload failed', 'error'); return }
    upd(i, { attachments: r.data.attachments })
  }
  async function removeFile(i: number, path: string) {
    if (guard()) return
    const r = await call({ action: 'remove_file', version_id: version.id, card_id: cards[i].id, path, ...(minor ? { minor: 'true' } : {}) })
    if (!r.ok) { showToast(r.data.error || 'Could not remove', 'error'); return }
    upd(i, { attachments: r.data.attachments })
  }

  const recvShown = people.receivers.filter(p => !recvFilter || p.name.toLowerCase().includes(recvFilter.toLowerCase()))
  const approverChoices = people.approvers.filter(p => isAdmin || p.email.split('@')[0] !== myLocal)

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-blue-600 hover:underline">← Back to document</button>
        <div className="text-xs text-gray-500">{doc.code} · {minor ? `editing the live page (v${version.version_no})` : `editing draft v${version.version_no}`}</div>
      </div>

      {minor ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm text-blue-900">Small fixes only: wording, an extra step, a new screenshot. They apply immediately, are logged with your note and the page as it was before, and do <b>not</b> ask anyone to acknowledge again. If the process itself changed, go back and use “Record process change”.</p>
          <label className="text-xs text-gray-700 block">What did you change? (required)<input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Fixed typo in step 3; added screenshot of the refund screen" className={inputCls} /></label>
          <label className="text-xs text-gray-700 block md:w-64">Next review date<input type="date" value={f.next_review_date} onChange={e => setF({ ...f, next_review_date: e.target.value })} className={inputCls} /></label>
        </div>
      ) : (
        <>
          {change && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900"><b>Process change:</b> {change.summary}{change.reason && <div className="text-xs mt-1">Why: {change.reason}</div>}<div className="text-xs mt-1">Update the content below to match this change, then {externalProof ? 'publish it' : 'submit it for approval'}.</div></div>}
          {externalProof && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-900">Already approved by <b>{externalProof.approved_by_name}</b>{externalProof.approved_by_role ? ` (${externalProof.approved_by_role})` : ''}, {fmt(externalProof.approved_on)}. You can publish directly; no internal approval round is needed.</div>}
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
        </>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">Content</h2>
        {cards.map((c, i) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500 uppercase">{c.type === 'file' ? 'Files / screenshots' : c.type}</span>
              <div className="flex gap-1 text-xs">
                <button onClick={() => move(i, -1)} className="px-2 py-1 border border-gray-200 rounded text-gray-600">↑</button>
                <button onClick={() => move(i, 1)} className="px-2 py-1 border border-gray-200 rounded text-gray-600">↓</button>
                <button onClick={() => { if (c.attachments.length === 0 || confirm('Delete this card? Its files are removed from the page' + (minor ? ' (the edit log keeps them).' : '.'))) setCards(cs => cs.filter((_, j) => j !== i)) }} className="px-2 py-1 border border-red-200 rounded text-red-600">Delete</button>
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
                <label className="inline-block text-sm text-blue-600 cursor-pointer hover:underline">+ Attach files (PDF, images, Office; up to 4 MB per upload)
                  <input type="file" multiple className="hidden" disabled={busy} onChange={e => { upload(i, e.target.files); e.target.value = '' }} /></label>
                {minor && !serverIds.has(c.id) && <div className="text-xs text-amber-600">Attaching will save your edit first, so fill in the note above.</div>}
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

      {!minor && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          {!externalProof && <>
            <h2 className="font-semibold text-gray-900">Approvers (all must approve)</h2>
            <div className="grid sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
              {approverChoices.length === 0 && <div className="text-sm text-gray-400">Loading…</div>}
              {approverChoices.map(p => (
                <label key={p.email} className="flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={has(approvers, p.email)} onChange={() => toggle(approvers, setApprovers, p.email)} />
                  {p.name} <span className="text-xs text-gray-400">{p.role === 'Team Lead' ? 'Team Lead' : 'Admin'}</span></label>
              ))}
            </div>
          </>}
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
      )}

      <div className="flex flex-wrap justify-end gap-2 sticky bottom-3">
        {minor ? (
          <button disabled={busy} onClick={saveClick} className={`${btn} bg-blue-600 text-white hover:bg-blue-700 shadow`}>{busy ? 'Working…' : 'Save edit'}</button>
        ) : (<>
          <button disabled={busy} onClick={async () => { setBusy(true); await save(); setBusy(false) }} className={`${btn} bg-white border border-gray-300 text-gray-700 shadow`}>{busy ? 'Working…' : 'Save draft'}</button>
          {externalProof
            ? <button disabled={busy} onClick={publish} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700 shadow`}>Publish (already approved)</button>
            : <button disabled={busy} onClick={submit} className={`${btn} bg-blue-600 text-white hover:bg-blue-700 shadow`}>Save and submit for approval</button>}
        </>)}
      </div>
    </div>
  )
}

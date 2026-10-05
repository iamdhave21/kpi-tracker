'use client'
import { useState, useEffect } from 'react'
import { REQUEST_TYPES, REQUEST_LEVELS, REQUEST_PRIORITIES, statusLabel, typeLabel, levelLabel, refLabel, requiresApproval } from '@/lib/clientRequests'

type Att = { name: string, path: string, size: number }
type Req = {
  id: string, ref_no: number, type: string, subject: string, details?: string, priority: string, send_to_level: string,
  needed_by: string | null, target_date: string | null, effective_date: string | null, status: string,
  client_unread: boolean, contact_name: string | null, attachments?: Att[], created_at: string, updated_at: string,
}
type Msg = { id: string, author_type: 'client' | 'staff' | 'system', author_name: string | null, body: string, attachments: Att[], created_at: string }

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200', acknowledged: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200', approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-red-50 text-red-700 border-red-200', completed: 'bg-emerald-50 text-emerald-700 border-emerald-200', closed: 'bg-gray-100 text-gray-500 border-gray-200',
}
const OPEN_STATUSES = ['new', 'acknowledged', 'in_review', 'approved']

function ymdDate(d: string | null) {
  if (!d) return 'NA'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function stamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const FIELD = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900'
const MAX_TOTAL = 4 * 1024 * 1024

export default function RequestsPanel({ onUnread }: { onUnread?: (n: number) => void }) {
  const [mode, setMode] = useState<'list' | 'new' | 'detail'>('list')
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  async function loadList() {
    const res = await fetch('/api/client-portal/requests')
    const data = await res.json()
    const list: Req[] = (data.requests || []).slice().sort((a: Req, b: Req) => b.updated_at.localeCompare(a.updated_at))
    setRequests(list); setLoading(false)
    onUnread?.(list.filter(r => r.client_unread).length)
  }
  useEffect(() => { loadList() }, [])

  if (mode === 'new') return <NewRequest onCancel={() => setMode('list')} onSent={(msg) => { setNotice(msg); setMode('list'); loadList() }} />
  if (mode === 'detail' && selected) return <Detail id={selected} onBack={() => { setMode('list'); loadList() }} />

  const shown = requests.filter(r => filter === 'all' || OPEN_STATUSES.includes(r.status))
  return (
    <div>
      {notice && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-4 py-3 flex justify-between"><span>{notice}</span><button onClick={() => setNotice('')} className="text-emerald-600">×</button></div>}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-1.5">
          {([['open', 'Open'], ['all', 'All and history']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`text-xs px-3 py-1.5 rounded-full border transition ${filter === v ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
          ))}
        </div>
        <button onClick={() => setMode('new')} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition">+ New request</button>
      </div>
      {loading ? <p className="text-center text-gray-400 py-10">Loading…</p>
        : shown.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
            {requests.length === 0 ? 'No requests yet. Use “New request” to send us a headcount request, a process change, an escalation, a commendation, feedback, or any message.' : 'Nothing open right now. Switch to “All and history” to see past requests.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {shown.map(r => (
              <button key={r.id} onClick={() => { setSelected(r.id); setMode('detail') }} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                    {r.client_unread && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" title="New update" />}
                    {r.subject}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{refLabel(r.ref_no)} · {typeLabel(r.type)} · updated {stamp(r.updated_at)}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_STYLE[r.status]}`}>{statusLabel(r.status)}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  )
}

function DateField({ label, value, na, onValue, onNa }: { label: string, value: string, na: boolean, onValue: (v: string) => void, onNa: (v: boolean) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label} *</label>
      <input type="date" value={value} disabled={na} onChange={e => onValue(e.target.value)} className={`${FIELD} ${na ? 'opacity-50' : ''}`} />
      <label className="flex items-center gap-1.5 text-xs text-gray-600 mt-1.5"><input type="checkbox" checked={na} onChange={e => onNa(e.target.checked)} /> N/A — not applicable</label>
    </div>
  )
}

function NewRequest({ onCancel, onSent }: { onCancel: () => void, onSent: (msg: string) => void }) {
  const [f, setF] = useState({ type: '', level: '', priority: 'normal', subject: '', details: '', needed: '', neededNa: false, target: '', targetNa: false })
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const total = files.reduce((s, x) => s + x.size, 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!f.type) return setError('Choose what kind of request this is.')
    if (!f.level) return setError('Choose who this should go to.')
    if (!f.neededNa && !f.needed) return setError('Pick a “needed by” date, or tick N/A.')
    if (!f.targetNa && !f.target) return setError('Pick a target date, or tick N/A.')
    if (total > MAX_TOTAL) return setError('Attachments are limited to 4 MB in total. Remove some, or paste a link to the larger file in the details.')
    setSending(true)
    const form = new FormData()
    form.append('action', 'create'); form.append('type', f.type); form.append('send_to_level', f.level); form.append('priority', f.priority)
    form.append('subject', f.subject); form.append('details', f.details)
    form.append('needed_by', f.neededNa ? 'NA' : f.needed); form.append('target_date', f.targetNa ? 'NA' : f.target)
    files.forEach(x => form.append('files', x))
    try {
      const res = await fetch('/api/client-portal/requests', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'Those files are too large to send. Keep attachments under 4 MB in total.' : 'Something went wrong. Please try again.'))
      onSent(data.warning || 'Your request was sent. We\'ll update you here as it moves along.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.') }
    setSending(false)
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-blue-900">New request</h2><button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">What is this? *</label>
          <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className={FIELD}><option value="">Select…</option>{REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Who should receive it? *</label>
          <select value={f.level} onChange={e => setF({ ...f, level: e.target.value })} className={FIELD}><option value="">Select…</option>{REQUEST_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })} className={FIELD}>{REQUEST_PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></div>
      </div>
      {f.type && requiresApproval(f.type) && <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">This kind of request goes through approval on our side. You&apos;ll see its status here as it moves.</p>}
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label><input required maxLength={200} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} className={FIELD} placeholder="A short summary" /></div>
      <div><label className="block text-xs font-medium text-gray-600 mb-1">Details *</label><textarea required rows={5} maxLength={8000} value={f.details} onChange={e => setF({ ...f, details: e.target.value })} className={FIELD} placeholder="What do you need, and anything we should know?" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField label="Needed by" value={f.needed} na={f.neededNa} onValue={v => setF({ ...f, needed: v })} onNa={v => setF({ ...f, neededNa: v, needed: v ? '' : f.needed })} />
        <DateField label="Target date" value={f.target} na={f.targetNa} onValue={v => setF({ ...f, target: v })} onNa={v => setF({ ...f, targetNa: v, target: v ? '' : f.target })} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Attachments (optional)</label>
        <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} className="text-xs w-full" />
        <p className={`text-[11px] mt-1 ${total > MAX_TOTAL ? 'text-red-600' : 'text-gray-400'}`}>PDF, Word, Excel, PowerPoint, images, CSV or text — up to 5 files, 4 MB in total{files.length ? ` (now ${kb(total)})` : ''}. For anything larger, paste a link in the details.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={sending} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition disabled:opacity-50">{sending ? 'Sending…' : 'Send request'}</button>
    </form>
  )
}

function Detail({ id, onBack }: { id: string, onBack: () => void }) {
  const [req, setReq] = useState<Req | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch(`/api/client-portal/requests?id=${id}`)
    const data = await res.json()
    if (res.ok) { setReq(data.request); setMsgs(data.messages) }
    setLoading(false)
  }
  useEffect(() => {
    load()
    const f = new FormData(); f.append('action', 'read'); f.append('request_id', id)
    fetch('/api/client-portal/requests', { method: 'POST', body: f })
  }, [id])

  async function openFile(a: Att) {
    const res = await fetch(`/api/client-portal/requests/file?request_id=${id}&path=${encodeURIComponent(a.path)}`)
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank'); else setError(data.error || 'Could not open that file.')
  }
  async function send() {
    setError('')
    if (!text.trim() && files.length === 0) return setError('Write a message or attach a file.')
    if (files.reduce((s, x) => s + x.size, 0) > MAX_TOTAL) return setError('Attachments are limited to 4 MB in total.')
    setSending(true)
    const form = new FormData(); form.append('action', 'message'); form.append('request_id', id); form.append('body', text)
    files.forEach(x => form.append('files', x))
    try {
      const res = await fetch('/api/client-portal/requests', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'Those files are too large. Keep attachments under 4 MB in total.' : 'Could not send. Please try again.'))
      setText(''); setFiles([]); await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send.') }
    setSending(false)
  }

  if (loading) return <p className="text-center text-gray-400 py-10">Loading…</p>
  if (!req) return <div><button onClick={onBack} className="text-sm text-blue-700 hover:underline">← Back</button><p className="text-gray-500 mt-4">We couldn&apos;t find that request.</p></div>
  const closed = req.status === 'closed'
  const AttList = ({ list }: { list: Att[] }) => list.length ? (
    <div className="flex flex-wrap gap-2 mt-2">{list.map(a => <button key={a.path} onClick={() => openFile(a)} className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1 hover:bg-blue-100">📎 {a.name} <span className="text-blue-400">({kb(a.size)})</span></button>)}</div>
  ) : null

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-700 hover:underline">← All requests</button>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-400">{refLabel(req.ref_no)} · {typeLabel(req.type)} · sent to {levelLabel(req.send_to_level)} · {req.priority} priority</p>
            <h2 className="text-lg font-semibold text-gray-900 mt-0.5">{req.subject}</h2>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status]}`}>{statusLabel(req.status)}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <div><p className="text-gray-400">Sent</p><p className="text-gray-800">{stamp(req.created_at)}</p></div>
          <div><p className="text-gray-400">Needed by</p><p className="text-gray-800">{ymdDate(req.needed_by)}</p></div>
          <div><p className="text-gray-400">Target date</p><p className="text-gray-800">{ymdDate(req.target_date)}</p></div>
          <div><p className="text-gray-400">Effectivity date</p><p className="text-gray-800">{req.effective_date ? ymdDate(req.effective_date) : 'Not set yet'}</p></div>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-4 border-t border-gray-100 pt-4">{req.details}</p>
        <AttList list={req.attachments || []} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Updates</h3>
        {msgs.length === 0 ? <p className="text-sm text-gray-400">No updates yet. We&apos;ll post here when there&apos;s news.</p> : (
          <div className="space-y-3">
            {msgs.map(m => m.author_type === 'system' ? (
              <p key={m.id} className="text-xs text-gray-500 text-center italic">{m.body} · {stamp(m.created_at)}</p>
            ) : (
              <div key={m.id} className={`flex ${m.author_type === 'client' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm border ${m.author_type === 'client' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-[11px] text-gray-500 mb-0.5">{m.author_type === 'client' ? (m.author_name || 'You') : `${m.author_name || 'AB BSS'} · AB BSS`} · {stamp(m.created_at)}</p>
                  {m.body && <p className="text-gray-800 whitespace-pre-wrap">{m.body}</p>}
                  <AttList list={m.attachments || []} />
                </div>
              </div>
            ))}
          </div>
        )}
        {closed ? <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">This request is closed. If you need something else, please start a new request.</p> : (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
            <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Write a message…" className={FIELD} maxLength={8000} />
            <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} className="text-xs w-full" />
            <p className="text-[11px] text-gray-400">PDF, Word, Excel, images and more — up to 5 files, 4 MB in total.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={send} disabled={sending} className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">{sending ? 'Sending…' : 'Send'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

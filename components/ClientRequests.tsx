'use client'
import { useState, useEffect, useMemo } from 'react'
import { Employee } from '@/lib/supabase'
import { staffApi } from '@/lib/staffFetch'
import { daysUntil } from '@/lib/toolsRepo'
import {
  REQUEST_TYPES, REQUEST_LEVELS, REQUEST_PRIORITIES, REQUEST_STATUSES,
  statusLabel, typeLabel, levelLabel, refLabel, allowedManualStatuses, sameStaff,
} from '@/lib/clientRequests'

type Att = { name: string, path: string, size: number }
type Req = {
  id: string, ref_no: number, client: string, contact_name: string | null, contact_email: string | null,
  type: string, subject: string, details: string, priority: string, send_to_level: string,
  needed_by: string | null, target_date: string | null, effective_date: string | null, status: string,
  requires_approval: boolean, assigned_to: string | null, staff_attention: boolean, client_unread: boolean,
  attachments: Att[], created_at: string, updated_at: string,
  approvals_summary?: { pending: number, approved: number, declined: number, total: number },
}
type Msg = { id: string, author_type: 'client' | 'staff' | 'system', author_name: string | null, body: string, visible_to_client: boolean, attachments: Att[], created_at: string }
type Approval = { id: string, approver_name: string, approver_email: string, status: 'pending' | 'approved' | 'declined', comment: string | null, decided_at: string | null }
type Receiver = { id: string, receiver_name: string, receiver_email: string, acknowledged_at: string | null }
type Route = { id: string, client: string | null, level: string, recipients: string, updated_by: string | null, updated_at: string }

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200', acknowledged: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200', approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-red-50 text-red-700 border-red-200', completed: 'bg-emerald-50 text-emerald-700 border-emerald-200', closed: 'bg-gray-100 text-gray-500 border-gray-200',
}
const PRIORITY_STYLE: Record<string, string> = { urgent: 'text-red-600 font-semibold', high: 'text-amber-600 font-medium', normal: 'text-gray-500', low: 'text-gray-400' }
const OPEN = ['new', 'acknowledged', 'in_review', 'approved']
const stamp = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const ymd = (d: string | null) => { if (!d) return 'NA'; const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) }
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white'

export default function ClientRequests({ employees, isPreviewing, showToast }: {
  employees: Employee[], isPreviewing: boolean, showToast: (m: string, t?: 'success' | 'error') => void,
}) {
  const [tab, setTab] = useState<'inbox' | 'routing'>('inbox')
  const [requests, setRequests] = useState<Req[]>([])
  const [me, setMe] = useState<{ email: string, role: string, name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('open')
  const [typeF, setTypeF] = useState('all')
  const [clientF, setClientF] = useState('all')
  const [levelF, setLevelF] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)

  async function load() {
    const r = await staffApi({ action: 'list' })
    if (!r.ok) setError(r.data.error || 'Could not load requests.')
    else { setError(''); setRequests(r.data.requests); setMe(r.data.me) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const isAdmin = me?.role === 'admin' || me?.role === 'super_admin'

  const summary = useMemo(() => {
    const open = requests.filter(r => OPEN.includes(r.status))
    return {
      attention: requests.filter(r => r.staff_attention && r.status !== 'closed').length,
      awaitingApproval: open.filter(r => r.requires_approval && r.status !== 'approved').length,
      dueSoon: open.filter(r => r.needed_by && daysUntil(r.needed_by) >= 0 && daysUntil(r.needed_by) <= 7).length,
      overdue: open.filter(r => r.needed_by && daysUntil(r.needed_by) < 0).length,
    }
  }, [requests])

  const visible = requests.filter(r => {
    const q = search.trim().toLowerCase()
    if (q && ![r.subject, r.client, r.contact_name, refLabel(r.ref_no)].some(x => (x || '').toLowerCase().includes(q))) return false
    if (statusF === 'open' && !OPEN.includes(r.status)) return false
    if (statusF === 'attention' && !(r.staff_attention && r.status !== 'closed')) return false
    if (statusF !== 'open' && statusF !== 'all' && statusF !== 'attention' && r.status !== statusF) return false
    if (typeF !== 'all' && r.type !== typeF) return false
    if (clientF !== 'all' && r.client !== clientF) return false
    if (levelF !== 'all' && r.send_to_level !== levelF) return false
    if (mineOnly && !(r.assigned_to && sameStaff(r.assigned_to, me?.email))) return false
    return true
  })

  if (selectedId) return <Detail id={selectedId} me={me} employees={employees} isPreviewing={isPreviewing} showToast={showToast} onBack={() => { setSelectedId(null); load() }} />

  return (
    <div className="max-w-[1500px] mx-auto space-y-5 text-gray-800">
      <div>
        <h2 className="text-xl font-bold text-blue-900">Client Requests</h2>
        <p className="text-sm text-gray-500">What clients send from their portal — headcount requests, process changes, escalations, commendations, feedback and messages. You&apos;re alerted by email and here when one arrives.</p>
        {me && <p className="text-xs text-gray-400 mt-0.5">{isAdmin ? 'You see every client\'s requests.' : 'You see requests for the clients you support.'}</p>}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {([['inbox', 'Inbox'], ...(isAdmin ? [['routing', 'Alert routing']] : [])] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === id ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}{/table|relation|schema/i.test(error) ? ' — if this is the first time, run client-requests-schema.sql in the Supabase SQL Editor.' : ''}</div>}

      {tab === 'routing' && isAdmin && <Routing employees={employees} isPreviewing={isPreviewing} showToast={showToast} />}

      {tab === 'inbox' && (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={() => setStatusF(statusF === 'attention' ? 'open' : 'attention')} className={`text-left bg-white border rounded-xl p-4 transition ${statusF === 'attention' ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}>
            <p className="text-xs text-gray-500">Needs a response</p><p className={`text-2xl font-bold ${summary.attention ? 'text-blue-700' : 'text-gray-400'}`}>{summary.attention}</p><p className="text-xs text-gray-400">new, or the client replied</p>
          </button>
          <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Awaiting approval</p><p className="text-2xl font-bold text-amber-600">{summary.awaitingApproval}</p></div>
          <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Needed within 7 days</p><p className="text-2xl font-bold text-blue-900">{summary.dueSoon}</p></div>
          <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Past needed-by date</p><p className={`text-2xl font-bold ${summary.overdue ? 'text-red-600' : 'text-gray-400'}`}>{summary.overdue}</p></div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject, client, reference…" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white w-64 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <select value={statusF} onChange={e => setStatusF(e.target.value)} className={sel}>
            <option value="open">Open</option><option value="attention">Needs a response</option><option value="all">All, including history</option>
            {REQUEST_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label} only</option>)}
          </select>
          <select value={typeF} onChange={e => setTypeF(e.target.value)} className={sel}><option value="all">All types</option>{REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          <select value={clientF} onChange={e => setClientF(e.target.value)} className={sel}><option value="all">All clients</option>{Array.from(new Set(requests.map(r => r.client))).sort().map(c => <option key={c}>{c}</option>)}</select>
          <select value={levelF} onChange={e => setLevelF(e.target.value)} className={sel}><option value="all">Any level</option>{REQUEST_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
          <label className="text-sm text-gray-600 flex items-center gap-1.5"><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} /> Assigned to me</label>
          <span className="text-xs text-gray-400 ml-auto">{visible.length} of {requests.length}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead><tr className="bg-gray-50 border-b border-gray-100 text-left">
              {['Request', 'Client', 'Type', 'Sent to', 'Priority', 'Needed by', 'Approvals', 'Status', 'Updated'].map(h => <th key={h} className="px-4 py-2 font-medium text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading…</td></tr>
                : visible.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">{requests.length === 0 ? 'No client requests yet.' : 'Nothing matches these filters.'}</td></tr>
                : visible.map(r => {
                  const late = r.needed_by && OPEN.includes(r.status) && daysUntil(r.needed_by) < 0
                  const a = r.approvals_summary
                  return (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-[300px]">
                        <p className="font-medium text-gray-900 truncate flex items-center gap-2">{r.staff_attention && r.status !== 'closed' && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" title="Needs a response" />}{r.subject}</p>
                        <p className="text-xs text-gray-400">{refLabel(r.ref_no)} · {r.contact_name || 'client'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.client}</td>
                      <td className="px-4 py-3 text-gray-600">{typeLabel(r.type)}</td>
                      <td className="px-4 py-3 text-gray-600">{levelLabel(r.send_to_level)}</td>
                      <td className={`px-4 py-3 capitalize ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${late ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{ymd(r.needed_by)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{!r.requires_approval ? <span className="text-gray-300">acknowledge only</span> : a && a.total > 0 ? `${a.approved}/${a.total} approved${a.declined ? ` · ${a.declined} declined` : ''}` : <span className="text-amber-600">no approvers yet</span>}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>{statusLabel(r.status)}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{stamp(r.updated_at)}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  )
}

// ------------------------------------------------------------------
function Detail({ id, me, employees, isPreviewing, showToast, onBack }: {
  id: string, me: { email: string, role: string, name: string } | null, employees: Employee[], isPreviewing: boolean,
  showToast: (m: string, t?: 'success' | 'error') => void, onBack: () => void,
}) {
  const [req, setReq] = useState<Req | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [receivers, setReceivers] = useState<Receiver[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [internal, setInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [effDate, setEffDate] = useState('')
  const [approverPick, setApproverPick] = useState('')
  const [receiverPick, setReceiverPick] = useState('')
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({})
  const isAdmin = me?.role === 'admin' || me?.role === 'super_admin'
  const people = employees.filter(e => e.active && e.email)

  async function load() {
    const r = await staffApi({ action: 'get', id })
    if (!r.ok) { showToast(r.data.error || 'Could not open that request', 'error'); setLoading(false); return }
    setReq(r.data.request); setMsgs(r.data.messages); setApprovals(r.data.approvals); setReceivers(r.data.receivers)
    setEffDate(r.data.request.effective_date || ''); setLoading(false)
  }
  useEffect(() => { load() }, [id])

  // Runs a change, then reloads. Blocked while previewing as someone else,
  // since the change would still be made as the real signed-in person.
  async function act(body: Record<string, any> | FormData, okMsg?: string): Promise<boolean> {
    if (isPreviewing) { showToast('Preview mode is view-only', 'error'); return false }
    setBusy(true)
    const r = await staffApi(body)
    setBusy(false)
    if (!r.ok) { showToast(r.data.error || 'That didn\'t work', 'error'); return false }
    if (okMsg) showToast(okMsg)
    await load()
    return true
  }
  async function openFile(a: Att) {
    const r = await staffApi({ action: 'file_url', id, path: a.path })
    if (r.ok && r.data.url) window.open(r.data.url, '_blank'); else showToast(r.data.error || 'Could not open that file', 'error')
  }
  async function send() {
    const form = new FormData()
    form.append('action', 'message'); form.append('id', id); form.append('body', text); form.append('internal', String(internal))
    files.forEach(f => form.append('files', f))
    if (await act(form, internal ? 'Note saved' : 'Reply sent')) { setText(''); setFiles([]) }
  }

  if (loading) return <p className="text-center py-12 text-gray-400">Loading…</p>
  if (!req) return <div><button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Back</button></div>

  const allowed = Array.from(new Set([req.status, ...allowedManualStatuses(req)]))
  const myApproval = approvals.find(a => me && sameStaff(a.approver_email, me.email))
  const AttList = ({ list }: { list: Att[] }) => list.length ? <div className="flex flex-wrap gap-2 mt-2">{list.map(a => <button key={a.path} onClick={() => openFile(a)} className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1 hover:bg-blue-100">📎 {a.name} <span className="text-blue-400">({kb(a.size)})</span></button>)}</div> : null

  return (
    <div className="max-w-[1100px] mx-auto space-y-4 text-gray-800">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← All requests</button>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-400">{refLabel(req.ref_no)} · {req.client} · {typeLabel(req.type)} · {req.requires_approval ? 'needs approval' : 'acknowledge only'}</p>
            <h2 className="text-lg font-semibold text-gray-900 mt-0.5">{req.subject}</h2>
            <p className="text-xs text-gray-400 mt-0.5">From {req.contact_name} ({req.contact_email}) · sent {stamp(req.created_at)}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLE[req.status]}`}>{statusLabel(req.status)}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div><label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={req.status} disabled={busy} onChange={e => act({ action: 'update', id, status: e.target.value }, 'Status updated')} className={`${input} !py-1.5`}>
              {allowed.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 mb-1">Assigned to</label>
            <select value={req.assigned_to || ''} disabled={busy} onChange={e => act({ action: 'update', id, assigned_to: e.target.value || null }, 'Assignee updated')} className={`${input} !py-1.5`}>
              <option value="">Unassigned</option>{people.map(p => <option key={p.id} value={p.email!}>{p.name}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 mb-1">Sent to</label>
            <select value={req.send_to_level} disabled={busy} onChange={e => act({ action: 'update', id, send_to_level: e.target.value }, 'Level updated')} className={`${input} !py-1.5`}>
              {REQUEST_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 mb-1">Priority</label>
            <select value={req.priority} disabled={busy} onChange={e => act({ action: 'update', id, priority: e.target.value }, 'Priority updated')} className={`${input} !py-1.5 capitalize`}>
              {REQUEST_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
          <div><p className="text-gray-400">Needed by (client)</p><p className="text-gray-800">{ymd(req.needed_by)}</p></div>
          <div><p className="text-gray-400">Target date (client)</p><p className="text-gray-800">{ymd(req.target_date)}</p></div>
          <div className="col-span-2"><label className="block text-gray-400 mb-1">Effectivity date (the client sees this)</label>
            <div className="flex gap-2"><input type="date" value={effDate} onChange={e => setEffDate(e.target.value)} className={`${input} !py-1 max-w-[180px]`} />
              <button disabled={busy || effDate === (req.effective_date || '')} onClick={() => act({ action: 'update', id, effective_date: effDate || null }, 'Effectivity date saved')} className="text-xs bg-blue-900 text-white px-3 rounded-lg disabled:opacity-40">Save</button></div></div>
        </div>
        {req.requires_approval && <p className="text-[11px] text-gray-400 mt-3">Approved and Declined are set by the approvers&apos; decisions below, not by hand.</p>}

        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-4 border-t border-gray-100 pt-4">{req.details}</p>
        <AttList list={req.attachments || []} />
      </div>

      {req.requires_approval && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">Approvals <span className="text-gray-400 font-normal">· internal, the client doesn&apos;t see names or comments</span></h3>
          <p className="text-[11px] text-gray-400 mb-1">Approvers and receivers need an Admin or Team Lead role in the portal to open requests.</p>
          {approvals.length === 0 ? <p className="text-sm text-amber-700">No approvers chosen yet. {isAdmin ? 'Add at least one below.' : 'An admin needs to add approvers.'}</p> : (
            <div className="space-y-2 mt-2">
              {approvals.map(a => (
                <div key={a.id} className="border border-gray-100 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-gray-800">{a.approver_name}</span>
                    <span className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${a.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : a.status === 'declined' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{a.status === 'pending' ? 'Waiting' : a.status === 'approved' ? 'Approved' : 'Declined'}{a.decided_at ? ` · ${stamp(a.decided_at)}` : ''}</span>
                      {isAdmin && a.status === 'pending' && <button onClick={() => act({ action: 'remove_approver', approval_id: a.id })} className="text-xs text-red-500 hover:underline">Remove</button>}
                    </span>
                  </div>
                  {a.comment && <p className="text-xs text-gray-500 mt-1">“{a.comment}”</p>}
                  {a.status === 'pending' && (sameStaff(a.approver_email, me?.email) || me?.role === 'super_admin') && !['completed', 'closed'].includes(req.status) && (
                    <div className="mt-2 flex gap-2 flex-wrap items-center">
                      <input value={decisionNote[a.id] || ''} onChange={e => setDecisionNote({ ...decisionNote, [a.id]: e.target.value })} placeholder="Comment (optional)" className={`${input} !py-1 flex-1 min-w-[160px]`} />
                      <button disabled={busy} onClick={() => act({ action: 'decide', approval_id: a.id, decision: 'approved', comment: decisionNote[a.id] }, 'Approved')} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg">Approve</button>
                      <button disabled={busy} onClick={() => act({ action: 'decide', approval_id: a.id, decision: 'declined', comment: decisionNote[a.id] }, 'Declined')} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg">Decline</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {isAdmin && !['approved', 'declined', 'completed', 'closed'].includes(req.status) && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <select value={approverPick} onChange={e => setApproverPick(e.target.value)} className={`${sel} flex-1 min-w-[200px]`}><option value="">Add an approver…</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <button disabled={!approverPick || busy} onClick={async () => { const p = people.find(x => x.id === approverPick)!; if (await act({ action: 'add_approver', id, name: p.name, email: p.email }, 'Approver added — they\'ve been emailed')) setApproverPick('') }} className="text-sm bg-blue-900 text-white px-4 rounded-lg disabled:opacity-40">Add</button>
            </div>
          )}
          {myApproval && myApproval.status === 'pending' && <p className="text-xs text-blue-700 mt-2">You&apos;re an approver on this request.</p>}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">Receivers <span className="text-gray-400 font-normal">· people who need to know; they acknowledge</span></h3>
        {receivers.length === 0 ? <p className="text-sm text-gray-400">None added.</p> : (
          <div className="space-y-1.5 mt-2">
            {receivers.map(rc => (
              <div key={rc.id} className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2 flex-wrap">
                <span className="text-gray-800">{rc.receiver_name}</span>
                <span className="flex items-center gap-3">
                  {rc.acknowledged_at ? <span className="text-xs text-emerald-700">Acknowledged · {stamp(rc.acknowledged_at)}</span>
                    : sameStaff(rc.receiver_email, me?.email) ? <button onClick={() => act({ action: 'ack_receiver', receiver_id: rc.id }, 'Acknowledged')} className="text-xs bg-blue-900 text-white px-3 py-1 rounded-lg">Acknowledge</button>
                    : <span className="text-xs text-amber-700">Not yet acknowledged</span>}
                  {isAdmin && <button onClick={() => act({ action: 'remove_receiver', receiver_id: rc.id })} className="text-xs text-red-500 hover:underline">Remove</button>}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2 flex-wrap">
          <select value={receiverPick} onChange={e => setReceiverPick(e.target.value)} className={`${sel} flex-1 min-w-[200px]`}><option value="">Add a receiver…</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button disabled={!receiverPick || busy} onClick={async () => { const p = people.find(x => x.id === receiverPick)!; if (await act({ action: 'add_receiver', id, name: p.name, email: p.email }, 'Receiver added — they\'ve been emailed')) setReceiverPick('') }} className="text-sm bg-blue-900 text-white px-4 rounded-lg disabled:opacity-40">Add</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Conversation</h3>
        {msgs.length === 0 ? <p className="text-sm text-gray-400">No messages yet.</p> : (
          <div className="space-y-3">
            {msgs.map(m => m.author_type === 'system' ? (
              <p key={m.id} className="text-xs text-gray-400 text-center italic">{m.body} · {stamp(m.created_at)}</p>
            ) : (
              <div key={m.id} className={`flex ${m.author_type === 'client' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm border ${m.author_type === 'client' ? 'bg-gray-50 border-gray-200' : m.visible_to_client ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-200'}`}>
                  <p className="text-[11px] text-gray-500 mb-0.5">{m.author_name || (m.author_type === 'client' ? 'Client' : 'Staff')} · {stamp(m.created_at)}{!m.visible_to_client && <span className="ml-2 font-semibold text-amber-700">INTERNAL NOTE — client can&apos;t see this</span>}</p>
                  {m.body && <p className="text-gray-800 whitespace-pre-wrap">{m.body}</p>}
                  <AttList list={m.attachments || []} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={!internal} onChange={() => setInternal(false)} /> Reply to client</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={internal} onChange={() => setInternal(true)} /> Internal note</label>
          </div>
          <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={internal ? 'Only staff will see this…' : 'The client will see this and be emailed…'} className={input} />
          <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} className="text-xs w-full" />
          <p className="text-[11px] text-gray-400">PDF, Word, Excel, images — up to 5 files, 4 MB in total.</p>
          <button onClick={send} disabled={busy} className={`text-sm font-medium px-4 py-2 rounded-lg text-white transition disabled:opacity-50 ${internal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-900 hover:bg-blue-950'}`}>{busy ? 'Sending…' : internal ? 'Save internal note' : 'Send reply'}</button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
function Routing({ employees, isPreviewing, showToast }: { employees: Employee[], isPreviewing: boolean, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ level: 'director', client: '', recipients: '' })
  const clientNames = Array.from(new Set(employees.map(e => e.client).filter(Boolean))) as string[]

  async function load() {
    const r = await staffApi({ action: 'routing_list' })
    if (r.ok) setRows(r.data.routing); else showToast(r.data.error || 'Could not load routing', 'error')
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (isPreviewing) return showToast('Preview mode is view-only', 'error')
    const r = await staffApi({ action: 'routing_set', level: f.level, client: f.client, recipients: f.recipients })
    if (!r.ok) return showToast(r.data.error || 'Could not save', 'error')
    showToast('Saved'); setF({ ...f, recipients: '' }); load()
  }
  async function del(id: string) {
    if (isPreviewing) return showToast('Preview mode is view-only', 'error')
    if (!confirm('Remove this rule?')) return
    const r = await staffApi({ action: 'routing_delete', id }); if (r.ok) load()
  }
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-900 space-y-1">
        <p><strong>How alerts are routed.</strong> The client picks who a request goes to. The alert email then goes to:</p>
        <ol className="list-decimal pl-5 text-xs space-y-0.5">
          <li>the rule below for that client and level, if you&apos;ve set one;</li>
          <li><strong>Team Lead level only:</strong> the Team Leads who support that client — automatic, nothing to set up;</li>
          <li>the general rule below for that level;</li>
          <li>otherwise the default operations address, so an alert is never lost.</li>
        </ol>
        <p className="text-xs">Account Manager isn&apos;t a role in the portal yet, so set who receives those below.</p>
      </div>
      <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div><label className="block text-xs text-gray-500 mb-1">Level</label><select value={f.level} onChange={e => setF({ ...f, level: e.target.value })} className={input}>{REQUEST_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
        <div><label className="block text-xs text-gray-500 mb-1">Client (blank = all clients)</label><input list="route-clients" value={f.client} onChange={e => setF({ ...f, client: e.target.value })} className={input} /><datalist id="route-clients">{clientNames.map(c => <option key={c} value={c} />)}</datalist></div>
        <div className="sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">Email address(es), comma-separated</label><input required value={f.recipients} onChange={e => setF({ ...f, recipients: e.target.value })} className={input} placeholder="name@ab-businesssupport.com" /></div>
        <div className="sm:col-span-4"><button type="submit" className="bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium px-4 py-2 rounded-lg">Save rule</button> <span className="text-xs text-gray-400 ml-2">Saving the same level and client again replaces the old rule.</span></div>
      </form>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100 text-left"><th className="px-4 py-2 font-medium text-gray-500">Level</th><th className="px-4 py-2 font-medium text-gray-500">Client</th><th className="px-4 py-2 font-medium text-gray-500">Alerts go to</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="text-center py-6 text-gray-400">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={4} className="text-center py-6 text-gray-400">No rules yet — everything goes to the default operations address (Team Lead level goes to the client&apos;s Team Leads).</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{levelLabel(r.level)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.client || 'All clients'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.recipients}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => del(r.id)} className="text-xs text-red-500 hover:underline">Remove</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

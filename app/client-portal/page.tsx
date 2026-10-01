'use client'
import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

// Deliberately its own minimal shell -- no sidebar, no nav to any other
// module, not even a "restricted" placeholder for one. A client account
// can reach exactly one thing: their own onboarding checklist. See the
// build discussion in chat for why a locked-but-visible nav list was
// ruled out here (it would expose the shape of AB BSS's internal
// tooling to an outside party for no real benefit).

type Contact = { id: string, name: string, email: string, client: string }
type ChecklistItem = { id: string, section: string, label: string, description: string | null, sort_order: number }
type Submission = { id: string, item_id: string, received: boolean, file_name: string | null, drive_link: string | null, notes: string | null, submitted_at: string | null, received_at: string | null, not_applicable: boolean, na_reason: string | null }
type Gap = { id: string, missing_item: string, impact: string | null, owner: string | null, due_date: string | null, status: string }
type Pack = { id: string, status: string, account_name: string | null, target_go_live_date: string | null }
type Readiness = { pct: number, readyCount: number, totalCount: number } | null

const STATUS_LABEL: Record<string,string> = {
  in_progress: 'In Progress', accepted: 'Accepted', accepted_with_gaps: 'Accepted with Logged Gaps', not_accepted: 'Not Yet Accepted',
}
const STATUS_COLOR: Record<string,string> = {
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200', accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  accepted_with_gaps: 'bg-amber-50 text-amber-700 border-amber-200', not_accepted: 'bg-gray-50 text-gray-600 border-gray-200',
}

export default function ClientPortalPage() {
  const [checking, setChecking] = useState(true)
  const [contact, setContact] = useState<Contact | null>(null)
  const [verifyError, setVerifyError] = useState('')

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')
      if (token) {
        try {
          const res = await fetch('/api/client-portal/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
          })
          const data = await res.json()
          if (!res.ok) { setVerifyError(data.error || 'Sign-in failed'); setChecking(false); return }
          window.history.replaceState({}, '', '/client-portal')
        } catch { setVerifyError('Sign-in failed'); setChecking(false); return }
      }
      const meRes = await fetch('/api/client-portal/me')
      const me = await meRes.json()
      setContact(me.contact)
      setChecking(false)
    })()
  }, [])

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400 text-sm">Loading...</p></div>
  }
  if (!contact) return <LoginScreen initialError={verifyError} />
  return <ChecklistScreen contact={contact} onLogout={() => setContact(null)} />
}

function LoginScreen({ initialError }: { initialError: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(initialError)

  async function requestLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true); setError('')
    try {
      const res = await fetch('/api/client-portal/request-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 to-blue-800 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-lg mx-auto mb-3">AB</div>
          <h1 className="text-lg font-bold text-blue-900">AB BSS Client Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Track your onboarding checklist</p>
        </div>
        {sent ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-700">If that email is registered, a sign-in link is on its way — check your inbox.</p>
            <p className="text-xs text-gray-400 mt-2">The link is valid for 24 hours and works once.</p>
          </div>
        ) : (
          <form onSubmit={requestLink} className="space-y-3">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourcompany.com"
              className="w-full border border-gray-300 rounded-lg text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={sending} className="w-full bg-blue-900 hover:bg-blue-950 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50">
              {sending ? 'Sending...' : 'Send me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ChecklistScreen({ contact, onLogout }: { contact: Contact, onLogout: () => void }) {
  const [pack, setPack] = useState<Pack | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [gaps, setGaps] = useState<Gap[]>([])
  const [readiness, setReadiness] = useState<Readiness>(null)
  const [loading, setLoading] = useState(true)
  const [openItem, setOpenItem] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/client-portal/checklist')
    const data = await res.json()
    setPack(data.pack); setItems(data.items || []); setSubmissions(data.submissions || []); setGaps(data.gaps || [])
    setReadiness(data.readiness || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function logout() {
    await fetch('/api/client-portal/logout', { method: 'POST' })
    onLogout()
  }

  const bySection: Record<string, ChecklistItem[]> = {}
  items.forEach(i => { (bySection[i.section] ||= []).push(i) })
  const subByItem: Record<string, Submission> = {}
  submissions.forEach(s => { subByItem[s.item_id] = s })
  const receivedCount = submissions.filter(s => s.received).length
  const resolvedCount = submissions.filter(s => s.received || s.not_applicable).length
  const pct = items.length ? Math.round((resolvedCount / items.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-bold text-sm">AB</div>
          <div>
            <p className="font-semibold text-sm">AB BSS Client Portal</p>
            <p className="text-xs text-blue-200">{contact.client}</p>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-blue-200 hover:text-white transition">Sign out</button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : !pack ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Your onboarding checklist hasn't been set up yet. Your AB BSS Operations contact will let you know once it's ready.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-semibold text-blue-900">Onboarding Checklist</h2>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[pack.status]}`}>{STATUS_LABEL[pack.status]}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-900 h-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{receivedCount} of {items.length} items received ({pct}% resolved{submissions.some(s=>s.not_applicable) ? `, including N/A` : ''})</p>
            </div>

            {readiness && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex items-center gap-5">
                <div className="w-24 h-24 flex-shrink-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ value: readiness.readyCount }, { value: readiness.totalCount - readiness.readyCount }]}
                        dataKey="value" innerRadius={32} outerRadius={44} startAngle={90} endAngle={-270} stroke="none">
                        <Cell fill="#059669" />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-blue-900">{readiness.pct}%</span>
                  </div>
                </div>
                <div>
                  <h2 className="font-semibold text-blue-900">Go-Live Readiness</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{readiness.readyCount} of {readiness.totalCount} critical items ready</p>
                  <p className="text-xs text-gray-400 mt-1">This reflects our internal go-live checks — no need to check in, we'll keep this updated as we progress.</p>
                </div>
              </div>
            )}

            {Object.entries(bySection).map(([section, sectionItems]) => (
              <div key={section} className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">{section}</h3>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {sectionItems.map(item => (
                    <ChecklistRow key={item.id} item={item} submission={subByItem[item.id]} open={openItem === item.id}
                      onToggle={() => setOpenItem(openItem === item.id ? null : item.id)} onSaved={load} />
                  ))}
                </div>
              </div>
            ))}

            {gaps.length > 0 && (
              <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Open Items from AB BSS</h3>
                <p className="text-xs text-gray-400 mb-3">Things our team has flagged as still needed or in progress on our end.</p>
                <div className="space-y-2">
                  {gaps.map(g => (
                    <div key={g.id} className={`text-sm border rounded-lg px-3 py-2 ${g.status === 'closed' ? 'bg-gray-50 border-gray-100 text-gray-400' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{g.missing_item}</span>
                        <span className="text-xs">{g.status === 'closed' ? 'Resolved' : g.due_date ? `Due ${new Date(g.due_date).toLocaleDateString()}` : 'Open'}</span>
                      </div>
                      {g.impact && <p className="text-xs mt-0.5 opacity-80">{g.impact}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function ChecklistRow({ item, submission, open, onToggle, onSaved }: {
  item: ChecklistItem, submission?: Submission, open: boolean, onToggle: () => void, onSaved: () => void,
}) {
  const [driveLink, setDriveLink] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [naReason, setNaReason] = useState('')
  const [showNaForm, setShowNaForm] = useState(false)

  async function submit() {
    if (!file && !driveLink.trim()) { setError('Attach a file or a link'); return }
    setSaving(true); setError('')
    const form = new FormData()
    form.append('item_id', item.id)
    if (file) form.append('file', file)
    if (driveLink.trim()) form.append('drive_link', driveLink.trim())
    if (notes.trim()) form.append('notes', notes.trim())
    try {
      const res = await fetch('/api/client-portal/submit-item', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setFile(null); setDriveLink(''); setNotes('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    }
    setSaving(false)
  }

  async function submitNotApplicable() {
    setSaving(true); setError('')
    const form = new FormData()
    form.append('item_id', item.id)
    form.append('not_applicable', 'true')
    if (naReason.trim()) form.append('notes', naReason.trim())
    try {
      const res = await fetch('/api/client-portal/submit-item', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setNaReason(''); setShowNaForm(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    }
    setSaving(false)
  }

  const resolved = submission?.received || submission?.not_applicable

  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${submission?.received ? 'bg-emerald-500 text-white' : submission?.not_applicable ? 'bg-gray-400 text-white' : 'bg-gray-200 text-gray-400'}`}>
            {submission?.received ? '✓' : submission?.not_applicable ? '—' : ''}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate">{item.label}</span>
        </div>
        <span className="text-gray-300 text-xs flex-shrink-0 ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-gray-50/50">
          {item.description && <p className="text-xs text-gray-500 mb-3">{item.description}</p>}
          {submission?.received && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3 text-xs text-emerald-800">
              Received{submission.submitted_at ? ` on ${new Date(submission.submitted_at).toLocaleDateString()}` : ''}
              {submission.file_name && ` — ${submission.file_name}`}
              {submission.drive_link && <> — <a href={submission.drive_link} target="_blank" rel="noopener noreferrer" className="underline">linked file</a></>}
              {submission.received_at && <span className="block mt-0.5 text-emerald-600">Confirmed received by AB BSS on {new Date(submission.received_at).toLocaleDateString()}</span>}
            </div>
          )}
          {submission?.not_applicable && (
            <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 mb-3 text-xs text-gray-600">
              Marked not applicable{submission.na_reason ? ` — "${submission.na_reason}"` : ''}
            </div>
          )}
          {!resolved && (
            <div className="space-y-2">
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs w-full" />
              <input type="url" value={driveLink} onChange={e => setDriveLink(e.target.value)} placeholder="Or paste a Google Drive / file link"
                className="w-full border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-900" />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
                className="w-full border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-900" />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={submit} disabled={saving} className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
                  {saving ? 'Submitting...' : 'Submit'}
                </button>
                {!showNaForm ? (
                  <button onClick={() => setShowNaForm(true)} className="text-xs text-gray-400 hover:text-gray-600 underline">Not applicable to us</button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input value={naReason} onChange={e => setNaReason(e.target.value)} placeholder="Why? (optional)" className="border border-gray-300 rounded-lg text-gray-900 px-2 py-1.5 text-xs" />
                    <button onClick={submitNotApplicable} disabled={saving} className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50">Confirm N/A</button>
                    <button onClick={() => setShowNaForm(false)} className="text-xs text-gray-400">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {resolved && (
            <div className="space-y-2">
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs w-full" />
              <input type="url" value={driveLink} onChange={e => setDriveLink(e.target.value)} placeholder="Replace with a Google Drive / file link"
                className="w-full border border-gray-300 rounded-lg text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-900" />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button onClick={submit} disabled={saving || (!file && !driveLink.trim())} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                {saving ? 'Submitting...' : 'Replace with a file or link instead'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

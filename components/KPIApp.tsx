'use client' // v1782647059
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, Employee, KpiRecord } from '@/lib/supabase'
import { LineChart, BarChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Bell, Gamepad2, Users, BarChart2, PlusCircle, LogOut, Search, Edit2, Trash2, Save, X, CheckCircle, AlertCircle, TrendingUp, Award, UserPlus, Menu, ChevronDown, ChevronUp, FileText, Shield, Key } from 'lucide-react'

type View = 'announcements' | 'gaming-hub' | 'dashboard-month' | 'dashboard-employee' | 'dashboard-team' | 'entry' | 'employees' | 'teams' | 'observations' | 'org-chart' | 'tickets' | 'tl-tools' | 'directory' | 'settings'
type PerfView = 'weekly' | 'monthly' | 'quarterly' | 'annual'
type Toast = { msg: string; type: 'success' | 'error' }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = ['2024','2025','2026','2027','2028','2029','2030']
const QUARTERS = ['Q1 (Jan-Mar)','Q2 (Apr-Jun)','Q3 (Jul-Sep)','Q4 (Oct-Dec)']


const AVATAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
  'bg-pink-500', 'bg-rose-500', 'bg-orange-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-emerald-500'
]
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function Avatar({ name, avatarUrl, size = 'md' }: { name: string, avatarUrl?: string | null, size?: 'sm'|'md'|'lg' }) {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-14 h-14 text-xl' }
  const initial = name?.charAt(0)?.toUpperCase() || '?'
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white`} />
  return <div className={`${sizes[size]} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>{initial}</div>
}

function scoreColor(s: number | null) {
  if (s === null) return 'text-gray-400'
  if (s >= 0.9999) return 'text-emerald-600'
  if (s >= 0.97) return 'text-blue-600'
  if (s >= 0.94) return 'text-yellow-600'
  return 'text-red-500'
}
function scoreBg(s: number | null) {
  if (s === null) return 'bg-gray-100 text-gray-400'
  if (s >= 0.9999) return 'bg-emerald-50 text-emerald-700'
  if (s >= 0.97) return 'bg-blue-50 text-blue-700'
  if (s >= 0.94) return 'bg-yellow-50 text-yellow-700'
  return 'bg-red-50 text-red-600'
}
function pct(v: number | null) {
  if (v === null) return 'N/A'
  return (v * 100).toFixed(2) + '%'
}
function monthIndex(label: string) { return MONTHS.indexOf(label.split(' ')[0]) }
function yearOf(label: string) { const p = label.split(' '); return parseInt(p[p.length-1]) || 0 }

async function writeAuditLog(action: string, performedBy: string, employeeName: string, monthLabel: string, fieldChanged: string, oldValue: string, newValue: string) {
  await supabase.from('audit_log').insert({ action, performed_by: performedBy, employee_name: employeeName, month_label: monthLabel, field_changed: fieldChanged, old_value: oldValue, new_value: newValue })
}

// -- HomeScreen Component ----------------------------------------------------
const TAG_COLORS: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700 border border-red-200',
  Info: 'bg-blue-100 text-blue-700 border border-blue-200',
  Reminder: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  Policy: 'bg-purple-100 text-purple-700 border border-purple-200',
}

function getMonthYear() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function getMonthLabel() {
  return new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
}


// -- Theme Background ---------------------------------------------------------
function useAnnouncementBg() {
  const [bgUrl, setBgUrl] = useState<string|null>(null)
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key','announcement_bg').single()
      .then(({ data }) => { if (data?.value) setBgUrl(data.value) })
  }, [])
  return bgUrl
}

function ThemeBgUploader({ userRole, showToast }: { userRole: string, showToast: (m: string, t: 'success'|'error') => void }) {
  const [uploading, setUploading] = useState(false)
  const [currentBg, setCurrentBg] = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canUpload = ['super_admin','admin','team_lead'].includes(userRole)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key','announcement_bg').single()
      .then(({ data }) => { if (data?.value) setCurrentBg(data.value) })
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `themes/announcement-bg-${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const url = urlData.publicUrl
    await supabase.from('app_settings').upsert({ key: 'announcement_bg', value: url }, { onConflict: 'key' })
    setCurrentBg(url)
    showToast('Theme background updated! Refresh the page to see it.', 'success')
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeBg() {
    await supabase.from('app_settings').upsert({ key: 'announcement_bg', value: '' }, { onConflict: 'key' })
    setCurrentBg(null)
    showToast('Background removed', 'success')
  }

  if (!canUpload) return null

  return (
    <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl px-4 py-3">
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-900">🎨 Monthly Theme Background</p>
        <p className="text-xs text-gray-600">Upload a photo to set this monthly vibe</p>
      </div>
      {currentBg && (
        <img src={currentBg} alt="Current bg" className="h-8 w-12 object-cover rounded-lg border border-gray-200" />
      )}
      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition">
        {uploading ? '⏳' : '📸 Change'}
      </button>
      {currentBg && <button onClick={removeBg} className="text-xs text-gray-400 hover:text-red-500 transition">✕</button>}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  )
}



// -- Announcements -----------------------------------------------------------
function AnnouncementsPanel({ userEmail, userRole, showToast }: { userEmail: string, userRole: string, showToast: (m: string, t: 'success'|'error') => void }) {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [acks, setAcks] = useState<Record<string, boolean>>({})
  const [ackDetails, setAckDetails] = useState<Record<string, any[]>>({})
  const [showForm, setShowForm] = useState(false)
  const [showAcks, setShowAcks] = useState<string|null>(null)
  const [form, setForm] = useState({ title: '', body: '', tag: 'Info' })
  const [attachments, setAttachments] = useState<{name:string,url:string,type:string}[]>([])
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canPost = ['super_admin','admin','team_lead'].includes(userRole)
  const canManage = ['super_admin','admin'].includes(userRole)
  const TAG_COLORS: Record<string,string> = {
    Urgent:'bg-red-100 text-red-700 border border-red-200',
    Info:'bg-blue-100 text-blue-700 border border-blue-200',
    Reminder:'bg-yellow-100 text-yellow-700 border border-yellow-200',
    Policy:'bg-purple-100 text-purple-700 border border-purple-200',
  }

  useEffect(() => { loadAnnouncements() }, [])

  async function loadAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false })
    if (data) {
      setAnnouncements(data)
      const ids = data.map((a:any) => a.id)
      if (ids.length > 0) {
        const { data: myAcks } = await supabase.from('announcement_acknowledgements').select('announcement_id').eq('user_email', userEmail).in('announcement_id', ids)
        const ackMap: Record<string,boolean> = {}
        myAcks?.forEach((a:any) => { ackMap[a.announcement_id] = true })
        setAcks(ackMap)
      }
    }
  }

  async function uploadFile(file: File) {
    setUploading(true)
    const path = `announcements/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const isImage = file.type.startsWith('image/')
    const fileType = isImage ? 'image' : file.type.includes('pdf') ? 'pdf' : 'doc'
    setAttachments(prev => [...prev, { name: file.name, url: urlData.publicUrl, type: fileType }])
    setUploading(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) { await uploadFile(file) }
  }

  async function postAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return
    setPosting(true)
    const { error } = await supabase.from('announcements').insert({ title: form.title.trim(), body: form.body.trim(), tag: form.tag, posted_by: userEmail, attachments })
    if (error) showToast(error.message, 'error')
    else { setForm({ title:'', body:'', tag:'Info' }); setAttachments([]); setShowForm(false); showToast('Posted!','success'); loadAnnouncements() }
    setPosting(false)
  }

  async function acknowledge(id: string) {
    await supabase.from('announcement_acknowledgements').insert({ announcement_id: id, user_email: userEmail })
    setAcks(prev => ({ ...prev, [id]: true })); showToast('Acknowledged!','success')
  }

  async function loadAckDetails(id: string) {
    const { data } = await supabase.from('announcement_acknowledgements').select('*').eq('announcement_id', id).order('acknowledged_at')
    setAckDetails(prev => ({ ...prev, [id]: data || [] }))
    setShowAcks(showAcks === id ? null : id)
  }

  async function deleteAnnouncement(id: string) {
    await supabase.from('announcements').update({ active: false }).eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    showToast('Removed','success')
  }

  const unread = announcements.filter(a => !acks[a.id])
  const [bgUrl, setBgUrl] = useState<string|null>(null)
  const [editingBg, setEditingBg] = useState(false)
  const [bgInput, setBgInput] = useState('')
  const canChangeBg = ['super_admin','admin','team_lead'].includes(userRole)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key','announcement_bg').single()
      .then(({ data }) => {
        if (data?.value) { setBgUrl(data.value); setBgInput(data.value) }
      })
  }, [])

  async function saveBg() {
    await supabase.from('app_settings').upsert({ key: 'announcement_bg', value: bgInput.trim() }, { onConflict: 'key' })
    setBgUrl(bgInput.trim())
    setEditingBg(false)
    showToast('Background updated!', 'success')
  }

  return (
    <div className="space-y-3">
      {bgUrl && (
        <div className="relative h-36 rounded-2xl overflow-hidden">
          <img src={bgUrl} alt="bg" className="absolute inset-0 w-full h-full object-cover" style={{filter:'blur(3px) brightness(0.5)',transform:'scale(1.05)'}} />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white font-bold text-2xl drop-shadow-lg">Announcements</p>
          </div>
          {canChangeBg && (
            <button onClick={() => setEditingBg(!editingBg)} className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 text-white text-xs px-2 py-1 rounded-lg transition">Change photo</button>
          )}
        </div>
      )}
      {!bgUrl && canChangeBg && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-2">Add a monthly theme photo</p>
          <button onClick={() => setEditingBg(true)} className="text-xs bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">+ Add photo URL</button>
        </div>
      )}
      {editingBg && canChangeBg && (
        <div className="flex gap-2 items-center">
          <input value={bgInput} onChange={e => setBgInput(e.target.value)} placeholder="Paste image URL here..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <button onClick={saveBg} className="bg-blue-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-800 transition">Save</button>
          <button onClick={() => setEditingBg(false)} className="text-gray-400 hover:text-gray-600 text-sm px-2">Cancel</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-base text-gray-900">Announcements</h2>
          {unread.length > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unread.length}</span>}
        </div>
        {canPost && <button onClick={() => setShowForm(!showForm)} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showForm ? 'Cancel' : '+ Post'}</button>}
      </div>
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Title..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <textarea value={form.body} onChange={e => setForm(p=>({...p,body:e.target.value}))} placeholder="Write your announcement..." rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50">{uploading ? ' Uploading...' : ' Attach'}</button>
            <span className="text-xs text-gray-400">Images, PDF, Word</span>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs">
                  <span>{att.type==='image'?'IMG':att.type==='pdf'?'PDF':'DOC'}</span>
                  <span className="text-gray-700 max-w-xs truncate">{att.name}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500 ml-1">x</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <select value={form.tag} onChange={e => setForm(p=>({...p,tag:e.target.value}))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
              <option>Info</option><option>Urgent</option><option>Reminder</option><option>Policy</option>
            </select>
            <button onClick={postAnnouncement} disabled={posting||uploading} className="ml-auto bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{posting ? 'Posting...' : 'Post'}</button>
          </div>
        </div>
      )}
      {announcements.length === 0 && <div className="text-center py-8 text-gray-600 text-sm">No announcements yet.</div>}
      {announcements.map(a => (
        <div key={a.id} className={`bg-white border rounded-xl p-4 space-y-2 ${a.tag==='Urgent'?'border-red-300':'border-gray-200'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[a.tag]||TAG_COLORS.Info}`}>{a.tag}</span>
              <h3 className="font-semibold text-gray-900 text-sm">{a.title}</h3>
            </div>
            {canManage && <button onClick={() => deleteAnnouncement(a.id)} className="text-gray-300 hover:text-red-500 text-xs transition">x</button>}
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>
          {a.attachments && a.attachments.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(a.attachments as any[]).filter((att:any)=>att.type!=='image').map((att:any,i:number) => (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-1.5 text-xs text-blue-700 transition">
                    <span>{att.type==='pdf'?'PDF':'DOC'}</span><span className="max-w-xs truncate">{att.name}</span>
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(a.attachments as any[]).filter((att:any)=>att.type==='image').map((att:any,i:number) => (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                    <img src={att.url} alt={att.name} className="h-24 w-auto rounded-lg border border-gray-200 object-cover hover:opacity-90 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-400">By {a.posted_by.split('@')[0]} - {new Date(a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
            <div className="flex items-center gap-2">
              {canManage && <button onClick={() => loadAckDetails(a.id)} className="text-xs text-blue-600 hover:underline">Compliance</button>}
              {!acks[a.id] ? (
                <button onClick={() => acknowledge(a.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition">Acknowledge</button>
              ) : (
                <span className="text-xs text-green-600 font-medium">Done</span>
              )}
            </div>
          </div>
          {showAcks === a.id && ackDetails[a.id] && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-1">Acknowledged ({ackDetails[a.id].length}):</p>
              {ackDetails[a.id].length === 0 ? (
                <p className="text-xs text-gray-400">No one yet</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                    {ackDetails[a.id].map((ac:any) => (
                      <span key={ac.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">{ac.user_email.split('@')[0]} - {new Date(ac.acknowledged_at).toLocaleDateString()}</span>
                    ))}
                  </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}


// -- Game of the Month -------------------------------------------------------
function GameOfMonth({ userEmail, userName, onScoreSaved }: { userEmail: string, userName: string, onScoreSaved: () => void }) {
  const GAME = { name: 'Subway Surfers', url: 'https://poki.com/en/g/subway-surfers', icon: '🏄', color: 'from-orange-400 to-pink-500' }
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [todaySubmitted, setTodaySubmitted] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { checkTodaySubmission() }, [])

  async function checkTodaySubmission() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('game_score_submissions').select('id').eq('user_email', userEmail).gte('submitted_at', today).limit(1)
    if (data && data.length > 0) setTodaySubmitted(true)
  }

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const path = `game-scores/${userEmail}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
      if (uploadError) { setError('Upload failed: ' + uploadError.message); setUploading(false); return }
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
      const now = new Date()
      const monthYear = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
      const { error: insertError } = await supabase.from('game_score_submissions').insert({
        user_email: userEmail,
        user_name: userName,
        game_key: 'game_of_month',
        month_year: monthYear,
        screenshot_url: urlData.publicUrl,
        status: 'pending',
        submitted_at: new Date().toISOString()
      })
      if (insertError) { setError('Submission failed: ' + insertError.message); setUploading(false); return }
      setSubmitted(true); setTodaySubmitted(true); onScoreSaved()
    } catch { setError('Something went wrong. Please try again.') }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`bg-gradient-to-br ${GAME.color} rounded-xl p-5 text-white text-center`}>
        <div className="text-4xl mb-2">{GAME.icon}</div>
        <h3 className="font-bold text-lg">{GAME.name}</h3>
        <p className="text-white/80 text-xs mb-3">Game of the Month — {getMonthLabel()}</p>
        <a href={GAME.url} target="_blank" rel="noopener noreferrer" className="inline-block bg-white text-orange-500 font-bold px-5 py-2 rounded-lg text-sm hover:bg-orange-50 transition">🎮 Play Now</a>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">📸 Submit Your Score</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Play the game, screenshot your high score. <strong>Make sure your device clock with date &amp; time is visible!</strong> Your score will appear on the leaderboard after admin review.
        </p>
        {todaySubmitted && !submitted ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
            ⏳ You already submitted today. Waiting for admin approval.
          </div>
        ) : submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
            ✅ Screenshot submitted! Admin will review and post your score to the leaderboard.
          </div>
        ) : (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl py-4 text-sm text-gray-500 hover:text-blue-600 transition disabled:opacity-50">
              {uploading ? '⏳ Uploading...' : '📤 Upload screenshot'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleScreenshot} className="hidden" />
          </>
        )}
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      </div>
    </div>
  )
}


// -- Monthly Leaderboard -----------------------------------------------------
function GameLeaderboard({ refreshKey, userRole, showToast }: { refreshKey: number, userRole: string, showToast: (m: string, t: 'success'|'error') => void }) {
  const [scores, setScores] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [approving, setApproving] = useState<string|null>(null)
  const isAdmin = ['super_admin','admin'].includes(userRole)

  useEffect(() => { loadScores(); if (isAdmin) loadPending() }, [refreshKey])

  async function loadScores() {
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const { data } = await supabase.from('game_scores').select('user_name,user_email,score,screenshot_url,played_at').eq('game_key','game_of_month').eq('month_year',monthYear).order('score',{ascending:false})
    const best: Record<string,any> = {}
    data?.forEach((row:any) => { if (!best[row.user_email]||row.score>best[row.user_email].score) best[row.user_email]=row })
    setScores(Object.values(best).sort((a,b)=>b.score-a.score).slice(0,10))
  }

  async function loadPending() {
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const { data } = await supabase.from('game_score_submissions').select('*').eq('status','pending').eq('month_year',monthYear).order('submitted_at',{ascending:true})
    setPending(data||[])
  }

  async function approveScore(sub: any, score: number) {
    setApproving(sub.id)
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    await supabase.from('game_scores').insert({ user_email: sub.user_email, user_name: sub.user_name, game_key: 'game_of_month', score, month_year: monthYear, screenshot_url: sub.screenshot_url, verified: true })
    await supabase.from('game_score_submissions').update({ status: 'approved', approved_score: score }).eq('id', sub.id)
    showToast(`Score ${score.toLocaleString()} approved for ${sub.user_name}!`, 'success')
    setApproving(null)
    loadScores(); loadPending()
  }

  async function rejectSubmission(id: string) {
    await supabase.from('game_score_submissions').update({ status: 'rejected' }).eq('id', id)
    showToast('Submission rejected', 'success')
    loadPending()
  }

  const medals = ['🥇','🥈','🥉']

  return (
    <div className="space-y-4">
      {/* Pending approvals - admin only */}
      {isAdmin && pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-yellow-800">⏳ Pending Score Approvals ({pending.length})</p>
          {pending.map(sub => (
            <div key={sub.id} className="bg-white border border-yellow-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{sub.user_name}</p>
                  <p className="text-xs text-gray-400">{new Date(sub.submitted_at).toLocaleString()}</p>
                </div>
                <a href={sub.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline">📸 View screenshot</a>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Enter score from screenshot..."
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  id={`score-${sub.id}`}
                />
                <button
                  onClick={() => { const el = document.getElementById(`score-${sub.id}`) as HTMLInputElement; const val = parseInt(el?.value||'0'); if(val>0) approveScore(sub,val) }}
                  disabled={approving===sub.id}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {approving===sub.id ? '...' : '✓ Approve'}
                </button>
                <button onClick={() => rejectSubmission(sub.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-200 transition">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-800 text-sm">🏆 {getMonthLabel()} Leaderboard</h3>
        <p className="text-xs text-gray-400">Subway Surfers - Top scores this month</p>
        {scores.length===0
          ? <p className="text-xs text-gray-400 text-center py-4">No scores yet. Be the first! 🎮</p>
          : scores.map((s,i)=>(
            <div key={s.user_email} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${i===0?'bg-yellow-50 border border-yellow-200':i===1?'bg-gray-100':i===2?'bg-orange-50':'bg-gray-50'}`}>
              <span className="text-sm w-5">{medals[i]||`${i+1}.`}</span>
              <span className="text-sm text-gray-800 flex-1 font-medium truncate">{s.user_name||s.user_email.split('@')[0]}</span>
              <div className="text-right">
                <span className="text-sm font-bold text-blue-900 block">{s.score.toLocaleString()}</span>
                {s.played_at && <span className="text-xs text-gray-400">{new Date(s.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
              </div>
              {s.screenshot_url && <a href={s.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition" title="View screenshot">📸</a>}
            </div>
          ))
        }
      </div>
    </div>
  )
}


export function HomeScreen({ currentUser, userRole, showToast, activeTab }: { currentUser: string, userRole: string, showToast: (m: string, t: 'success'|'error') => void, activeTab?: string }) {
  const [leaderboardKey, setLeaderboardKey] = useState(0)
  const userName = currentUser?.split('@')[0] || currentUser

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {userName}! 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {activeTab === 'gaming-hub' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <GameOfMonth userEmail={currentUser} userName={userName} onScoreSaved={() => setLeaderboardKey(k => k + 1)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <GameLeaderboard refreshKey={leaderboardKey} userRole={userRole} showToast={showToast} />
          </div>
        </div>
      ) : (
        <AnnouncementsPanel userEmail={currentUser} userRole={userRole} showToast={showToast} />
      )}
    </div>
  )
}


function LoginScreen({ onLogin }: { onLogin: (u: string, r: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login'|'forgot'|'reset'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('reset') ? 'reset' : 'login'
    }
    return 'login'
  })
  const [resetToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('reset') || ''
    }
    return ''
  })
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [resetDone, setResetDone] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      localStorage.setItem('kpi_user', JSON.stringify(data.user))
      onLogin(data.user.username, data.user.role)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Login failed') }
    finally { setLoading(false) }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setForgotLoading(true); setForgotError('')
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setForgotSent(true)
    } catch (err: unknown) { setForgotError(err instanceof Error ? err.message : 'Failed to send') }
    finally { setForgotLoading(false) }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirmPass) { setResetError('Passwords do not match'); return }
    if (newPass.length < 6) { setResetError('Password must be at least 6 characters'); return }
    setResetLoading(true); setResetError('')
    try {
      const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, newPassword: newPass }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResetDone(true)
      window.history.replaceState({}, '', window.location.pathname)
    } catch (err: unknown) { setResetError(err instanceof Error ? err.message : 'Failed to reset') }
    finally { setResetLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center md:justify-end md:pr-16 p-4 relative overflow-hidden">
      {/* Background image with slight blur */}
      <div className="absolute inset-0 z-0" style={{backgroundImage:"url('/login-bg.jpg')",backgroundSize:'cover',backgroundPosition:'center left',filter:'blur(2px) brightness(0.5)',transform:'scale(1.05)'}} />
      {/* Dark overlay */}
      <div className="absolute inset-0 z-0 bg-blue-950/30" />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 md:mx-0 p-8 relative z-10">
        <div className="text-center mb-8">
          <img src="/ab-logo.png" alt="AB BSS" className="w-20 h-20 object-contain mb-2 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900" data-v="2">Operations Portal</h1>
          <p className="text-gray-500 text-sm mt-1">AB Business Support Services</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="you@ab-businesssupport.com" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-900 hover:bg-blue-950 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">{loading ? 'Signing in...' : 'Sign in'}</button>
            <div className="text-center pt-1">
              <button type="button" onClick={() => setMode('forgot')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition">Forgot your password?</button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <div>
            {!forgotSent ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-gray-500 mb-2">Enter your email and we will send you a reset link. It expires in 1 hour.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                  <input type="email" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="you@ab-businesssupport.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
                </div>
                {forgotError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{forgotError}</p>}
                <button type="submit" disabled={forgotLoading} className="w-full bg-blue-900 hover:bg-blue-950 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">{forgotLoading ? 'Sending...' : 'Send reset link'}</button>
                <div className="text-center">
                  <button type="button" onClick={() => setMode('login')} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">Back to login</button>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-5xl">📧</div>
                <h3 className="font-semibold text-gray-900">Check your inbox</h3>
                <p className="text-sm text-gray-500">If <strong>{forgotEmail}</strong> has an account, a reset link is on its way. Check your spam folder too.</p>
                <button onClick={() => setMode('login')} className="text-sm text-blue-600 hover:underline">Back to login</button>
              </div>
            )}
          </div>
        )}

        {mode === 'reset' && (
          <div>
            {!resetDone ? (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-gray-600 mb-2">Enter your new password below.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <input type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Min. 6 characters" value={newPass} onChange={e => setNewPass(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                  <input type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Repeat password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
                </div>
                {resetError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{resetError}</p>}
                <button type="submit" disabled={resetLoading} className="w-full bg-blue-900 hover:bg-blue-950 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">{resetLoading ? 'Saving...' : 'Set new password'}</button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-5xl">✅</div>
                <h3 className="font-semibold text-gray-900">Password updated!</h3>
                <p className="text-sm text-gray-500">Your password has been changed. You can now log in.</p>
                <button onClick={() => setMode('login')} className="w-full bg-blue-900 hover:bg-blue-950 text-white font-medium py-2.5 rounded-lg transition">Go to login</button>
              </div>
            )}
          </div>
        )}

        {mode === 'login' && <p className="text-center text-xs text-gray-400 mt-6">Use your @ab-businesssupport.com email</p>}
      </div>
    </div>
  )
}



// -- Collapsible Sidebar -----------------------------------------------------
function CollapsibleSidebar({ view, setView, setMobileMenuOpen }: { view: string, setView: (v: any) => void, setMobileMenuOpen: (v: boolean) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({
    home: false, perf: false, people: false, ops: false, tltools: false, dir: false, sys: false
  })

  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const itemStyle = (id: string) =>
    `w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg ${
      view === id
        ? 'bg-gradient-to-r from-blue-900 to-blue-700 text-white font-bold shadow-md'
        : 'text-gray-600 hover:bg-gray-100 hover:text-blue-900'
    }`

  const SectionHeader = ({ sectionKey, label, hasActive }: { sectionKey: string, label: string, hasActive: boolean }) => (
    <button onClick={() => toggle(sectionKey)} className="w-full px-3 pt-3 pb-1">
      <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all ${hasActive ? 'bg-blue-900' : 'bg-blue-900/80 hover:bg-blue-900'}`}>
        <div className="w-1 h-4 bg-white rounded-full opacity-60 flex-shrink-0"/>
        <p className="text-xs font-black text-white uppercase tracking-widest flex-1 text-left">{label}</p>
        <span className={`text-white/70 text-xs font-bold transition-transform duration-200 inline-block ${collapsed[sectionKey] ? '-rotate-90' : 'rotate-0'}`}>▾</span>
      </div>
    </button>
  )

  const NavItem = ({ id, label, icon }: { id: string, label: string, icon: React.ReactNode }) => (
    <button onClick={() => { setView(id); setMobileMenuOpen(false) }} className={itemStyle(id)}>
      {icon}
      <span className="truncate">{label}</span>
      {view === id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"/>}
    </button>
  )

  return (
    <div className="flex-1 overflow-y-auto py-3">

      {/* HOME */}
      <SectionHeader sectionKey="home" label="Home" hasActive={['announcements','gaming-hub'].includes(view)} />
      {!collapsed.home && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="announcements" label="Announcements" icon={<Bell className="w-4 h-4 flex-shrink-0"/>}/>
          <NavItem id="gaming-hub" label="Gaming Hub" icon={<Gamepad2 className="w-4 h-4 flex-shrink-0"/>}/>
        </div>
      )}

      {/* PERFORMANCE */}
      <SectionHeader sectionKey="perf" label="Performance" hasActive={['dashboard-month','dashboard-employee','dashboard-team'].includes(view)} />
      {!collapsed.perf && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="dashboard-month" label="Dashboard" icon={<BarChart2 className="w-4 h-4 flex-shrink-0"/>}/>
          <NavItem id="dashboard-employee" label="Employee Trends" icon={<TrendingUp className="w-4 h-4 flex-shrink-0"/>}/>
          <NavItem id="dashboard-team" label="Team View" icon={<Users className="w-4 h-4 flex-shrink-0"/>}/>
        </div>
      )}

      {/* PEOPLE */}
      <SectionHeader sectionKey="people" label="People" hasActive={['employees','teams','org-chart'].includes(view)} />
      {!collapsed.people && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="employees" label="Employees" icon={<UserPlus className="w-4 h-4 flex-shrink-0"/>}/>
          <NavItem id="teams" label="Teams" icon={<Award className="w-4 h-4 flex-shrink-0"/>}/>
          <NavItem id="org-chart" label="Org Chart" icon={<Users className="w-4 h-4 flex-shrink-0"/>}/>
        </div>
      )}

      {/* OPERATIONS */}
      <SectionHeader sectionKey="ops" label="Operations" hasActive={['tickets'].includes(view)} />
      {!collapsed.ops && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="tickets" label="Tickets" icon={<FileText className="w-4 h-4 flex-shrink-0"/>}/>
        </div>
      )}

      {/* TEAM LEAD TOOLS */}
      <SectionHeader sectionKey="tltools" label="Team Lead Tools" hasActive={['entry','observations','tl-tools'].includes(view)} />
      {!collapsed.tltools && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="entry" label="KPI Entry" icon={<PlusCircle className="w-4 h-4 flex-shrink-0"/>}/>
          <NavItem id="observations" label="Observations" icon={<FileText className="w-4 h-4 flex-shrink-0"/>}/>
          <NavItem id="tl-tools" label="Coaching & 1-on-1" icon={<Shield className="w-4 h-4 flex-shrink-0"/>}/>
        </div>
      )}

      {/* DIRECTORY */}
      <SectionHeader sectionKey="dir" label="Directory" hasActive={['directory'].includes(view)} />
      {!collapsed.dir && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="directory" label="Links & Resources" icon={<TrendingUp className="w-4 h-4 flex-shrink-0"/>}/>
        </div>
      )}

      {/* SYSTEM */}
      <SectionHeader sectionKey="sys" label="System" hasActive={['settings'].includes(view)} />
      {!collapsed.sys && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="settings" label="Settings" icon={<Shield className="w-4 h-4 flex-shrink-0"/>}/>
        </div>
      )}

    </div>
  )
}

export default function KPIApp() {
  const [user, setUser] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('viewer')
  const [previewAs, setPreviewAs] = useState<'self'|'viewer'>('self')
  const effectiveRole = previewAs === 'viewer' ? 'viewer' : userRole
  const [view, setView] = useState<View>('announcements')
  const [perfView, setPerfView] = useState<PerfView>('monthly')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<KpiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selMonth, setSelMonth] = useState(MONTHS[new Date().getMonth()])
  const [selYear, setSelYear] = useState(String(new Date().getFullYear()))
  const [selQuarter, setSelQuarter] = useState(Math.floor(new Date().getMonth() / 3))
  const [selEmployee, setSelEmployee] = useState<string>('')
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('kpi_user')
    if (stored) { const u = JSON.parse(stored); setUser(u.username); setUserRole(u.role || 'viewer') }
    else setLoading(false)
  }, [])

  useEffect(() => { if (user) loadData() }, [user])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  async function loadData() {
    setLoading(true)
    const [{ data: emps }, { data: recs }] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('kpi_records').select('*').order('month_label')
    ])
    setEmployees(emps || [])
    setRecords(recs || [])
    if (emps && emps.length > 0 && !selEmployee) setSelEmployee(emps[0].id)
    setLoading(false)
  }

  if (!user) return <LoginScreen onLogin={(u, r) => { setUser(u); setUserRole(r || 'viewer'); setLoading(true) }} />

  const navItems = [
    { id: 'dashboard-month' as View, label: 'Performance', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'dashboard-employee' as View, label: 'Employee', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'dashboard-team' as View, label: 'Team View', icon: <Users className="w-4 h-4" /> },
    { id: 'entry' as View, label: 'KPI Entry', icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'employees' as View, label: 'Employees', icon: <UserPlus className="w-4 h-4" /> },
    { id: 'teams' as View, label: 'Teams', icon: <Award className="w-4 h-4" /> },
    { id: 'observations' as View, label: 'Observations', icon: <FileText className="w-4 h-4" /> },
    { id: 'settings' as View, label: 'Settings', icon: <Shield className="w-4 h-4" /> },
  ]

  // Only active employee IDs for filtering performance
  const activeEmpIds = new Set(employees.filter(e => e.active).map(e => e.id))

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
      {/* Top bar */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 shadow-lg sticky top-0 z-40 h-14 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition"><Menu className="w-4 h-4" /></button>
          <img src="/ab-logo.png" alt="AB BSS" className="h-8 w-8 object-contain" />
          <span className="font-semibold text-white tracking-wide hidden sm:block">AB BSS Operations Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('settings')} className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1 transition">
            <UserAvatar username={user || ''} size="sm" />
            <span className="text-sm text-white hidden sm:block font-medium">{user}</span>
          </button>
          <button onClick={() => { localStorage.removeItem('kpi_user'); setUser(null) }} className="p-2 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 z-30 w-60 bg-gradient-to-b from-gray-50 to-white flex flex-col transition-transform duration-200 ease-in-out pt-14 md:pt-0 shadow-2xl border-r border-gray-200`}>
                    <CollapsibleSidebar view={view} setView={setView} setMobileMenuOpen={setMobileMenuOpen} />

          {/* User info at bottom of sidebar */}
          <div className="border-t border-gray-200 p-3 flex items-center gap-3 bg-white">
            <UserAvatar username={user || ''} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{userRole.replace('_',' ')}</p>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 animate-fadeIn">
          {/* Preview mode banner */}
          {(userRole === 'super_admin' || userRole === 'admin') && (
            <div className={`mb-4 flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${previewAs === 'viewer' ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
              <div className="flex items-center gap-2">
                {previewAs === 'viewer' ? <AlertCircle className="w-4 h-4 text-amber-500"/> : <Shield className="w-4 h-4 text-blue-500"/>}
                {previewAs === 'viewer' ? 'Previewing as Agent (Viewer) — notes and edits are hidden' : 'Viewing as Admin — full access'}
              </div>
              <button onClick={() => setPreviewAs(previewAs === 'viewer' ? 'self' : 'viewer')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${previewAs === 'viewer' ? 'bg-amber-200 hover:bg-amber-300 text-amber-900' : 'bg-blue-200 hover:bg-blue-300 text-blue-900'}`}>
                {previewAs === 'viewer' ? '← Back to Admin View' : '👁 Preview as Agent'}
              </button>
            </div>
          )}
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <>
            {view === 'dashboard-month' && <PerformanceDashboard records={records} employees={employees} activeEmpIds={activeEmpIds} perfView={perfView} setPerfView={setPerfView} selMonth={selMonth} selYear={selYear} selQuarter={selQuarter} setSelMonth={setSelMonth} setSelYear={setSelYear} setSelQuarter={setSelQuarter} searchQ={searchQ} setSearchQ={setSearchQ} onEditRecord={() => loadData()} showToast={showToast} currentUser={user} userRole={effectiveRole} />}
            {view === 'dashboard-employee' && <EmployeeDashboard records={records} employees={employees} activeEmpIds={activeEmpIds} selEmployee={selEmployee} setSelEmployee={setSelEmployee} />}
            {view === 'dashboard-team' && <TeamDashboard records={records} employees={employees} activeEmpIds={activeEmpIds} showToast={showToast} />}
            {view === 'entry' && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'team_lead') && <KPIEntry employees={employees} records={records} onSaved={() => { loadData(); showToast('KPI record saved!') }} showToast={showToast} currentUser={user} />}
            {view === 'entry' && userRole === 'viewer' && <div className="text-center py-20 text-gray-400"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p className="font-medium">Access Restricted</p><p className="text-sm mt-1">KPI Entry requires Team Lead access or higher</p></div>}
            {(view === 'announcements' || view === 'gaming-hub') && <HomeScreen currentUser={user || ''} userRole={userRole} showToast={showToast} activeTab={view} />}
            {view === 'employees' && <EmployeeManager employees={employees} onChanged={() => { loadData(); showToast('Updated!') }} showToast={showToast} currentUser={user} />}
            {view === 'teams' && <TeamManager employees={employees} showToast={showToast} />}
            {view === 'observations' && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'team_lead') && <ObservationsPanel employees={employees} currentUser={user} showToast={showToast} />}
            {view === 'observations' && userRole === 'viewer' && <div className="text-center py-20 text-gray-400"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p className="font-medium">Access Restricted</p><p className="text-sm mt-1">Observations require Team Lead access or higher</p></div>}
            {view === 'settings' && <SettingsPanel currentUser={user} userRole={userRole} showToast={showToast} />}
            {view === 'org-chart' && <ComingSoon title="Org Chart" description="Interactive organizational chart with employee photos and roles. Coming soon!" icon="👥" />}
            {view === 'tickets' && <ComingSoon title="Tickets" description="Internal ticket tracker for managing team requests and issues. Coming soon!" icon="🎫" />}
            {view === 'tl-tools' && <ComingSoon title="Team Lead Tools" description="Coaching logs, 1-on-1 trackers, and performance planning tools. Coming soon!" icon="🔧" />}
            {view === 'directory' && <DirectoryLinks />}
          </>
        )}
        </div>
        </main>
      </div>
    </div>
  )
}



// -- User Avatar (loads from DB) ---------------------------------------------
function UserAvatar({ username, size = 'md' }: { username: string, size?: 'sm'|'md'|'lg' }) {
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null)
  useEffect(() => {
    if (!username) return
    supabase.from('app_users').select('avatar_url').eq('username', username).single()
      .then(({data}) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url) })
  }, [username])
  return <Avatar name={username} avatarUrl={avatarUrl} size={size} />
}

// -- Expandable Note ---------------------------------------------------------
function ExpandableNote({ note }: { note: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!note) return <span className="text-gray-400">N/A</span>
  const short = note.length > 60
  return (
    <div>
      <span>{expanded ? note : note.substring(0, 60)}{!expanded && short ? '...' : ''}</span>
      {short && (
        <button onClick={() => setExpanded(!expanded)} className="ml-1 text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap">
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </div>
  )
}

// -- Edit Score Modal --------------------------------------------------------
function EditScoreModal({ record, currentUser, onSaved, onClose, showToast }: { record: KpiRecord, currentUser: string, onSaved: () => void, onClose: () => void, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [att, setAtt] = useState(record.attendance !== null ? (record.attendance * 100).toFixed(2) : '')
  const [acc, setAcc] = useState(record.accuracy !== null ? (record.accuracy * 100).toFixed(2) : '')
  const [eff, setEff] = useState(record.efficiency !== null ? (record.efficiency * 100).toFixed(2) : '')
  const [fb, setFb] = useState(record.feedback !== null ? (record.feedback * 100).toFixed(2) : '')
  const [notes, setNotes] = useState(record.notes || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const attN = att !== '' ? parseFloat(att)/100 : null
    const accN = acc !== '' ? parseFloat(acc)/100 : null
    const effN = eff !== '' ? parseFloat(eff)/100 : null
    const fbN = fb !== '' ? parseFloat(fb)/100 : null
    const overall = (attN !== null && accN !== null && effN !== null && fbN !== null)
      ? attN*0.2 + accN*0.3 + effN*0.3 + fbN*0.2 : record.overall_score

    // Build audit entries for changed fields
    const changes: {field: string, old: string, nw: string}[] = []
    if (attN !== record.attendance) changes.push({ field: 'Attendance', old: pct(record.attendance), nw: pct(attN) })
    if (accN !== record.accuracy) changes.push({ field: 'Accuracy', old: pct(record.accuracy), nw: pct(accN) })
    if (effN !== record.efficiency) changes.push({ field: 'Efficiency', old: pct(record.efficiency), nw: pct(effN) })
    if (fbN !== record.feedback) changes.push({ field: 'Feedback', old: pct(record.feedback), nw: pct(fbN) })
    if (notes !== record.notes) changes.push({ field: 'Notes', old: record.notes || '', nw: notes })

    const { error } = await supabase.from('kpi_records').update({ attendance: attN, accuracy: accN, efficiency: effN, feedback: fbN, overall_score: overall, notes, updated_at: new Date().toISOString() }).eq('id', record.id)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }

    // Write audit log for each changed field
    for (const c of changes) {
      await writeAuditLog('EDIT_SCORE', currentUser, record.employee_name || '', record.month_label || '', c.field, c.old, c.nw)
    }

    showToast('Record updated!'); onSaved(); onClose()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Edit KPI Record</h3>
            <p className="text-xs text-gray-400 mt-0.5">Changes will be logged to audit trail</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-sm font-medium text-gray-900">{record.employee_name}</p>
          <p className="text-xs text-gray-500">{record.designation} - {record.month_label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Attendance (20%)', val: att, set: setAtt },
            { label: 'Accuracy (30%)', val: acc, set: setAcc },
            { label: 'Efficiency (30%)', val: eff, set: setEff },
            { label: 'Feedback (20%)', val: fb, set: setFb },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <div className="relative">
                <input type="number" min="0" max="100" step="0.01" value={f.val} onChange={e => f.set(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-7 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="e.g. 100" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

// -- Performance Dashboard ---------------------------------------------------
function PerformanceDashboard({ records, employees, activeEmpIds, perfView, setPerfView, selMonth, selYear, selQuarter, setSelMonth, setSelYear, setSelQuarter, searchQ, setSearchQ, onEditRecord, showToast, currentUser, userRole }:
  { records: KpiRecord[], employees: Employee[], activeEmpIds: Set<string>, perfView: PerfView, setPerfView: (v: PerfView) => void, selMonth: string, selYear: string, selQuarter: number, setSelMonth: (v: string) => void, setSelYear: (v: string) => void, setSelQuarter: (v: number) => void, searchQ: string, setSearchQ: (v: string) => void, onEditRecord: () => void, showToast: (m: string, t?: 'success'|'error') => void, currentUser: string, userRole: string }) {

  const [editRecord, setEditRecord] = useState<KpiRecord | null>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selTeam, setSelTeam] = useState<string>('all')

  const [myTeamEmpIds, setMyTeamEmpIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    supabase.from('teams').select('id, name').order('name').then(({data}) => setTeams(data||[]))
    supabase.from('team_members').select('team_id, employee_id').then(({data: memberData}) => {
      setMembers(memberData||[])
      if (userRole === 'viewer' && currentUser) {
        // Get linked employee_id from app_users
        // Find employee by email match
        supabase.from('employees').select('id').eq('email', currentUser).then(({data: empData}) => {
          if (!empData || empData.length === 0) { setMyTeamEmpIds(null); return }
          const myEmpId = empData[0].id
          // Find my teams
          const myTeams = new Set((memberData||[]).filter((m:any) => m.employee_id === myEmpId).map((m:any) => m.team_id))
          if (myTeams.size === 0) { setMyTeamEmpIds(null); return }
          // Find all teammates
          const teammateIds = new Set((memberData||[]).filter((m:any) => myTeams.has(m.team_id)).map((m:any) => m.employee_id))
          setMyTeamEmpIds(teammateIds)
        })
      }
    })
  }, [userRole, currentUser])

  function getFilteredByView(): KpiRecord[] {
    const q = searchQ.toLowerCase()
    const teamEmpIds = selTeam === 'all' ? null : new Set(members.filter(m => m.team_id === selTeam).map(m => m.employee_id))
    // Viewers only see their own team members
    const viewerFilter = userRole === 'viewer' && myTeamEmpIds ? myTeamEmpIds : null
    let base = records.filter(r => activeEmpIds.has(r.employee_id) && (teamEmpIds === null || teamEmpIds.has(r.employee_id)) && (viewerFilter === null || viewerFilter.has(r.employee_id)))
    if (perfView === 'monthly' || perfView === 'weekly') {
      base = base.filter(r => (r.month_label||'').toLowerCase().includes(selMonth.toLowerCase()) && (r.month_label||'').includes(selYear))
    } else if (perfView === 'quarterly') {
      const qMonths = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]][selQuarter]
      base = base.filter(r => qMonths.includes(monthIndex(r.month_label||'')) && yearOf(r.month_label||'') === parseInt(selYear))
    } else {
      base = base.filter(r => yearOf(r.month_label||'') === parseInt(selYear))
    }
    return base.filter(r => !q || r.employee_name?.toLowerCase().includes(q) || r.designation?.toLowerCase().includes(q))
  }

  function aggregateRecords(recs: KpiRecord[]): KpiRecord[] {
    if (perfView === 'monthly' || perfView === 'weekly') return recs
    const empMap = new Map<string, KpiRecord[]>()
    recs.forEach(r => { if (!empMap.has(r.employee_id)) empMap.set(r.employee_id, []); empMap.get(r.employee_id)!.push(r) })
    const result: KpiRecord[] = []
    empMap.forEach(empRecs => {
      const valid = empRecs.filter(r => r.overall_score !== null)
      if (!valid.length) return
      const avg = (arr: (number|null)[]) => { const n = arr.filter(x => x !== null) as number[]; return n.length ? n.reduce((a,b) => a+b,0)/n.length : null }
      result.push({ ...valid[0], attendance: avg(valid.map(r=>r.attendance)), accuracy: avg(valid.map(r=>r.accuracy)), efficiency: avg(valid.map(r=>r.efficiency)), feedback: avg(valid.map(r=>r.feedback)), overall_score: avg(valid.map(r=>r.overall_score)), month_label: perfView === 'quarterly' ? QUARTERS[selQuarter]+' '+selYear : selYear, notes: null })
    })
    return result
  }

  const filtered = getFilteredByView()
  const displayed = aggregateRecords(filtered)
  const ranked = [...displayed].filter(r => r.overall_score !== null && (r.overall_score||0) > 0).sort((a,b) => (b.overall_score||0)-(a.overall_score||0))
  const avgScore = ranked.length ? ranked.reduce((s,r) => s+(r.overall_score||0),0)/ranked.length : 0
  const viewLabel = perfView === 'quarterly' ? QUARTERS[selQuarter]+' '+selYear : perfView === 'annual' ? selYear : selMonth+' '+selYear

  const perfTabs: {id: PerfView, label: string}[] = [
    {id:'weekly',label:'Weekly'},{id:'monthly',label:'Monthly'},{id:'quarterly',label:'Quarterly'},{id:'annual',label:'Annual'}
  ]

  return (
    <div className="space-y-6">
      {editRecord && userRole !== 'viewer' && <EditScoreModal record={editRecord} currentUser={currentUser} onSaved={onEditRecord} onClose={() => setEditRecord(null)} showToast={showToast} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Performance</h2>
          <p className="text-sm text-gray-500">{ranked.length} active employees for {viewLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {perfTabs.map(t => (
              <button key={t.id} onClick={() => setPerfView(t.id)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${perfView === t.id ? 'bg-white shadow text-blue-900' : 'text-gray-600 hover:text-gray-900'}`}>{t.label}</button>
            ))}
          </div>
          {perfView === 'quarterly' && <select value={selQuarter} onChange={e => setSelQuarter(parseInt(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{QUARTERS.map((q,i) => <option key={q} value={i}>{q}</option>)}</select>}
          {(perfView === 'monthly' || perfView === 'weekly') && <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{MONTHS.map(m => <option key={m}>{m}</option>)}</select>}
          {perfView !== 'weekly' && <select value={selYear} onChange={e => setSelYear(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{YEARS.map(y => <option key={y}>{y}</option>)}</select>}
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..." className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 w-36" /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {label:'Employees',value:ranked.length,icon:<Users className="w-5 h-5 text-blue-500"/>,bg:'bg-blue-50'},
          {label:'Avg Score',value:avgScore>0?(avgScore*100).toFixed(2)+'%':'N/A',icon:<BarChart2 className="w-5 h-5 text-purple-500"/>,bg:'bg-purple-50'},
          {label:'Perfect (100%)',value:ranked.filter(r=>(r.overall_score||0)>=0.9999).length,icon:<Award className="w-5 h-5 text-emerald-500"/>,bg:'bg-emerald-50'},
          {label:'At Risk (<97%)',value:ranked.filter(r=>(r.overall_score||0)<0.97).length,icon:<AlertCircle className="w-5 h-5 text-red-500"/>,bg:'bg-red-50'},
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={`${c.bg} p-2 rounded-lg`}>{c.icon}</div>
            <div><p className="text-xs text-gray-500">{c.label}</p><p className="text-lg font-bold text-gray-900">{c.value}</p></div>
          </div>
        ))}
      </div>

      {ranked.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="font-semibold text-gray-700 text-sm mb-1">Overall Score — {viewLabel}</h4>
          <p className="text-xs text-gray-400 mb-4">Sorted by overall score - 97% threshold line</p>
          <ResponsiveContainer width="100%" height={Math.max(180, ranked.length * 28)}>
            <BarChart data={ranked.map(r => ({ name: r.employee_name?.split(',')[0] || '', overall: r.overall_score ? parseFloat((r.overall_score*100).toFixed(2)) : 0, full: r.employee_name }))} layout="vertical" margin={{top:0,right:40,left:80,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0"/>
              <XAxis type="number" domain={[0,101]} tick={{fontSize:10}} tickFormatter={v=>v+'%'}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={75}/>
              <Tooltip formatter={(v:unknown) => typeof v==='number' ? v.toFixed(2)+'%' : String(v)} labelFormatter={(label:unknown) => String(label)}/>
              <ReferenceLine x={97} stroke="#fbbf24" strokeDasharray="4 4"/>
              <Bar dataKey="overall" radius={[0,4,4,0]}>
                {ranked.map((r) => (
                  <Cell key={r.id} fill={
                    (r.overall_score||0) >= 0.9999 ? '#10b981' :
                    (r.overall_score||0) >= 0.97 ? '#3b82f6' :
                    (r.overall_score||0) >= 0.94 ? '#f59e0b' : '#ef4444'
                  }/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3 text-xs text-gray-500 flex-wrap">
            {[['#10b981','100%'],['#3b82f6','97-99%'],['#f59e0b','94-96%'],['#ef4444','<94%']].map(([c,l])=>(
              <span key={l} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:c}}/>{l}</span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['#','Employee','Designation','Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 20%','Overall',...(userRole !== 'viewer' ? ['Notes',''] : [])].map(h => (
                <th key={h} className={`px-4 py-3 font-medium text-gray-600 ${['Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 20%','Overall'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ranked.length===0 && <tr><td colSpan={10} className="text-center py-12 text-gray-400">No records for active employees in this period.</td></tr>}
              {ranked.map((r,i) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-medium">{i+1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.designation}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.attendance)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.accuracy)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.efficiency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.feedback)}</td>
                  <td className="px-4 py-3 text-right"><span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${scoreBg(r.overall_score)}`}>{pct(r.overall_score)}</span></td>
                  {userRole !== 'viewer' && <td className="px-4 py-3 text-gray-500 text-xs max-w-xs"><ExpandableNote note={r.notes} /></td>}
                  {userRole !== 'viewer' && <td className="px-4 py-3">
                    {(perfView==='monthly'||perfView==='weekly') && <button onClick={() => setEditRecord(r)} className="text-gray-400 hover:text-blue-600 p-1 transition" title="Edit scores"><Edit2 className="w-4 h-4"/></button>}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// -- Team Dashboard ----------------------------------------------------------
function TeamDashboard({ records, employees, activeEmpIds, showToast }:
  { records: KpiRecord[], employees: Employee[], activeEmpIds: Set<string>, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selTeam, setSelTeam] = useState<string>('')
  const [selMonth, setSelMonth] = useState(MONTHS[new Date().getMonth()])
  const [selYear, setSelYear] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState(true)

  async function loadTeams() {
    setLoading(true)
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('teams').select('*, team_lead:employees(name)').order('name'),
      supabase.from('team_members').select('*, employee:employees(name, designation)')
    ])
    setTeams(t || []); setMembers(m || [])
    if (t && t.length > 0 && !selTeam) setSelTeam(t[0].id)
    setLoading(false)
  }

  useEffect(() => { loadTeams() }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/></div>
  if (teams.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <Users className="w-12 h-12 mx-auto mb-3 opacity-30"/>
      <p className="font-medium">No teams configured yet</p>
      <p className="text-sm mt-1">Go to the Teams tab to create teams and assign members</p>
    </div>
  )

  const selectedTeam = teams.find(t => t.id === selTeam)
  const teamMemberIds = members.filter(m => m.team_id === selTeam).map(m => m.employee_id)
  const activeTeamMemberIds = teamMemberIds.filter(id => activeEmpIds.has(id))
  const teamRecords = records.filter(r =>
    activeTeamMemberIds.includes(r.employee_id) &&
    (r.month_label||'').toLowerCase().includes(selMonth.toLowerCase()) &&
    (r.month_label||'').includes(selYear) &&
    r.overall_score !== null && (r.overall_score||0) > 0
  ).sort((a,b) => (b.overall_score||0)-(a.overall_score||0))
  const avgScore = teamRecords.length ? teamRecords.reduce((s,r) => s+(r.overall_score||0),0)/teamRecords.length : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-blue-900">Team View</h2><p className="text-sm text-gray-500">{teamRecords.length} active members with records</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={selTeam} onChange={e => setSelTeam(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{MONTHS.map(m => <option key={m}>{m}</option>)}</select>
          <select value={selYear} onChange={e => setSelYear(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{YEARS.map(y => <option key={y}>{y}</option>)}</select>
        </div>
      </div>
      {selectedTeam && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">{selectedTeam.name.charAt(0)}</div>
          <div><h3 className="font-bold text-gray-900">{selectedTeam.name}</h3><p className="text-sm text-gray-500">{selectedTeam.department}{selectedTeam.team_lead?.name ? ` - Lead: ${selectedTeam.team_lead.name.split(',')[0]}` : ''}</p><p className="text-xs text-gray-400">{activeTeamMemberIds.length} active members</p></div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {label:'Members',value:teamRecords.length,icon:<Users className="w-5 h-5 text-blue-500"/>,bg:'bg-blue-50'},
          {label:'Avg Score',value:avgScore>0?(avgScore*100).toFixed(2)+'%':'N/A',icon:<BarChart2 className="w-5 h-5 text-purple-500"/>,bg:'bg-purple-50'},
          {label:'Perfect (100%)',value:teamRecords.filter(r=>(r.overall_score||0)>=0.9999).length,icon:<Award className="w-5 h-5 text-emerald-500"/>,bg:'bg-emerald-50'},
          {label:'At Risk (<97%)',value:teamRecords.filter(r=>(r.overall_score||0)<0.97).length,icon:<AlertCircle className="w-5 h-5 text-red-500"/>,bg:'bg-red-50'},
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={`${c.bg} p-2 rounded-lg`}>{c.icon}</div>
            <div><p className="text-xs text-gray-500">{c.label}</p><p className="text-lg font-bold text-gray-900">{c.value}</p></div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['#','Employee','Designation','Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 20%','Overall','Notes'].map(h => (
                <th key={h} className={`px-4 py-3 font-medium text-gray-600 ${['Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 20%','Overall'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {teamRecords.length===0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No records for active members in this period.</td></tr>}
              {teamRecords.map((r,i) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-medium">{i+1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.designation}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.attendance)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.accuracy)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.efficiency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.feedback)}</td>
                  <td className="px-4 py-3 text-right"><span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${scoreBg(r.overall_score)}`}>{pct(r.overall_score)}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.notes?r.notes.substring(0,50)+'...':'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// -- Employee Dashboard ------------------------------------------------------
function EmployeeDashboard({ records, employees, activeEmpIds, selEmployee, setSelEmployee }:
  { records: KpiRecord[], employees: Employee[], activeEmpIds: Set<string>, selEmployee: string, setSelEmployee: (v: string) => void }) {
  const emp = employees.find(e => e.id === selEmployee)
  const empRecords = records.filter(r => r.employee_id === selEmployee && r.overall_score !== null && (r.overall_score||0) > 0).sort((a,b) => a.month_label.localeCompare(b.month_label))
  const chartData = empRecords.map(r => ({
    month: r.month_label.substring(0,10),
    score: r.overall_score ? parseFloat((r.overall_score*100).toFixed(2)) : 0,
    attendance: r.attendance ? parseFloat((r.attendance*100).toFixed(2)) : 0,
    accuracy: r.accuracy ? parseFloat((r.accuracy*100).toFixed(2)) : 0,
    efficiency: r.efficiency ? parseFloat((r.efficiency*100).toFixed(2)) : 0,
  }))
  const avgScore = empRecords.length ? empRecords.reduce((s,r) => s+(r.overall_score||0),0)/empRecords.length : 0
  const latest = empRecords[empRecords.length-1]
  const best = empRecords.reduce((b,r) => ((r.overall_score||0)>(b?.overall_score||0)?r:b), empRecords[0])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-blue-900">Employee Performance</h2><p className="text-sm text-gray-500">{empRecords.length} months tracked</p></div>
        <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 max-w-xs">
          {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      {emp && <>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">{emp.name.split(',')[0]?.charAt(0)||'?'}</div>
          <div><h3 className="font-bold text-gray-900">{emp.name}</h3><p className="text-sm text-gray-500">{emp.designation}</p></div>
          {latest && <div className="ml-auto text-right"><p className="text-xs text-gray-400">Latest</p><span className={`text-xl font-bold ${scoreColor(latest.overall_score)}`}>{pct(latest.overall_score)}</span><p className="text-xs text-gray-400">{latest.month_label}</p></div>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[{label:'Avg Score',value:avgScore>0?(avgScore*100).toFixed(2)+'%':'N/A'},{label:'Months Tracked',value:empRecords.length},{label:'Best Score',value:best?pct(best.overall_score):'N/A'},{label:'Perfect Months',value:empRecords.filter(r=>(r.overall_score||0)>=0.9999).length}].map(c => <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">{c.label}</p><p className="text-xl font-bold text-gray-900 mt-1">{c.value}</p></div>)}
        </div>
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-700 mb-1 text-sm">Performance Trend</h4>
            <p className="text-xs text-gray-400 mb-4">Attendance - Accuracy - Efficiency - Overall Score</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{top:5,right:10,left:-20,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="month" tick={{fontSize:10}}/>
                <YAxis domain={[0,101]} tick={{fontSize:10}} tickFormatter={v=>v+'%'}/>
                <Tooltip formatter={(v:unknown) => typeof v === 'number' ? v.toFixed(2) + '%' : String(v)} />
                <ReferenceLine y={97} stroke="#fbbf24" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={2} dot={{r:3,fill:'#10b981'}} name="Attendance"/>
                <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} dot={{r:3,fill:'#3b82f6'}} name="Accuracy"/>
                <Line type="monotone" dataKey="efficiency" stroke="#8b5cf6" strokeWidth={2} dot={{r:3,fill:'#8b5cf6'}} name="Efficiency"/>
                <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2.5} dot={{r:4,fill:'#f59e0b'}} name="Overall" strokeDasharray="5 2"/>
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-5 mt-3 text-xs text-gray-500 flex-wrap">
              {[['#10b981','Attendance'],['#3b82f6','Accuracy'],['#8b5cf6','Efficiency'],['#f59e0b','Overall (dashed)']].map(([c,l])=>(
                <span key={l} className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block rounded" style={{background:c}}/>{l}</span>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h4 className="font-semibold text-gray-700 text-sm">Monthly History</h4></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                {['Month','Designation','Attendance','Accuracy','Efficiency','Feedback','Overall','Notes'].map(h => (
                  <th key={h} className={`px-4 py-2.5 font-medium text-gray-500 ${['Attendance','Accuracy','Efficiency','Feedback','Overall'].includes(h)?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...empRecords].reverse().map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">{r.month_label}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.designation}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.attendance)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.accuracy)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.efficiency)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.feedback)}</td>
                    <td className="px-4 py-2.5 text-right"><span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${scoreBg(r.overall_score)}`}>{pct(r.overall_score)}</span></td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{r.notes?r.notes.substring(0,60)+'...':'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  )
}

// -- KPI Entry ---------------------------------------------------------------
function KPIEntry({ employees, records, onSaved, showToast, currentUser }:
  { employees: Employee[], records: KpiRecord[], onSaved: () => void, showToast: (m: string, t?: 'success'|'error') => void, currentUser: string }) {
  const [empId, setEmpId] = useState(employees.find(e=>e.active)?.id||'')
  const [monthLabel, setMonthLabel] = useState(`${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`)
  const [designation, setDesignation] = useState('')
  const [attendance, setAttendance] = useState('')
  const [accuracy, setAccuracy] = useState('')
  const [efficiency, setEfficiency] = useState('')
  const [feedback, setFeedback] = useState('')
  const [notes, setNotes] = useState('')
  const [coached, setCoached] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const selEmp = employees.find(e=>e.id===empId)

  useEffect(() => { if (selEmp) setDesignation(selEmp.designation) }, [empId])
  useEffect(() => {
    const existing = records.find(r=>r.employee_id===empId&&r.month_label===monthLabel)
    if (existing) {
      setEditId(existing.id); setAttendance(existing.attendance!==null?(existing.attendance*100).toFixed(2):''); setAccuracy(existing.accuracy!==null?(existing.accuracy*100).toFixed(2):''); setEfficiency(existing.efficiency!==null?(existing.efficiency*100).toFixed(2):''); setFeedback(existing.feedback!==null?(existing.feedback*100).toFixed(2):''); setNotes(existing.notes||''); setCoached(existing.coached||false); setDesignation(existing.designation||selEmp?.designation||'')
    } else { setEditId(null); setAttendance(''); setAccuracy(''); setEfficiency(''); setFeedback(''); setNotes(''); setCoached(false) }
  }, [empId, monthLabel])

  function calcOverall() { const a=parseFloat(attendance)/100,b=parseFloat(accuracy)/100,c=parseFloat(efficiency)/100,d=parseFloat(feedback)/100; if([a,b,c,d].some(isNaN))return null; return a*0.2+b*0.3+c*0.3+d*0.2 }
  const overall = calcOverall()
  const allMonths = ['2024','2025','2026','2027','2028','2029','2030'].flatMap(y => MONTHS.map(m => `${m} ${y}`))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { employee_id:empId, employee_name:selEmp?.name||'', designation:designation||selEmp?.designation||'', month_label:monthLabel, attendance:attendance!==''?parseFloat(attendance)/100:null, accuracy:accuracy!==''?parseFloat(accuracy)/100:null, efficiency:efficiency!==''?parseFloat(efficiency)/100:null, feedback:feedback!==''?parseFloat(feedback)/100:null, overall_score:overall, notes, coached, updated_at:new Date().toISOString() }
      const {error} = editId ? await supabase.from('kpi_records').update(payload).eq('id',editId) : await supabase.from('kpi_records').insert(payload)
      if (error) throw error
      await writeAuditLog(editId?'UPDATE_RECORD':'CREATE_RECORD', currentUser, selEmp?.name||'', monthLabel, 'All fields', '', `Overall: ${pct(overall)}`)
      onSaved()
    } catch (err:unknown) { showToast(err instanceof Error?err.message:'Save failed','error') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-blue-900">KPI Entry</h2><p className="text-sm text-gray-500">Enter or update monthly KPI scores</p></div>
      {editId && <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2"><Edit2 className="w-4 h-4"/>Editing existing record for {selEmp?.name}</div>}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Employee</label><select value={empId} onChange={e=>setEmpId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{employees.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Month</label><select value={monthLabel} onChange={e=>setMonthLabel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">{allMonths.map(m=><option key={m}>{m}</option>)}</select></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Designation</label><input value={designation} onChange={e=>setDesignation(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="e.g. FSCM, AR B2B"/></div>
        <div className="grid grid-cols-2 gap-4">
          {[{label:'Attendance',weight:'20%',val:attendance,set:setAttendance},{label:'Accuracy',weight:'30%',val:accuracy,set:setAccuracy},{label:'Efficiency',weight:'30%',val:efficiency,set:setEfficiency},{label:'Ext/Int Feedback',weight:'20%',val:feedback,set:setFeedback}].map(f=>(
            <div key={f.label}><label className="block text-sm font-medium text-gray-700 mb-1">{f.label} <span className="text-gray-400 font-normal text-xs">({f.weight})</span></label><div className="relative"><input type="number" min="0" max="100" step="0.01" value={f.val} onChange={e=>f.set(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-7 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="e.g. 100"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span></div></div>
          ))}
        </div>
        {overall!==null && <div className={`rounded-xl px-4 py-3 text-center ${scoreBg(overall)}`}><p className="text-xs font-medium opacity-70">Calculated Overall Score</p><p className="text-2xl font-bold">{pct(overall)}</p></div>}
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes / Client Feedback</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Client feedback, coaching notes..."/></div>
        <div className="flex items-center gap-2"><input type="checkbox" id="coached" checked={coached} onChange={e=>setCoached(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600"/><label htmlFor="coached" className="text-sm text-gray-700">Coaching session conducted this month</label></div>
        <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"><Save className="w-4 h-4"/>{saving?'Saving...':editId?'Update Record':'Save Record'}</button>
      </form>
    </div>
  )
}

// -- Employee Manager --------------------------------------------------------
function EmployeeManager({ employees, onChanged, showToast, currentUser }:
  { employees: Employee[], onChanged: () => void, showToast: (m: string, t?: 'success'|'error') => void, currentUser: string }) {
  const [newName, setNewName] = useState('')
  const [newDesig, setNewDesig] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [editName, setEditName] = useState('')
  const [editDesig, setEditDesig] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set())

  async function addEmployee() {
    if (!newName.trim()) return; setAdding(true)
    const {error} = await supabase.from('employees').insert({name:newName.trim(),designation:newDesig.trim(),email:newEmail.trim()||null,active:true})
    if (error) showToast(error.message,'error')
    else { await writeAuditLog('ADD_EMPLOYEE',currentUser,newName.trim(),'','Status','','Active'); setNewName(''); setNewDesig(''); setNewEmail(''); onChanged() }
    setAdding(false)
  }

  async function saveEdit(id: string) {
    const emp = employees.find(e=>e.id===id)
    const {error} = await supabase.from('employees').update({name:editName,designation:editDesig,email:editEmail||null}).eq('id',id)
    if (error) { showToast(error.message,'error'); return }
    // If email provided, upsert app_users so they can log in
    if (editEmail && editEmail.trim()) {
      const emailLower = editEmail.trim().toLowerCase()
      // Check if user already exists
      const {data: existingUser} = await supabase.from('app_users').select('id').eq('email', emailLower).single()
      if (!existingUser) {
        // Create new app_user with default password
        await supabase.from('app_users').insert({
          email: emailLower,
          name: editName,
          role: 'viewer',
          password_hash: 'changeme123'
        })
        showToast(`Login created for ${emailLower} — default password: changeme123`, 'success')
      } else {
        showToast(`Email updated — login already exists for ${emailLower}`, 'success')
      }
    }
    await writeAuditLog('EDIT_EMPLOYEE',currentUser,editName,'','Name/Designation',emp?.name||'',editName)
    setEditId(null); onChanged()
  }

  async function toggleActive(emp: Employee) {
    const {error} = await supabase.from('employees').update({active:!emp.active}).eq('id',emp.id)
    if (error) showToast(error.message,'error')
    else { await writeAuditLog('STATUS_CHANGE',currentUser,emp.name,'','Status',emp.active?'Active':'Inactive',emp.active?'Inactive':'Active'); onChanged() }
  }

  async function deleteEmployee(id: string) {
    if (!confirm('Delete this employee record and all their KPI records?')) return
    const emp = employees.find(e=>e.id===id)
    const {error} = await supabase.from('employees').delete().eq('id',id)
    if (error) showToast(error.message,'error')
    else { await writeAuditLog('DELETE_EMPLOYEE',currentUser,emp?.name||'','','','','Deleted'); showToast('Employee deleted'); onChanged() }
  }

  function toggleExpand(name: string) {
    setExpandedNames(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  // Group employees by name
  const filtered = employees.filter(e => {
    const matchSearch = !searchQ || e.name.toLowerCase().includes(searchQ.toLowerCase()) || e.designation.toLowerCase().includes(searchQ.toLowerCase())
    const matchActive = showInactive ? true : e.active
    return matchSearch && matchActive
  })

  // Build grouped structure
  const grouped: Map<string, Employee[]> = new Map()
  filtered.forEach(e => {
    if (!grouped.has(e.name)) grouped.set(e.name, [])
    grouped.get(e.name)!.push(e)
  })
  const groupEntries = Array.from(grouped.entries()).sort(([a],[b]) => a.localeCompare(b))

  const uniquePeople = new Set(employees.map(e => e.name)).size
  const activeCount = employees.filter(e=>e.active).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Employee Management</h2>
          <p className="text-sm text-gray-500">{uniquePeople} people - {activeCount} active records</p>
        </div>
        <button onClick={()=>setShowInactive(!showInactive)} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${showInactive?'bg-gray-800 text-white border-gray-800':'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{showInactive?'Hide Inactive':'Show Inactive'}</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500"/>Add Employee / Role</h3>
        <div className="flex gap-3 flex-col sm:flex-row">
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Full name (Last, First)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <input value={newDesig} onChange={e=>setNewDesig(e.target.value)} placeholder="Designation / Project" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="email@ab-businesssupport.com" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <button onClick={addEmployee} disabled={adding||!newName.trim()} className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"><PlusCircle className="w-4 h-4"/>Add</button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Email links this employee to their app login. Same person with multiple projects = add again with different designation.</p>
      </div>

      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search by name or designation..." className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/></div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {groupEntries.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No employees found.</div>}
        {groupEntries.map(([name, emps], gi) => {
          const isMulti = emps.length > 1
          const isExpanded = expandedNames.has(name) || emps.length === 1
          const allActive = emps.every(e => e.active)
          const someActive = emps.some(e => e.active)
          const initial = name.split(',')[0]?.charAt(0) || '?'

          return (
            <div key={name} className={gi > 0 ? 'border-t border-gray-200' : ''}>
              {/* Group header row */}
              <div className={`flex items-center gap-3 px-4 py-3 ${isMulti ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'}`} onClick={() => isMulti && toggleExpand(name)}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white ${someActive ? avatarColor(name) : 'bg-gray-200'}`}>{initial}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${someActive ? 'text-gray-900' : 'text-gray-400'}`}>{name}</p>
                  {!isExpanded && isMulti && (
                    <p className="text-xs text-gray-500">{emps.map(e=>e.designation).join(' - ')}</p>
                  )}
                  {!isMulti && <p className="text-xs text-gray-500">{emps[0].designation}</p>}
                </div>
                {isMulti && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{emps.length} roles</span>
                )}
                {!isMulti && (
                  <>
                    {editId === emps[0].id ? (
                      <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                        <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-40 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"/>
                        <input value={editDesig} onChange={e=>setEditDesig(e.target.value)} className="w-32 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"/>
                        <button onClick={()=>saveEdit(emps[0].id)} className="text-emerald-600 hover:text-emerald-700 p-1"><Save className="w-4 h-4"/></button>
                        <button onClick={()=>setEditId(null)} className="text-gray-400 p-1"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>toggleActive(emps[0])} className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer ${emps[0].active?'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600':'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>{emps[0].active?'Active':'Inactive'}</button>
                        <button onClick={()=>{setEditId(emps[0].id);setEditName(emps[0].name);setEditDesig(emps[0].designation);setEditEmail(emps[0].email||'')}} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={()=>deleteEmployee(emps[0].id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    )}
                  </>
                )}
                {isMulti && (
                  <span className="text-gray-400 ml-1">{isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</span>
                )}
              </div>

              {/* Expanded sub-rows for multi-role employees */}
              {isExpanded && isMulti && emps.map((emp, ei) => (
                <div key={emp.id} className="flex items-center gap-3 pl-14 pr-4 py-2.5 border-t border-gray-100 bg-gray-50/50 hover:bg-gray-50">
                  <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                    <span className="text-gray-300 text-lg leading-none">{ei === emps.length-1 ? '+' : '├'}</span>
                  </div>
                  {editId === emp.id ? (
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-36 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" placeholder="Name"/>
                      <input value={editDesig} onChange={e=>setEditDesig(e.target.value)} className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" placeholder="Designation"/>
                      <input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" placeholder="email@ab-businesssupport.com"/>
                      <button onClick={()=>saveEdit(emp.id)} className="text-emerald-600 hover:text-emerald-700 p-1"><Save className="w-4 h-4"/></button>
                      <button onClick={()=>setEditId(null)} className="text-gray-400 p-1"><X className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${emp.active ? 'text-gray-700' : 'text-gray-400'}`}>{emp.designation}</span>
                      </div>
                      <button onClick={()=>toggleActive(emp)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex-shrink-0 ${emp.active?'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600':'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>{emp.active?'Active':'Inactive'}</button>
                      <button onClick={()=>{setEditId(emp.id);setEditName(emp.name);setEditDesig(emp.designation);setEditEmail(emp.email||'')}} className="text-gray-400 hover:text-blue-600 p-1"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={()=>deleteEmployee(emp.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// -- Team Manager ------------------------------------------------------------
function TeamManager({ employees, showToast }:
  { employees: Employee[], showToast: (m: string, t?: 'success'|'error') => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newLeadId, setNewLeadId] = useState('')
  const [selTeam, setSelTeam] = useState<string|null>(null)
  const [addMemberId, setAddMemberId] = useState('')

  async function loadTeams() {
    setLoading(true)
    const [{data:t},{data:m}] = await Promise.all([supabase.from('teams').select('*, team_lead:employees(name)').order('name'),supabase.from('team_members').select('*, employee:employees(name, designation)')])
    setTeams(t||[]); setMembers(m||[]); setLoading(false)
  }
  useEffect(()=>{loadTeams()},[])

  async function createTeam() {
    if (!newTeamName.trim()) return
    const {error} = await supabase.from('teams').insert({name:newTeamName.trim(),department:newDept.trim(),team_lead_id:newLeadId||null,active:true})
    if (error) showToast(error.message,'error')
    else { setNewTeamName(''); setNewDept(''); setNewLeadId(''); loadTeams(); showToast('Team created!') }
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team?')) return
    await supabase.from('teams').delete().eq('id',id); setSelTeam(null); loadTeams(); showToast('Team deleted')
  }

  async function addMember() {
    if (!selTeam||!addMemberId) return
    const {error} = await supabase.from('team_members').insert({team_id:selTeam,employee_id:addMemberId})
    if (error) showToast('Member already in team','error')
    else { setAddMemberId(''); loadTeams(); showToast('Member added!') }
  }

  async function removeMember(id: string) { await supabase.from('team_members').delete().eq('id',id); loadTeams() }
  async function updateLead(teamId: string, leadId: string) { await supabase.from('teams').update({team_lead_id:leadId||null}).eq('id',teamId); loadTeams() }

  const teamMembers = members.filter(m=>m.team_id===selTeam)
  const teamMemberIds = teamMembers.map(m=>m.employee_id)
  const availableToAdd = employees.filter(e=>e.active&&!teamMemberIds.includes(e.id))
  const selectedTeam = teams.find(t=>t.id===selTeam)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-blue-900">Team Management</h2><p className="text-sm text-gray-500">{teams.length} teams configured</p></div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><PlusCircle className="w-4 h-4 text-blue-500"/>Create New Team</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Team name" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <input value={newDept} onChange={e=>setNewDept(e.target.value)} placeholder="Department" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <select value={newLeadId} onChange={e=>setNewLeadId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"><option value="">Select team lead...</option>{employees.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <button onClick={createTeam} disabled={!newTeamName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"><PlusCircle className="w-4 h-4"/>Create</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50"><h3 className="font-semibold text-gray-700 text-sm">All Teams</h3></div>
          {loading?<div className="p-8 text-center text-gray-400">Loading...</div>:teams.length===0?<div className="p-8 text-center text-gray-400 text-sm">No teams yet.</div>:teams.map((team,i)=>(
            <div key={team.id} onClick={()=>setSelTeam(team.id)} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${i>0?'border-t border-gray-100':''} ${selTeam===team.id?'bg-blue-50':'hover:bg-gray-50'}`}>
              <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 text-sm">{team.name}</p><p className="text-xs text-gray-500">{team.department}{team.team_lead?.name?` - Lead: ${team.team_lead.name.split(',')[0]}`:' - No lead'}</p><p className="text-xs text-gray-400">{members.filter(m=>m.team_id===team.id).length} members</p></div>
              <button onClick={e=>{e.stopPropagation();deleteTeam(team.id)}} className="text-gray-400 hover:text-red-600 p-1 transition"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {!selTeam?<div className="p-8 text-center text-gray-400 text-sm">Select a team to manage members</div>:(
            <>
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700 text-sm">{selectedTeam?.name} — Members</h3>
                <div className="mt-2 flex items-center gap-2"><span className="text-xs text-gray-500">Team Lead:</span><select value={selectedTeam?.team_lead_id||''} onChange={e=>updateLead(selTeam,e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs text-gray-900"><option value="">No lead assigned</option>{employees.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name.split(',')[0]}</option>)}</select></div>
              </div>
              <div className="p-4 border-b border-gray-100">
                <div className="flex gap-2"><select value={addMemberId} onChange={e=>setAddMemberId(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"><option value="">Add member...</option>{availableToAdd.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><button onClick={addMember} disabled={!addMemberId} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">Add</button></div>
              </div>
              <div>
                {teamMembers.length===0?<div className="p-6 text-center text-gray-400 text-sm">No members yet</div>:teamMembers.map((m,i)=>(
                  <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 ${i>0?'border-t border-gray-100':''}`}>
                    <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{m.employee?.name?.split(',')[0]?.charAt(0)||'?'}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{m.employee?.name}</p><p className="text-xs text-gray-500">{m.employee?.designation}</p></div>
                    <button onClick={()=>removeMember(m.id)} className="text-gray-400 hover:text-red-600 p-1 transition"><X className="w-3.5 h-3.5"/></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


// -- User Manager ------------------------------------------------------------
function UserManager({ showToast, currentUserRole, currentUser }: { showToast: (m: string, t?: 'success'|'error') => void, currentUserRole: string, currentUser: string | null }) {
  const [appUsers, setAppUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newUser, setNewUser] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [saving, setSaving] = useState(false)
  const [resetUserId, setResetUserId] = useState<string|null>(null)
  const [resetPass, setResetPass] = useState('')
  const [resetting, setResetting] = useState(false)

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('app_users').select('id,username,role,active,created_at').order('created_at')
    setAppUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newUser.trim() || !newPass.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/auth/add-user', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: newUser.trim(), password: newPass, role: newRole }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      showToast(`User "${newUser}" added successfully!`)
      // Send email notification to managers and team leads
      fetch('/api/notify/user-added', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ newUsername: newUser.trim(), newRole, addedBy: currentUser || 'admin' }) }).catch(() => {})
      setNewUser(''); setNewPass(''); setNewRole('viewer')
      loadUsers()
    } catch(err:unknown) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
    setSaving(false)
  }

  async function resetPassword(userId: string, username: string) {
    if (!resetPass.trim()) return
    setResetting(true)
    try {
      const res = await fetch('/api/auth/change-password', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, newPassword: resetPass, adminReset: true }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      showToast(`Password for "${username}" updated!`)
      setResetUserId(null); setResetPass('')
    } catch(err:unknown) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
    setResetting(false)
  }

  async function toggleUserActive(u: any) {
    await supabase.from('app_users').update({ active: !u.active }).eq('id', u.id)
    loadUsers()
  }

  async function deleteUser(u: any) {
    if (!confirm(`Delete user "${u.username}"?`)) return
    await supabase.from('app_users').delete().eq('id', u.id)
    showToast('User deleted'); loadUsers()
  }

  const roleColors: Record<string,string> = { super_admin: 'bg-purple-50 text-purple-700', admin: 'bg-blue-50 text-blue-700', team_lead: 'bg-emerald-50 text-emerald-700', viewer: 'bg-gray-100 text-gray-600' }
  const roleLabels: Record<string,string> = { super_admin: 'Super Admin', admin: 'Manager', team_lead: 'Team Lead', viewer: 'Viewer' }

  return (
    <div className="space-y-5">
      {/* Add user form - only super_admin and admin */}
      {(currentUserRole === 'super_admin' || currentUserRole === 'admin') && <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add New User</p>
        <form onSubmit={addUser} className="flex flex-col sm:flex-row gap-3">
          <input type="email" value={newUser} onChange={e=>setNewUser(e.target.value)} placeholder="email@ab-businesssupport.com" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Password (min 6 chars)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
            {currentUserRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
            {(currentUserRole === 'super_admin' || currentUserRole === 'admin') && <option value="admin">Admin / Manager</option>}
            <option value="team_lead">Team Lead</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" disabled={saving||!newUser.trim()||!newPass.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 whitespace-nowrap flex items-center gap-2"><UserPlus className="w-4 h-4"/>Add User</button>
        </form>
      </div>}

      {/* Users list */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Current Users</p>
        {loading ? <div className="text-center py-6 text-gray-400">Loading...</div> : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {appUsers.map((u, i) => (
              <div key={u.id} className={`${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar username={u.username} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${u.active ? 'text-gray-900' : 'text-gray-400'}`}>{u.username}</p>
                    <p className="text-xs text-gray-400">Added {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role]||'bg-gray-100 text-gray-600'}`}>{roleLabels[u.role]||u.role}</span>
                  <button onClick={() => toggleUserActive(u)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${u.active ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600' : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>{u.active ? 'Active' : 'Inactive'}</button>
                  {(currentUserRole === 'super_admin' || (currentUserRole === 'admin' && u.role !== 'super_admin' && u.role !== 'admin')) && (
                    <button onClick={() => { setResetUserId(resetUserId === u.id ? null : u.id); setResetPass('') }} className="text-gray-400 hover:text-orange-500 p-1 transition" title="Reset password"><Key className="w-4 h-4"/></button>
                  )}
                  {currentUserRole === 'super_admin' && (
                    <button onClick={() => deleteUser(u)} className="text-gray-400 hover:text-red-600 p-1 transition"><Trash2 className="w-4 h-4"/></button>
                  )}
                </div>

                {resetUserId === u.id && (
                  <div className="px-4 pb-3 flex gap-2 bg-orange-50 border-t border-orange-100">
                    <input type="password" value={resetPass} onChange={e=>setResetPass(e.target.value)} placeholder="New password" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 mt-2" />
                    <button onClick={() => resetPassword(u.id, u.username)} disabled={resetting||!resetPass.trim()} className="mt-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 whitespace-nowrap">Reset</button>
                  </div>
                )}
              </div>
            ))}
            {appUsers.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No users found.</div>}
          </div>
        )}
      </div>
    </div>
  )
}




// -- Directory Links ---------------------------------------------------------
function DirectoryLinks() {
  const links = [
    { name: 'ClockSmart', url: 'https://eportal.clocksmart.ph/', description: 'Employee time tracking portal', icon: '🕐', color: 'border-blue-400' },
  ]
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-blue-900">Directory & Links</h2>
        <p className="text-sm text-gray-500">Quick access to company tools and resources</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map(link => (
          <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
            className={`bg-white rounded-xl border-l-4 ${link.color} border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group`}>
            <div className="flex items-start gap-4">
              <span className="text-3xl">{link.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 group-hover:text-blue-900 transition-colors">{link.name}</p>
                <p className="text-xs text-gray-500 mt-1">{link.description}</p>
                <p className="text-xs text-blue-500 mt-2 truncate">{link.url}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// -- Coming Soon -------------------------------------------------------------
function ComingSoon({ title, description, icon }: { title: string, description: string, icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-2xl font-bold text-blue-900 mb-2">{title}</h2>
      <p className="text-gray-500 max-w-md">{description}</p>
      <div className="mt-6 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">Coming in next session 🚀</div>
    </div>
  )
}

// -- Observations Panel ------------------------------------------------------
function ObservationsPanel({ employees, currentUser, showToast }:
  { employees: Employee[], currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [obs, setObs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selEmp, setSelEmp] = useState<string>('')
  const [selMonth, setSelMonth] = useState<string>('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterEmp, setFilterEmp] = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')

  const allMonths = ['2024','2025','2026','2027'].flatMap(y => MONTHS.map(m => `${m} ${y}`))

  useEffect(() => {
    if (employees.length > 0 && !selEmp) setSelEmp(employees[0].id)
  }, [employees])

  async function loadObs() {
    setLoading(true)
    let q = supabase.from('observations').select('*').order('created_at', { ascending: false }).limit(200)
    if (filterEmp !== 'all') q = q.eq('employee_id', filterEmp)
    if (filterMonth !== 'all') q = q.eq('month_label', filterMonth)
    const { data } = await q
    setObs(data || [])
    setLoading(false)
  }

  useEffect(() => { loadObs() }, [filterEmp, filterMonth])

  async function saveObs(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selEmp || !selMonth) return
    setSaving(true)
    const emp = employees.find(e => e.id === selEmp)
    const { error } = await supabase.from('observations').insert({
      employee_id: selEmp,
      employee_name: emp?.name || '',
      month_label: selMonth,
      observation: text.trim(),
      observed_by: currentUser || 'unknown',
    })
    if (error) showToast(error.message, 'error')
    else { showToast('Observation saved!'); setText(''); loadObs() }
    setSaving(false)
  }

  async function deleteObs(id: string) {
    if (!confirm('Delete this observation?')) return
    await supabase.from('observations').delete().eq('id', id)
    loadObs()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-blue-900">Observations</h2>
        <p className="text-sm text-gray-500">Record and track monthly observations per employee</p>
      </div>

      {/* Add observation form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4">Add Observation</h3>
        <form onSubmit={saveObs} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
              <select value={selEmp} onChange={e => setSelEmp(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
              <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                <option value="">Select month...</option>
                {allMonths.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observation</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="e.g. Consistently meets deadlines, needs improvement on accuracy..." />
          </div>
          <button type="submit" disabled={saving || !text.trim() || !selMonth}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2">
            <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Observation'}
          </button>
        </form>
      </div>

      {/* Filter + log */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-700 text-sm">Observations Log</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
              <option value="all">All Employees</option>
              {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name.split(',')[0]} — {e.designation}</option>)}
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
              <option value="all">All Months</option>
              {allMonths.map(m => <option key={m}>{m}</option>)}
            </select>
            <button onClick={loadObs} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Refresh</button>
          </div>
        </div>
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : (
          <div className="divide-y divide-gray-100">
            {obs.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No observations found.</div>}
            {obs.map(o => (
              <div key={o.id} className="px-4 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-semibold text-gray-900 text-sm">{o.employee_name}</span>
                      {o.month_label && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{o.month_label}</span>}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">by {o.observed_by}</span>
                      <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{o.observation}</p>
                  </div>
                  <button onClick={() => deleteObs(o.id)} className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0 transition"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


// -- Profile Picture Upload --------------------------------------------------
function ProfilePictureUpload({ currentUser, showToast }: { currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    supabase.from('app_users').select('avatar_url').eq('username', currentUser).single()
      .then(({data}) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url) })
  }, [currentUser])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${currentUser}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()
      await supabase.from('app_users').update({ avatar_url: publicUrl }).eq('username', currentUser)
      setAvatarUrl(publicUrl)
      showToast('Profile picture updated!')
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Upload failed', 'error') }
    setUploading(false)
  }

  async function removeAvatar() {
    if (!currentUser) return
    await supabase.from('app_users').update({ avatar_url: null }).eq('username', currentUser)
    setAvatarUrl(null)
    showToast('Profile picture removed')
  }

  return (
    <div className="flex items-center gap-5">
      <div className="flex-shrink-0">
        {avatarUrl
          ? <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover ring-4 ring-blue-100"/>
          : <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold ring-4 ring-blue-100 ${avatarColor(currentUser||'')}`}>{currentUser?.charAt(0).toUpperCase()}</div>
        }
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">{currentUser}</p>
        <label className={`cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <PlusCircle className="w-4 h-4"/>
          {uploading ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading}/>
        </label>
        {avatarUrl && (
          <button onClick={removeAvatar} className="block text-xs text-red-500 hover:text-red-700">Remove photo</button>
        )}
        <p className="text-xs text-gray-400">JPG, PNG or GIF - Max 2MB</p>
      </div>
    </div>
  )
}

// -- Settings Panel ----------------------------------------------------------
function SettingsPanel({ currentUser, userRole, showToast }: { currentUser: string|null, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [activeTab, setActiveTab] = useState<'users'|'activity'|'password'>(userRole === 'viewer' ? 'password' : 'users')
  const [oldPassword, setOldPassword] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)

  async function loadActivityLog() {
    setLoadingLog(true)
    const {data} = await supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(100)
    setActivityLog(data||[]); setLoadingLog(false)
  }

  useEffect(()=>{ if(activeTab==='activity') loadActivityLog() },[activeTab])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass!==confirmPass) { showToast('Passwords do not match','error'); return }
    if (newPass.length<6) { showToast('Password must be at least 6 characters','error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser,oldPassword,newPassword:newPass})})
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('Password changed!'); setOldPassword(''); setNewPass(''); setConfirmPass('')
    } catch(err:unknown) { showToast(err instanceof Error?err.message:'Failed','error') }
    setSaving(false)
  }

  const actionColors: Record<string,string> = { EDIT_SCORE:'bg-blue-50 text-blue-700', STATUS_CHANGE:'bg-yellow-50 text-yellow-700', ADD_EMPLOYEE:'bg-emerald-50 text-emerald-700', DELETE_EMPLOYEE:'bg-red-50 text-red-700', CREATE_RECORD:'bg-purple-50 text-purple-700', UPDATE_RECORD:'bg-indigo-50 text-indigo-700', EDIT_EMPLOYEE:'bg-gray-100 text-gray-600' }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-blue-900">Settings</h2><p className="text-sm text-gray-500">Manage app users, activity, and security</p></div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['users','App Users'],['activity','Audit Log'],['password','Change Password']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab===t?'bg-white shadow text-blue-900':'text-gray-600 hover:text-gray-900'}`}>{l}</button>
        ))}
      </div>
      {activeTab==='users' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500"/>App User Management</h3>
            <UserManager showToast={showToast} currentUserRole={userRole} currentUser={currentUser} />
          </div>

        </div>
      )}
      {activeTab==='activity' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">Audit Log</h3>
            <button onClick={loadActivityLog} className="text-xs text-blue-600 hover:text-blue-700">Refresh</button>
          </div>
          {loadingLog?<div className="p-8 text-center text-gray-400">Loading...</div>:(
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">By</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Employee</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Field</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Old Value</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">New Value</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">When</th>
                </tr></thead>
                <tbody>
                  {activityLog.map((r,i)=>(
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[r.action]||'bg-gray-100 text-gray-600'}`}>{r.action}</span></td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium">{r.performed_by}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.employee_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.field_changed}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{r.old_value||'—'}</td>
                      <td className="px-4 py-2.5 text-gray-700 text-xs font-medium">{r.new_value||'—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activityLog.length===0&&<tr><td colSpan={7} className="text-center py-8 text-gray-400">No audit entries yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {activeTab==='password' && (
        <div className="space-y-6 max-w-md">
          {/* Profile picture */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500"/>Profile Picture</h3>
            <ProfilePictureUpload currentUser={currentUser} showToast={showToast} />
          </div>
          {/* Change password */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><Key className="w-4 h-4 text-blue-500"/>Change Your Password</h3>
            <form onSubmit={changePassword} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Current password</label><input type="password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">New password</label><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label><input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/></div>
              <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"><Save className="w-4 h-4"/>{saving?'Saving...':'Change Password'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { supabase, Employee, KpiRecord } from '@/lib/supabase'
import { LineChart, BarChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Bell, Gamepad2, Users, BarChart2, PlusCircle, LogOut, Search, Edit2, Trash2, Save, X, CheckCircle, AlertCircle, TrendingUp, Award, UserPlus, Menu, ChevronDown, ChevronUp, FileText, Shield, Key, FileSpreadsheet, Star, Clock, Upload } from 'lucide-react'

type View = 'announcements' | 'gaming-hub' | 'cadence' | 'links' | 'resources' | 'dashboard-month' | 'dashboard-employee' | 'dashboard-team' | 'entry' | 'employees' | 'teams' | 'observations' | 'org-chart' | 'tickets' | 'tasks' | 'bcp' | 'tl-tools' | 'directory' | 'settings' | 'matrix' | 'hris-referral' | 'hris-records' | 'hris-invoice' | 'hris-timetracker' | 'tl-scorecard'

// Shared department list — used by Employees (tagging), Tickets (routing), Settings (contacts)
const DEPARTMENTS = ['Payroll', 'IT', 'Operations', 'Management', 'HR', 'Admin', 'Logistics']
const DEPT_BADGE_COLORS: Record<string, string> = { Payroll: 'bg-emerald-50 text-emerald-700 border-emerald-200', IT: 'bg-sky-50 text-sky-700 border-sky-200', Operations: 'bg-indigo-50 text-indigo-700 border-indigo-200', Management: 'bg-rose-50 text-rose-700 border-rose-200', HR: 'bg-violet-50 text-violet-700 border-violet-200', Admin: 'bg-slate-50 text-slate-700 border-slate-200', Logistics: 'bg-orange-50 text-orange-700 border-orange-200' }

// Employment Type — used by Employees (classification) and Org Chart (hierarchy/labeling)
const EMPLOYMENT_TYPES = ['Manager', 'Team Lead', 'Agent', 'Contractor', 'Intern', 'Probationary']
const EMPLOYMENT_TYPE_COLORS: Record<string, string> = { Manager: 'bg-rose-100 text-rose-700', 'Team Lead': 'bg-indigo-100 text-indigo-700', Agent: 'bg-blue-100 text-blue-700', Contractor: 'bg-amber-100 text-amber-700', Intern: 'bg-teal-100 text-teal-700', Probationary: 'bg-gray-200 text-gray-700' }

// Client support — used by Employees to tag which client account a role serves
const CLIENTS = ['EMMA', 'AB BSS', 'Harlan + Holden']
const CLIENT_COLORS: Record<string, string> = { EMMA: 'bg-fuchsia-100 text-fuchsia-700', 'AB BSS': 'bg-cyan-100 text-cyan-700', 'Harlan + Holden': 'bg-lime-100 text-lime-700' }

// User access roles — shown throughout the app (sidebar, Settings, banners).
// Underlying role keys (super_admin/admin/team_lead/viewer) are unchanged in the DB.
const ROLE_LABELS: Record<string, string> = { super_admin: 'Super Admin', admin: 'Manager', team_lead: 'Team Lead', viewer: 'Agent' }

// -- Centralized permission helpers --------------------------------------
// Single source of truth for "who can do what" across the app.
// Role hierarchy: super_admin > admin (Manager) > team_lead > viewer (Agent)
const canEditEmployees = (role: string) => role === 'super_admin' || role === 'admin'
const canManageTeams = (role: string) => role === 'super_admin' || role === 'admin'
const canViewAllObservations = (role: string) => role === 'super_admin' || role === 'admin'
const canViewTeamObservations = (role: string) => role === 'super_admin' || role === 'admin' || role === 'Team Lead'
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

// Auto-generates the internal designation/project tag from Role + Client.
// Designation still exists in the data model (KPI records, multi-role grouping,
// Org Chart, Teams dropdowns all key off it) but is no longer manually typed —
// it's derived so it always stays in sync with Role/Client.
// If a person already has another role with the same Role+Client combo,
// appends "(2)", "(3)", etc. so multi-role rows stay distinguishable.
function generateDesignation(empType: string, client: string, existingForPerson: Employee[], excludeId?: string): string {
  const base = `${empType}_${client}`
  const siblings = existingForPerson.filter(e => e.id !== excludeId)
  const taken = new Set(siblings.map(e => e.designation))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} (${n})`)) n++
  return `${base} (${n})`
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
function avgOf(recs: KpiRecord[], field: 'attendance'|'accuracy'|'efficiency'|'feedback'|'compliance_score'): number {
  const vals = recs.map(r => r[field]).filter((v): v is number => v !== null)
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0
}

type ComplianceBreakdown = {
  rate: number | null // null = no items required ack yet this month (no data)
  coachTotal: number
  coachAcked: number
  annTotal: number
  annAcked: number
  taskTotal: number
  taskDone: number
  totalRequired: number
  totalAcked: number
}

// Auto-calculates compliance = (coaching acks + announcement acks + tasks completed) / (total required)
// for a given employee + month. Returns rate: null when there's simply nothing to
// acknowledge/complete yet that month (e.g. rollout hasn't started) so callers can fall back
// to a manual value instead of showing a misleading 0%.
async function getComplianceBreakdown(employeeEmail: string | null | undefined, monthLabel: string): Promise<ComplianceBreakdown> {
  const empty: ComplianceBreakdown = { rate: null, coachTotal: 0, coachAcked: 0, annTotal: 0, annAcked: 0, taskTotal: 0, taskDone: 0, totalRequired: 0, totalAcked: 0 }
  if (!employeeEmail) return empty
  const mIdx = monthIndex(monthLabel), yr = yearOf(monthLabel)
  if (mIdx < 0 || !yr) return empty
  const start = new Date(yr, mIdx, 1).toISOString().slice(0, 10)
  const end = new Date(yr, mIdx + 1, 1).toISOString().slice(0, 10)

  const { data: coaching } = await supabase.from('coaching_logs')
    .select('agent_acknowledged')
    .eq('employee_email', employeeEmail)
    .eq('requires_acknowledgment', true)
    .eq('status', 'Final')
    .gte('date', start).lt('date', end)

  const { data: anns } = await supabase.from('announcements')
    .select('id')
    .gte('created_at', start).lt('created_at', end)

  const annIds = (anns || []).map(a => a.id)
  let annAcked = 0
  if (annIds.length) {
    const { data: acks } = await supabase.from('announcement_acknowledgements')
      .select('announcement_id').eq('user_email', employeeEmail).in('announcement_id', annIds)
    annAcked = (acks || []).length
  }

  const { data: taskData } = await supabase.from('tasks')
    .select('is_done')
    .eq('assigned_to', employeeEmail.toLowerCase())
    .gte('created_at', start).lt('created_at', end)

  const coachTotal = (coaching || []).length
  const coachAcked = (coaching || []).filter(c => c.agent_acknowledged).length
  const taskTotal = (taskData || []).length
  const taskDone = (taskData || []).filter(t => t.is_done).length
  const totalRequired = coachTotal + annIds.length + taskTotal
  const totalAcked = coachAcked + annAcked + taskDone
  return {
    rate: totalRequired > 0 ? totalAcked / totalRequired : null,
    coachTotal, coachAcked, annTotal: annIds.length, annAcked, taskTotal, taskDone, totalRequired, totalAcked
  }
}

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
  const canUpload = ['super_admin','admin','Team Lead'].includes(userRole)

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
  const canPost = ['super_admin','admin','Team Lead'].includes(userRole)
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
    const { error } = await supabase.from('announcement_acknowledgements').insert({ announcement_id: id, user_email: userEmail })
    if (error) { showToast('Failed to acknowledge: ' + error.message, 'error'); return }
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
  const [bgUrl, setBgUrl] = useState<string|null|undefined>(undefined)
  const [editingBg, setEditingBg] = useState(false)
  const canChangeBg = ['super_admin','admin','Team Lead'].includes(userRole)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key','announcement_bg').single()
      .then(({ data }) => {
        setBgUrl(data?.value || null)
      })
  }, [])

  const [editingAnnouncement, setEditingAnnouncement] = useState<any|null>(null)
  const [editForm, setEditForm] = useState({ title: '', body: '', tag: 'Info' })
  const [saving, setSaving] = useState(false)

  function openEdit(a: any) {
    setEditingAnnouncement(a)
    setEditForm({ title: a.title, body: a.body, tag: a.tag || 'Info' })
  }

  async function saveEdit() {
    if (!editingAnnouncement) return
    if (!editForm.title.trim() || !editForm.body.trim()) return
    setSaving(true)
    const { error } = await supabase.from('announcements').update({
      title: editForm.title.trim(),
      body: editForm.body.trim(),
      tag: editForm.tag,
      updated_at: new Date().toISOString()
    }).eq('id', editingAnnouncement.id)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Announcement updated!', 'success')
      setEditingAnnouncement(null)
      loadAnnouncements()
    }
    setSaving(false)
  }

  const [bgUploading, setBgUploading] = useState(false)
  const bgFileRef = useRef<HTMLInputElement>(null)

  async function uploadBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBgUploading(true)
    const path = `themes/bg-${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setBgUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    await supabase.from('app_settings').upsert({ key: 'announcement_bg', value: urlData.publicUrl }, { onConflict: 'key' })
    setBgUrl(urlData.publicUrl)
    setEditingBg(false)
    setBgUploading(false)
    showToast('Background updated!', 'success')
    if (bgFileRef.current) bgFileRef.current.value = ''
  }

  // Group announcements by month
  const grouped: Record<string, any[]> = {}
  announcements.forEach(a => {
    const key = new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
  })
  const monthKeys = Object.keys(grouped)
  // Current month is expanded by default, others collapsed
  const currentMonthKey = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{height:"100%"}}>
      {/* Full-bleed background */}
      {bgUrl !== undefined && bgUrl && (
        <div className="absolute inset-0 z-0">
          <img src={bgUrl} alt="bg" className="w-full h-full object-cover" style={{filter:'blur(0px) brightness(0.60)'}} onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
          <div className="absolute inset-0 bg-blue-950/20" />
        </div>
      )}
      {/* Scrollable content layer */}
      <div className={`relative z-10 h-full overflow-y-auto ${bgUrl ? "p-5" : ""}`}>
      <div className="space-y-3">

      {editingBg && canChangeBg && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Monthly Theme Photo</p>
            <button onClick={() => setEditingBg(false)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
          </div>
          <p className="text-xs text-gray-500">Upload a photo from your device to set this month's announcement background</p>
          <button onClick={() => bgFileRef.current?.click()} disabled={bgUploading} className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg py-4 text-sm text-gray-500 hover:text-blue-600 transition disabled:opacity-50">
            {bgUploading ? '⏳ Uploading...' : '📤 Choose photo from device'}
          </button>
          <input ref={bgFileRef} type="file" accept="image/*" onChange={uploadBgFile} className="hidden" />
          {bgUrl && (
            <button onClick={async () => { await supabase.from('app_settings').upsert({ key:'announcement_bg', value:'' }, { onConflict:'key' }); setBgUrl(null); setEditingBg(false); showToast('Background removed','success') }} className="text-xs text-red-500 hover:text-red-700 transition">
              Remove current background
            </button>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-base">Edit Announcement</h3>
              <button onClick={() => setEditingAnnouncement(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <input value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} placeholder="Title..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
            <textarea value={editForm.body} onChange={e => setEditForm(p=>({...p,body:e.target.value}))} placeholder="Write your announcement..." rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" />
            <div className="flex items-center gap-3">
              <select value={editForm.tag} onChange={e => setEditForm(p=>({...p,tag:e.target.value}))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                <option>Info</option><option>Urgent</option><option>Reminder</option><option>Policy</option>
              </select>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setEditingAnnouncement(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className={bgUrl ? "font-semibold text-lg text-white drop-shadow" : "font-semibold text-base text-gray-900"}>Announcements</h2>
          {unread.length > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unread.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          {canChangeBg && <button onClick={() => setEditingBg(!editingBg)} className={`text-sm px-3 py-1.5 rounded-lg transition ${bgUrl ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>🎨 Theme</button>}
          {canPost && <button onClick={() => setShowForm(!showForm)} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showForm ? 'Cancel' : '+ Post'}</button>}
        </div>
      </div>

      {/* Post form */}
      {showForm && (
        <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl p-4 space-y-3">
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
                  <button onClick={() => setAttachments(prev => prev.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500 ml-1">×</button>
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

      {/* Announcements grouped by month */}
      {announcements.length === 0 && <div className="text-center py-8 text-gray-600 text-sm">No announcements yet.</div>}
      {monthKeys.map(monthKey => (
        <MonthGroup
          key={monthKey}
          monthKey={monthKey}
          announcements={grouped[monthKey]}
          defaultOpen={monthKey === currentMonthKey}
          acks={acks}
          showAcks={showAcks}
          ackDetails={ackDetails}
          canManage={canManage}
          bgUrl={bgUrl}
          onDelete={deleteAnnouncement}
          onEdit={openEdit}
          onAck={acknowledge}
          onLoadAck={loadAckDetails}
          TAG_COLORS={TAG_COLORS}
        />
      ))}

      </div>
      </div>
    </div>
  )
}

// -- Month Group (collapsible) -----------------------------------------------
function MonthGroup({ monthKey, announcements, defaultOpen, acks, showAcks, ackDetails, canManage, bgUrl, onDelete, onEdit, onAck, onLoadAck, TAG_COLORS }: {
  monthKey: string, announcements: any[], defaultOpen: boolean, acks: Record<string,boolean>,
  showAcks: string|null, ackDetails: Record<string,any[]>, canManage: boolean, bgUrl: string|null|undefined,
  onDelete: (id:string)=>void, onEdit: (a:any)=>void, onAck: (id:string)=>void, onLoadAck: (id:string)=>void, TAG_COLORS: Record<string,string>
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const PREVIEW_LENGTH = 180

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cardBg = bgUrl ? "bg-white/92 backdrop-blur-sm border border-white/50" : "bg-white border border-gray-200"
  const headerBg = bgUrl ? "bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl" : "bg-gray-100 rounded-xl border border-gray-200"
  const headerText = bgUrl ? "text-white font-semibold text-sm drop-shadow" : "text-gray-700 font-semibold text-sm"

  return (
    <div className="space-y-2">
      {/* Month header — click to collapse/expand */}
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 transition ${headerBg}`}>
        <span className={headerText}>📅 {monthKey}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${bgUrl ? "bg-white/30 text-white" : "bg-gray-200 text-gray-600"}`}>
            {announcements.length} post{announcements.length !== 1 ? "s" : ""}
          </span>
          <span className={bgUrl ? "text-white text-xs" : "text-gray-500 text-xs"}>{open ? "▲ Collapse" : "▼ Show"}</span>
        </div>
      </button>

      {/* Announcements within month */}
      {open && announcements.map(a => {
        const isLong = a.body && a.body.length > PREVIEW_LENGTH
        const isExpanded = expandedIds.has(a.id)
        const displayBody = isLong && !isExpanded ? a.body.slice(0, PREVIEW_LENGTH) + "…" : a.body
        return (
          <div key={a.id} className={`${cardBg} rounded-xl p-4 space-y-2 ${a.tag==='Urgent'?'border-red-300':''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[a.tag]||TAG_COLORS.Info}`}>{a.tag}</span>
                <h3 className="font-semibold text-gray-900 text-sm">{a.title}</h3>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => onEdit(a)} className="text-xs px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition font-medium" title="Edit">✎ Edit</button>
                  <button onClick={() => onDelete(a.id)} className="text-gray-400 hover:text-red-500 text-sm transition" title="Delete">✕</button>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{displayBody}</p>
            {isLong && (
              <button onClick={() => toggleExpand(a.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">
                {isExpanded ? "▲ Read less" : "▼ Read more"}
              </button>
            )}
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
              <span className="text-xs text-gray-400">By {a.posted_by.split('@')[0]} · {new Date(a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
              <div className="flex items-center gap-2">
                {canManage && <button onClick={() => onLoadAck(a.id)} className="text-xs text-blue-600 hover:underline">Compliance</button>}
                {!acks[a.id] ? (
                  <button onClick={() => onAck(a.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition">Acknowledge</button>
                ) : (
                  <span className="text-xs text-green-600 font-medium">✓ Done</span>
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
                      <span key={ac.id} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">{ac.user_email.split('@')[0]} · {new Date(ac.acknowledged_at).toLocaleDateString()}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
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
function GameLeaderboard({ refreshKey, userRole, showToast, currentUser }: { refreshKey: number, userRole: string, showToast: (m: string, t: 'success'|'error') => void, currentUser?: string | null }) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const now = new Date()
  const [lbMonth, setLbMonth] = useState(now.getMonth() + 1) // 1-indexed
  const [lbYear, setLbYear] = useState(now.getFullYear())
  const [scores, setScores] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [approving, setApproving] = useState<string|null>(null)
  const isAdmin = ['super_admin','admin'].includes(userRole)
  const lbYears = Array.from({length:3}, (_,i) => now.getFullYear()-i)

  useEffect(() => { loadScores(); if (isAdmin) loadPending() }, [refreshKey, lbMonth, lbYear])

  async function loadScores() {
    const now = new Date()
    const monthYear = `${lbYear}-${String(lbMonth).padStart(2,'0')}`
    const { data } = await supabase.from('game_scores').select('user_name,user_email,score,screenshot_url,played_at,approved_by').eq('game_key','game_of_month').eq('month_year',monthYear).order('score',{ascending:false})
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
    await supabase.from('game_scores').insert({ user_email: sub.user_email, user_name: sub.user_name, game_key: 'game_of_month', score, month_year: monthYear, screenshot_url: sub.screenshot_url, verified: true, approved_by: currentUser })
    await supabase.from('game_score_submissions').update({ status: 'approved', approved_score: score, reviewed_by: currentUser }).eq('id', sub.id)
    await writeAuditLog('APPROVE_GAME_SCORE', currentUser || '', sub.user_name, monthYear, 'Game Score', 'Pending', `${score.toLocaleString()} (approved)`)
    showToast(`Score ${score.toLocaleString()} approved for ${sub.user_name}!`, 'success')
    setApproving(null)
    loadScores(); loadPending()
  }

  async function rejectSubmission(id: string) {
    const sub = pending.find((p:any) => p.id === id)
    await supabase.from('game_score_submissions').update({ status: 'rejected', reviewed_by: currentUser }).eq('id', id)
    if (sub) await writeAuditLog('REJECT_GAME_SCORE', currentUser || '', sub.user_name, '', 'Game Score', 'Pending', 'Rejected')
    showToast('Submission rejected', 'success')
    loadPending()
  }

  const medals = ['🥇','🥈','🥉']

  return (
    <div className="space-y-4">
      {/* Month/Year selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Leaderboard for:</span>
        <select value={lbMonth} onChange={e=>setLbMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900">
          {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
        </select>
        <select value={lbYear} onChange={e=>setLbYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900">
          {lbYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
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
                <span className="text-sm font-bold text-blue-900 block" title={s.approved_by && userRole !== 'agent' ? `Approved by ${s.approved_by.split('@')[0]}` : undefined}>{s.score.toLocaleString()}</span>
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


// -- My Profile Card (Home page — upload/change your own photo) -------------
function MyProfileCard({ currentUser, userName, showToast }: { currentUser: string, userName: string, showToast: (m: string, t: 'success'|'error') => void }) {
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null)
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    supabase.from('app_users').select('avatar_url').eq('username', currentUser.toLowerCase()).single()
      .then(({data}) => { setAvatarUrl(data?.avatar_url || null); setLoaded(true) })
  }, [currentUser])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${currentUser.toLowerCase()}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()
      // .select() forces Supabase to return the updated row(s) so we can tell
      // a genuine "0 rows matched" apart from a real success — .update() alone
      // returns no error even when nothing matched, which silently looked like
      // success before while actually saving nothing.
      const { data: updated, error: dbErr } = await supabase.from('app_users').update({ avatar_url: publicUrl }).eq('username', currentUser.toLowerCase()).select()
      if (dbErr) throw dbErr
      if (!updated || updated.length === 0) {
        throw new Error(`No account found for "${currentUser}" — your photo was uploaded but couldn't be linked to your login. Please flag this in Matrix with your exact login email.`)
      }
      setAvatarUrl(publicUrl)
      showToast('Photo updated!', 'success')
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Upload failed', 'error') }
    setUploading(false)
  }

  if (!loaded) return null

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-white/50 rounded-xl px-4 py-3 shadow-sm flex items-center gap-4">
      <label className="relative flex-shrink-0 cursor-pointer group" title="Click to upload or change your photo">
        {avatarUrl
          ? <img src={avatarUrl} alt={userName} className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-100"/>
          : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold ring-2 ring-blue-100 ${avatarColor(currentUser||'')}`}>{userName?.charAt(0).toUpperCase()}</div>
        }
        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition">
          {uploading ? <span className="text-white text-[10px]">...</span> : <span className="text-white text-xs opacity-0 group-hover:opacity-100">📷</span>}
        </div>
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload}/>
      </label>
      <div>
        <p className="text-sm font-semibold text-gray-900">{userName}</p>
        <p className="text-xs text-gray-500">{avatarUrl ? 'Click your photo to change it' : 'Click your photo to add one — it shows on the Org Chart too'}</p>
      </div>
    </div>
  )
}

export function HomeScreen({ currentUser, userRole, showToast, activeTab, bgUrl }: { currentUser: string, userRole: string, showToast: (m: string, t: 'success'|'error') => void, activeTab?: string, bgUrl?: string | null }) {
  const [leaderboardKey, setLeaderboardKey] = useState(0)
  const stored = typeof window !== 'undefined' ? localStorage.getItem('kpi_user') : null
  const storedName = stored ? JSON.parse(stored).display_name : null
  const userName = storedName || currentUser?.split('@')[0] || currentUser

  return (
    <div className="h-full flex flex-col">
      {activeTab === 'gaming-hub' ? (
        <div className="flex-1 overflow-y-auto p-6 relative z-10">
          {bgUrl && (
            <div className="fixed inset-0 z-0 pointer-events-none" style={{top:'56px',left:'240px'}}>
              <img src={bgUrl} alt="" className="w-full h-full object-cover" style={{filter:'blur(0px) brightness(0.60)'}}/>
              <div className="absolute inset-0 bg-blue-950/25"/>
            </div>
          )}
        <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white drop-shadow-lg">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {userName}! 👋</h1>
          <p className="text-sm text-white/80 mt-0.5 drop-shadow">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/95 backdrop-blur-sm border border-white/50 rounded-xl p-6 shadow-lg">
            <GameOfMonth userEmail={currentUser} userName={userName} onScoreSaved={() => setLeaderboardKey(k => k + 1)} />
          </div>
          <div className="bg-white/95 backdrop-blur-sm border border-white/50 rounded-xl p-6 shadow-lg">
            <GameLeaderboard refreshKey={leaderboardKey} userRole={userRole} showToast={showToast} currentUser={currentUser} />
          </div>
        </div>
        </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <AnnouncementsPanel userEmail={currentUser} userRole={userRole} showToast={showToast} />
          </div>
        </div>
      )}
    </div>
  )
}


// -- Forced Password Change (shown after login if must_change_password) ----
function ForcedPasswordChange({ username, onDone }: { username: string, onDone: () => void }) {
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPass.length < 6) { setError('Password must be at least 6 characters'); return }
    if (newPass !== confirmPass) { setError('Passwords do not match'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword: newPass, adminReset: true })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update password')
      onDone()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update password') }
    finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center md:justify-end md:pr-16 p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0" style={{backgroundImage:"url('/login-bg.jpg')",backgroundSize:'cover',backgroundPosition:'center left',filter:'blur(2px) brightness(0.5)',transform:'scale(1.05)'}} />
      <div className="absolute inset-0 z-0 bg-blue-950/30" />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 md:mx-0 p-8 relative z-10">
        <div className="text-center mb-6">
          <img src="/ab-logo.png" alt="AB BSS" className="w-20 h-20 object-contain mb-2 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Set a New Password</h1>
          <p className="text-gray-500 text-sm mt-1">For your security, please choose your own password before continuing.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-blue-900 hover:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">{saving ? 'Saving...' : 'Set Password & Continue'}</button>
        </form>
      </div>
    </div>
  )
}

// -- No Access Page ----------------------------------------------------------
function NoAccessPage({ userRole, onBack }: { userRole: string, onBack: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Access Restricted</h1>
        <p className="text-sm text-gray-500">Your current role (<span className="font-medium text-gray-700">{userRole}</span>) does not have permission to view this page.</p>
        <p className="text-xs text-gray-400">If you believe this is an error, please contact your Super Admin.</p>
        <button onClick={onBack} className="mt-4 bg-blue-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 transition">← Go Back</button>
      </div>
    </div>
  )
}

// -- Login Screen ------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (u: string, r: string, mustChangePassword?: boolean) => void }) {
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
      onLogin(data.user.username, data.user.role, data.user.mustChangePassword)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Login failed') }
    finally { setLoading(false) }
  }

  async function handleGoogleLogin() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' }
      }
    })
    if (error) setError(error.message)
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
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or</span></div>
            </div>
            <button type="button" onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
            <p className="text-center text-xs text-gray-400">Use your company Google account</p>
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
function CollapsibleSidebar({ view, setView, setMobileMenuOpen, pendingCoachingCount = 0, pendingTaskCount = 0, userRole, favoriteViews = [], onToggleFavorite, onReorderFavorites, user, displayName, showToast }: { view: string, setView: (v: any) => void, setMobileMenuOpen: (v: boolean) => void, pendingCoachingCount?: number, pendingTaskCount?: number, userRole: string, favoriteViews?: string[], onToggleFavorite?: (id: string) => void, onReorderFavorites?: (next: string[]) => void, user: string | null, displayName: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({
    home: false, perf: false, people: false, ops: false, tltools: false, hris: false, dir: false, sys: false
  })

  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const itemStyle = (id: string) =>
    `w-full flex items-center gap-2 px-2.5 py-2.5 text-sm font-medium transition-all rounded-lg ${
      view === id
        ? 'bg-gradient-to-r from-blue-900 to-blue-700 text-white font-bold shadow-md'
        : 'text-gray-900 hover:bg-gray-100 hover:text-blue-900'
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

  const NavItem = ({ id, label, icon, badge, dotColor }: { id: string, label: string, icon: React.ReactNode, badge?: number, dotColor?: string }) => {
    const isFavorited = favoriteViews.includes(id)
    return (
      <button onClick={() => { setView(id); setMobileMenuOpen(false) }} className={`group ${itemStyle(id)}`}>
        {dotColor && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />}
        {icon}
        <span className="truncate font-semibold">{label}</span>
        {onToggleFavorite && (
          <span
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(id) }}
            className={`ml-auto flex-shrink-0 transition ${isFavorited ? 'text-amber-400' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
            title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <Star className="w-3.5 h-3.5" fill={isFavorited ? 'currentColor' : 'none'} />
          </span>
        )}
        {badge && badge > 0 ? <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 min-w-[20px] text-center">{badge}</span> : view === id && !onToggleFavorite ? <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"/> : null}
      </button>
    )
  }

  const ExternalNavItem = ({ label, icon, url, dotColor }: { label: string, icon: React.ReactNode, url: string, dotColor?: string }) => (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className={`w-full flex items-center gap-2 px-2.5 py-2.5 text-sm font-medium transition-all rounded-lg text-gray-900 hover:bg-gray-100 hover:text-blue-900`}>
      {dotColor && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />}
      {icon}
      <span className="truncate font-semibold">{label}</span>
      <span className="ml-auto text-gray-300 text-xs flex-shrink-0">↗</span>
    </a>
  )


  const NAV_META: Record<string, { label: string, icon: React.ReactNode, dotColor: string }> = {
    'announcements': { label: 'Announcements', icon: <Bell className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-sky-400' },
    'gaming-hub': { label: 'Gaming Hub', icon: <Gamepad2 className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-sky-400' },
    'tickets': { label: 'Tickets', icon: <FileText className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-orange-400' },
    'tasks': { label: 'Tasks', icon: <CheckCircle className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-orange-400' },
    'bcp': { label: 'BCP', icon: <Shield className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-orange-400' },
    'links': { label: 'Links', icon: <TrendingUp className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-purple-400' },
    'resources': { label: 'Resources', icon: <FileText className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-purple-400' },
    'hris-records': { label: 'Employee Records', icon: <FileText className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-pink-400' },
    'hris-timetracker': { label: 'Time Tracker', icon: <Clock className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-pink-400' },
    'entry': { label: 'KPI Entry', icon: <PlusCircle className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-indigo-400' },
    'observations': { label: 'Observations', icon: <FileText className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-indigo-400' },
    'tl-tools': { label: 'Coaching & 1-on-1', icon: <Shield className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-indigo-400' },
    'cadence': { label: 'Operating Cadence', icon: <FileText className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-indigo-400' },
    'dashboard-month': { label: 'Dashboard', icon: <BarChart2 className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-emerald-400' },
    'dashboard-employee': { label: 'Employee Trends', icon: <TrendingUp className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-emerald-400' },
    'dashboard-team': { label: 'Team View', icon: <Users className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-emerald-400' },
    'employees': { label: 'Employees', icon: <UserPlus className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-amber-400' },
    'teams': { label: 'Teams', icon: <Award className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-amber-400' },
    'org-chart': { label: 'Org Chart', icon: <Users className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-amber-400' },
    'matrix': { label: 'Matrix', icon: <FileSpreadsheet className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-rose-400' },
    'settings': { label: 'Settings', icon: <Shield className="w-4 h-4 flex-shrink-0"/>, dotColor: 'bg-rose-400' },
  }

  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex || !onReorderFavorites) return
    const next = [...favoriteViews]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    onReorderFavorites(next)
    setDragIndex(null)
  }

  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(null)
  const [uploadingSidebarAvatar, setUploadingSidebarAvatar] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('app_users').select('avatar_url').eq('username', user.toLowerCase()).single()
      .then(({ data }) => setSidebarAvatarUrl(data?.avatar_url || null))
  }, [user])

  async function handleSidebarAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return }
    setUploadingSidebarAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.toLowerCase()}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()
      const { data: updated, error: dbErr } = await supabase.from('app_users').update({ avatar_url: publicUrl }).eq('username', user.toLowerCase()).select()
      if (dbErr) throw dbErr
      if (!updated || updated.length === 0) throw new Error(`No account found for "${user}".`)
      setSidebarAvatarUrl(publicUrl)
      showToast('Photo updated!', 'success')
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Upload failed', 'error') }
    setUploadingSidebarAvatar(false)
  }

  return (
    <div className="flex-1 overflow-y-auto py-3">

      {/* Profile -- photo + name at top of sidebar, click photo to change it */}
      <div className="px-3 pb-3 mb-1 border-b border-gray-200 flex items-center gap-3">
        <label className="relative flex-shrink-0 cursor-pointer group" title="Click to upload or change your photo">
          {sidebarAvatarUrl
            ? <img src={sidebarAvatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-100"/>
            : <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-blue-100 ${avatarColor(user||'')}`}>{displayName?.charAt(0).toUpperCase()}</div>
          }
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition">
            {uploadingSidebarAvatar ? <span className="text-white text-[9px]">...</span> : <span className="text-white text-[10px] opacity-0 group-hover:opacity-100">📷</span>}
          </div>
          <input type="file" accept="image/*" className="hidden" disabled={uploadingSidebarAvatar} onChange={handleSidebarAvatarUpload}/>
        </label>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{displayName || user}</p>
          <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[userRole] || userRole}</p>
        </div>
      </div>

      {/* FAVORITES -- personal, drag-to-reorder shortcuts. Purely additive;
          does not remove or alter anything from the full sidebar below. */}
      {favoriteViews.length > 0 && (
        <div className="px-2 pb-2 mb-1 border-b border-gray-200">
          <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400"/>Favorites</p>
          <div className="space-y-0.5">
            {favoriteViews.map((id, i) => {
              const meta = NAV_META[id]
              if (!meta) return null
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(i)}
                  className={`cursor-move ${dragIndex === i ? 'opacity-40' : ''}`}
                >
                  <NavItem id={id} label={meta.label} icon={meta.icon} dotColor={meta.dotColor}
                    badge={id === 'tl-tools' ? pendingCoachingCount : id === 'tasks' ? pendingTaskCount : undefined} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Collapse All / Expand All */}
      <div className="px-3 pb-2">
        <button
          onClick={() => {
            const allCollapsed = Object.values(collapsed).every(Boolean)
            const next = Object.keys(collapsed).reduce((acc, k) => ({ ...acc, [k]: !allCollapsed }), {} as Record<string, boolean>)
            setCollapsed(next)
          }}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 py-1.5 rounded-lg hover:bg-gray-50 transition"
        >
          {Object.values(collapsed).every(Boolean) ? (
            <><ChevronDown className="w-3.5 h-3.5" /> Expand All</>
          ) : (
            <><ChevronUp className="w-3.5 h-3.5" /> Collapse All</>
          )}
        </button>
      </div>

      {/* HOME */}
      <SectionHeader sectionKey="home" label="Home" hasActive={['announcements','gaming-hub'].includes(view)} />
      {!collapsed.home && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="announcements" label="Announcements" icon={<Bell className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-sky-400"/>
          <NavItem id="gaming-hub" label="Gaming Hub" icon={<Gamepad2 className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-sky-400"/>
        </div>
      )}

      {/* OPERATIONS */}
      <SectionHeader sectionKey="ops" label="Operations" hasActive={['tickets','tasks','bcp'].includes(view)} />
      {!collapsed.ops && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="tickets" label="Tickets" icon={<FileText className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-orange-400"/>
          <NavItem id="tasks" label="Tasks" icon={<CheckCircle className="w-4 h-4 flex-shrink-0"/>} badge={pendingTaskCount} dotColor="bg-orange-400"/>
          <NavItem id="bcp" label="BCP" icon={<Shield className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-orange-400"/>
        </div>
      )}

      {/* DIRECTORY */}
      <SectionHeader sectionKey="dir" label="Directory" hasActive={['links','resources'].includes(view)} />
      {!collapsed.dir && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="links" label="Links" icon={<TrendingUp className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-purple-400"/>
          <NavItem id="resources" label="Resources" icon={<FileText className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-purple-400"/>
        </div>
      )}

      {/* HRIS */}
      <SectionHeader sectionKey="hris" label="HRIS" hasActive={['hris-records','hris-invoice','hris-timetracker'].includes(view)} />
      {!collapsed.hris && (
        <div className="px-2 pb-1 space-y-0.5">
          <ExternalNavItem label="Hiring Pipeline" icon={<UserPlus className="w-4 h-4 flex-shrink-0"/>} url="https://abbss-hiring-pipeline.vercel.app/" dotColor="bg-pink-400"/>
          <NavItem id="hris-records" label="Employee Records" icon={<FileText className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-pink-400"/>
          <NavItem id="hris-timetracker" label="Time Tracker" icon={<Clock className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-pink-400"/>
          <NavItem id="hris-invoice" label="Invoice" icon={<FileText className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-pink-400"/>
        </div>
      )}

      {/* TEAM LEAD TOOLS */}
      <SectionHeader sectionKey="tltools" label="Team Lead Tools" hasActive={['tl-tools','entry','observations','cadence','tl-scorecard'].includes(view as string)} />
      {!collapsed.tltools && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="entry" label="KPI Entry" icon={<PlusCircle className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-indigo-400"/>
          <NavItem id="observations" label="Observations" icon={<FileText className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-indigo-400"/>
          <NavItem id="tl-tools" label="Coaching & 1-on-1" icon={<Shield className="w-4 h-4 flex-shrink-0"/>} badge={pendingCoachingCount} dotColor="bg-indigo-400"/>
          <NavItem id="cadence" label="Operating Cadence" icon={<FileText className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-indigo-400"/>
          <NavItem id="tl-scorecard" label="TL Scorecard" icon={<BarChart2 className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-indigo-400"/>
        </div>
      )}

      {/* PERFORMANCE */}
      <SectionHeader sectionKey="perf" label="Performance" hasActive={['dashboard-month','dashboard-employee','dashboard-team'].includes(view)} />
      {!collapsed.perf && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="dashboard-month" label="Dashboard" icon={<BarChart2 className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-emerald-400"/>
          <NavItem id="dashboard-employee" label="Employee Trends" icon={<TrendingUp className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-emerald-400"/>
          <NavItem id="dashboard-team" label="Team View" icon={<Users className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-emerald-400"/>
        </div>
      )}

      {/* PEOPLE */}
      <SectionHeader sectionKey="people" label="People" hasActive={['employees','teams','org-chart'].includes(view)} />
      {!collapsed.people && (
        <div className="px-2 pb-1 space-y-0.5">
          <NavItem id="employees" label="Employees" icon={<UserPlus className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-amber-400"/>
          <NavItem id="teams" label="Teams" icon={<Award className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-amber-400"/>
          <NavItem id="org-chart" label="Org Chart" icon={<Users className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-amber-400"/>
        </div>
      )}

      {/* SYSTEM */}
      <SectionHeader sectionKey="sys" label="System" hasActive={['settings','matrix'].includes(view)} />
      {!collapsed.sys && (
        <div className="px-2 pb-1 space-y-0.5">
          {(userRole === 'super_admin' || userRole === 'admin') && <NavItem id="matrix" label="Matrix" icon={<FileSpreadsheet className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-rose-400"/>}
          <NavItem id="settings" label="Settings" icon={<Shield className="w-4 h-4 flex-shrink-0"/>} dotColor="bg-rose-400"/>
        </div>
      )}

    </div>
  )
}

export default function KPIApp() {
  const [user, setUser] = useState<string | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [displayName, setDisplayName] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('agent')
  const [pendingCoachingCount, setPendingCoachingCount] = useState(0)
  const [pendingTaskCount, setPendingTaskCount] = useState(0)
  const [favoriteViews, setFavoriteViews] = useState<string[]>([])
  const [bgUrl, setBgUrl] = useState<string|null>(null)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key','announcement_bg').single()
      .then(({data}) => { if (data?.value) setBgUrl(data.value) })
  }, [])
  const [previewAs, setPreviewAs] = useState<'self'|'agent'>('self')
  const effectiveRole = previewAs === 'agent' ? 'agent' : userRole
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
    async function initAuth() {
      // Handle OAuth error params from callback redirect
      const params = new URLSearchParams(window.location.search)
      const oauthError = params.get('error')
      if (oauthError) {
        window.history.replaceState({}, '', window.location.pathname)
        const msgs: Record<string, string> = {
          domain_not_allowed: 'Only @ab-businesssupport.com and @ab-contactsolutions.com accounts can sign in.',
          oauth_failed: 'Google sign-in failed. Please try again.',
          no_code: 'Google sign-in was cancelled.',
        }
        setLoading(false)
        alert(msgs[oauthError] || 'Sign-in error. Please try again.')
        return
      }

      // First check for an existing local session
      const stored = localStorage.getItem('kpi_user')
      if (stored) { const u = JSON.parse(stored); setUser(u.username); setUserRole(u.role || 'agent'); setDisplayName(u.display_name || u.username?.split('@')[0] || u.username); setMustChangePassword(!!u.mustChangePassword); return }

      // Check for Google OAuth session (set by callback route via cookie or Supabase session)
      // Also try to restore session from cookie tokens set by callback
      const sbAccessToken = document.cookie.split(';').find(c => c.trim().startsWith('sb-access-token='))?.split('=')[1]
      const sbRefreshToken = document.cookie.split(';').find(c => c.trim().startsWith('sb-refresh-token='))?.split('=')[1]
      
      if (sbAccessToken && sbRefreshToken) {
        // Set the session from cookies
        await supabase.auth.setSession({ access_token: sbAccessToken, refresh_token: sbRefreshToken })
        // Clear cookies after use
        document.cookie = 'sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
        document.cookie = 'sb-refresh-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        const email = session.user.email.toLowerCase()
        // Look up their role in app_users
        const { data: appUser } = await supabase.from('app_users').select('*').eq('email', email).single()
        let role = 'agent'
        let displayName = email.split('@')[0]
        let mustChange = false
        if (appUser) {
          role = appUser.role
          displayName = appUser.display_name || appUser.name || email
          mustChange = !!appUser.must_change_password
        }
        const userData = { username: email, role, display_name: displayName, mustChangePassword: mustChange }
        localStorage.setItem('kpi_user', JSON.stringify(userData))
        setUser(email); setUserRole(role); setDisplayName(displayName); setMustChangePassword(mustChange)
        return
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  useEffect(() => { if (user) loadData() }, [user])

  // Load pending coaching acknowledgments count for viewers
  useEffect(() => {
    if (!user || (userRole !== 'agent' && userRole !== 'Team Lead' && userRole !== 'admin' && userRole !== 'super_admin')) return
    async function loadPending() {
      if (userRole === 'agent') {
        // Agents: count sessions assigned to them requiring acknowledgment
        const { data } = await supabase.from('coaching_logs')
          .select('id')
          .eq('employee_email', user!.toLowerCase())
          .eq('requires_acknowledgment', true)
          .eq('agent_acknowledged', false)
        setPendingCoachingCount((data || []).length)
      } else {
        // TLs/Admins: count sessions pending across all agents
        const { data } = await supabase.from('coaching_logs')
          .select('id')
          .eq('requires_acknowledgment', true)
          .eq('agent_acknowledged', false)
        setPendingCoachingCount((data || []).length)
      }
    }
    loadPending()
  }, [user, userRole])

  // Load pending tasks count -- Agents see their own assigned/incomplete
  // tasks, Manager/Team Lead see all incomplete tasks across everyone.
  useEffect(() => {
    if (!user) return
    async function loadPendingTasks() {
      let q = supabase.from('tasks').select('id').eq('is_done', false)
      if (userRole === 'agent') q = q.eq('assigned_to', user!.toLowerCase())
      const { data } = await q
      setPendingTaskCount((data || []).length)
    }
    loadPendingTasks()
  }, [user, userRole])

  // Load this user's favorited sidebar items (persisted per-account, not
  // device-specific) and a helper to save changes back.
  useEffect(() => {
    if (!user) return
    supabase.from('app_users').select('favorite_views').eq('username', user.toLowerCase()).single()
      .then(({ data }) => { if (data?.favorite_views) setFavoriteViews(data.favorite_views) })
  }, [user])

  async function saveFavorites(next: string[]) {
    setFavoriteViews(next)
    if (!user) return
    await supabase.from('app_users').update({ favorite_views: next }).eq('username', user.toLowerCase())
  }

  function toggleFavorite(viewId: string) {
    const next = favoriteViews.includes(viewId)
      ? favoriteViews.filter(v => v !== viewId)
      : [...favoriteViews, viewId]
    saveFavorites(next)
  }

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

  if (!user) return <LoginScreen onLogin={(u, r, mcp) => { setUser(u); setUserRole(r || 'agent'); setMustChangePassword(!!mcp); setLoading(true) }} />

  if (mustChangePassword) return <ForcedPasswordChange username={user} onDone={() => setMustChangePassword(false)} />

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
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
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
          <button onClick={() => { localStorage.removeItem('kpi_user'); setUser(null) }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition font-medium">
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-gray-50 to-white flex flex-col transition-transform duration-200 ease-in-out pt-14 md:pt-0 shadow-2xl border-r border-gray-200 md:h-full`}>
                    <CollapsibleSidebar view={view} setView={setView} setMobileMenuOpen={setMobileMenuOpen} pendingCoachingCount={pendingCoachingCount} pendingTaskCount={pendingTaskCount} userRole={userRole} favoriteViews={favoriteViews} onToggleFavorite={toggleFavorite} onReorderFavorites={saveFavorites} user={user} displayName={displayName} showToast={showToast} />

        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto relative">
          {/* Global background for non-performance views */}
          {!(['dashboard-month','dashboard-employee','dashboard-team','org-chart','announcements','gaming-hub'] as string[]).includes(view) && bgUrl && (
            <div className="fixed inset-0 z-0 pointer-events-none" style={{top:'56px',left:'240px'}}>
              <img src={bgUrl} alt="" className="w-full h-full object-cover" style={{filter:'blur(0px) brightness(0.60)'}} />
              <div className="absolute inset-0 bg-blue-950/25" />
            </div>
          )}
        <div className="h-full animate-fadeIn relative z-10">
          {/* Announcements & Gaming Hub — full bleed, no padding wrapper */}
          {(view === 'announcements' || view === 'gaming-hub') ? (
            <HomeScreen currentUser={user || ''} userRole={userRole} showToast={showToast} activeTab={view} bgUrl={bgUrl} />
          ) : (
          <div className={`px-4 pt-4 pb-6 relative z-10 ${['org-chart','dashboard-month','dashboard-employee','dashboard-team'].includes(view) ? 'w-full max-w-[1600px] mx-auto' : 'max-w-6xl mx-auto'}`}>
          <div className={bgUrl && view !== 'dashboard-month' && view !== 'dashboard-employee' && view !== 'dashboard-team' && view !== 'org-chart' ? "bg-white/88 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 p-6" : ""}>
          {/* Preview mode banner */}
          {(userRole === 'super_admin' || userRole === 'admin') && (
            <div className={`mb-4 flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${previewAs === 'agent' ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
              <div className="flex items-center gap-2">
                {previewAs === 'agent' ? <AlertCircle className="w-4 h-4 text-amber-500"/> : <Shield className="w-4 h-4 text-blue-500"/>}
                {previewAs === 'agent' ? 'Previewing as Agent — notes and edits are hidden' : `Viewing as ${ROLE_LABELS[userRole] || 'Admin'} — full access`}
              </div>
              <button onClick={() => setPreviewAs(previewAs === 'agent' ? 'self' : 'agent')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${previewAs === 'agent' ? 'bg-amber-200 hover:bg-amber-300 text-amber-900' : 'bg-blue-200 hover:bg-blue-300 text-blue-900'}`}>
                {previewAs === 'agent' ? `← Back to ${ROLE_LABELS[userRole] || 'Admin'} View` : '👁 Preview as Agent'}
              </button>
            </div>
          )}
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <>
            {view === 'dashboard-month' && <PerformanceDashboard records={records} employees={employees} activeEmpIds={activeEmpIds} perfView={perfView} setPerfView={setPerfView} selMonth={selMonth} selYear={selYear} selQuarter={selQuarter} setSelMonth={setSelMonth} setSelYear={setSelYear} setSelQuarter={setSelQuarter} searchQ={searchQ} setSearchQ={setSearchQ} onEditRecord={() => loadData()} showToast={showToast} currentUser={user} userRole={effectiveRole} />}
            {view === 'dashboard-employee' && <EmployeeDashboard records={records} employees={employees} activeEmpIds={activeEmpIds} selEmployee={selEmployee} setSelEmployee={setSelEmployee} currentUser={user} userRole={effectiveRole} onEditRecord={() => loadData()} showToast={showToast} />}
            {view === 'dashboard-team' && <TeamDashboard records={records} employees={employees} activeEmpIds={activeEmpIds} showToast={showToast} currentUser={user} userRole={effectiveRole} onEditRecord={() => loadData()} />}
            {view === 'entry' && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead') && <KPIEntry employees={employees} records={records} onSaved={() => { loadData(); showToast('KPI record saved!') }} showToast={showToast} currentUser={user} />}
            {view === 'entry' && userRole === 'agent' && <div className="text-center py-20 text-gray-400"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p className="font-medium">Access Restricted</p><p className="text-sm mt-1">KPI Entry requires Team Lead access or higher</p></div>}
            {view === 'employees' && <EmployeeManager employees={employees} onChanged={() => { loadData(); showToast('Updated!') }} showToast={showToast} currentUser={user} userRole={userRole} />}
            {view === 'teams' && <TeamManager employees={employees} showToast={showToast} userRole={userRole} />}
            {view === 'observations' && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead') && <ObservationsPanel employees={employees} currentUser={user} userRole={userRole} showToast={showToast} />}
            {view === 'observations' && userRole === 'agent' && <MyObservations employees={employees} currentUser={user} />}
            {view === 'matrix' && (userRole === 'super_admin' || userRole === 'admin') && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div><h2 className="text-xl font-bold text-blue-900">Matrix</h2><p className="text-sm text-gray-500">Track features shipped, issues to fix, and SQL still pending in Supabase</p></div>
                <MatrixPanel currentUser={user} showToast={showToast} />
              </div>
            )}
            {view === 'matrix' && userRole !== 'super_admin' && userRole !== 'admin' && <NoAccessPage userRole={userRole} onBack={() => setView('announcements')} />}
            {view === 'settings' && (userRole === 'super_admin' ? <SettingsPanel currentUser={user} userRole={userRole} showToast={showToast} /> : <NoAccessPage userRole={userRole} onBack={() => setView('announcements')} />)}
            {view === 'org-chart' && <OrgChart employees={employees} showToast={showToast} />}
            {view === 'tickets' && <TicketsPanel currentUser={user || ''} userRole={userRole} showToast={showToast} />}
            {view === 'tasks' && <TasksPanel employees={employees} currentUser={user || ''} userRole={userRole} showToast={showToast} />}
            {view === 'bcp' && <BCPPanel employees={employees} currentUser={user || ''} userRole={userRole} showToast={showToast} />}
            {view === 'tl-tools' && <TLToolsPanel employees={employees} currentUser={user} userRole={userRole} showToast={showToast} onAckChange={async () => { const { data } = await supabase.from('coaching_logs').select('id').eq(userRole==='agent'?'employee_email':'agent_acknowledged', userRole==='agent'?user!.toLowerCase():false).eq('requires_acknowledgment', true).eq('agent_acknowledged', false); setPendingCoachingCount((data||[]).length) }} />}
            {view === 'tl-scorecard' && <TLScorecard currentUser={user} userRole={userRole} showToast={showToast} records={records} />}
            {view === 'hris-records' && (userRole === 'super_admin' || userRole === 'admin') && <HRISRecords userRole={userRole} currentUser={user} showToast={showToast} />}
            {view === 'hris-records' && (userRole === 'agent' || userRole === 'Team Lead') && <div className="text-center py-20 text-gray-400"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p className="font-medium">Access Restricted</p><p className="text-sm mt-1">Employee Records requires Manager access or higher</p></div>}
            {view === 'hris-timetracker' && (userRole === 'super_admin' || userRole === 'admin') && <TimeTrackerPanel employees={employees} records={records} currentUser={user} showToast={showToast} onApplied={() => loadData()} />}
            {view === 'hris-timetracker' && (userRole === 'agent' || userRole === 'Team Lead') && <div className="text-center py-20 text-gray-400"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p className="font-medium">Access Restricted</p><p className="text-sm mt-1">Time Tracker requires Manager access or higher</p></div>}
            {view === 'hris-invoice' && (
              <div className="max-w-lg mx-auto text-center py-20 space-y-4">
                <div className="w-20 h-20 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto">
                  <FileText className="w-10 h-10 text-pink-400" />
                </div>
                <h2 className="text-xl font-bold text-blue-900">Invoice</h2>
                <p className="text-gray-500 text-sm">Invoice management is coming soon. This will allow you to log, track, and manage invoices directly from the portal.</p>
                <span className="inline-block bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1.5 rounded-full">🚧 Coming Soon</span>
              </div>
            )}
            {view === 'links' && <DirectoryLinks userRole={userRole} showToast={showToast} />}
            {view === 'cadence' && <OperatingCadence currentUser={user} userRole={userRole} showToast={showToast} />}
            {view === 'resources' && <ResourcesPanel userRole={userRole} showToast={showToast} />}
          </>
        )}
          </div>
          </div>
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
  const [comp, setComp] = useState(record.compliance_score !== null ? (record.compliance_score * 100).toFixed(2) : '')
  const [compAuto, setCompAuto] = useState<ComplianceBreakdown | null>(null)
  const [compLoading, setCompLoading] = useState(true)
  const [notes, setNotes] = useState(record.notes || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCompLoading(true)
    supabase.from('employees').select('email').eq('id', record.employee_id).single()
      .then(({ data }) => getComplianceBreakdown(data?.email, record.month_label))
      .then(b => {
        if (cancelled) return
        setCompAuto(b)
        // Only pre-fill from auto-calc if the record doesn't already have a saved value —
        // once someone has saved a score for this month, we respect what's on record.
        if (record.compliance_score === null && b.rate !== null) setComp((b.rate * 100).toFixed(2))
        setCompLoading(false)
      })
    return () => { cancelled = true }
  }, [record.employee_id, record.month_label])

  async function save() {
    setSaving(true)
    const attN = att !== '' ? parseFloat(att)/100 : null
    const accN = acc !== '' ? parseFloat(acc)/100 : null
    const effN = eff !== '' ? parseFloat(eff)/100 : null
    const fbN = fb !== '' ? parseFloat(fb)/100 : null
    const compN = comp !== '' ? parseFloat(comp)/100 : 0

    // Build audit entries for changed fields
    const changes: {field: string, old: string, nw: string}[] = []
    if (attN !== record.attendance) changes.push({ field: 'Attendance', old: pct(record.attendance), nw: pct(attN) })
    if (accN !== record.accuracy) changes.push({ field: 'Accuracy', old: pct(record.accuracy), nw: pct(accN) })
    if (effN !== record.efficiency) changes.push({ field: 'Efficiency', old: pct(record.efficiency), nw: pct(effN) })
    if (fbN !== record.feedback) changes.push({ field: 'Feedback', old: pct(record.feedback), nw: pct(fbN) })
    if (compN !== record.compliance_score) changes.push({ field: 'Compliance', old: pct(record.compliance_score), nw: pct(compN) })
    if (notes !== record.notes) changes.push({ field: 'Notes', old: record.notes || '', nw: notes })

    const finalOverall = (attN||0)*0.2 + (accN||0)*0.3 + (effN||0)*0.3 + (fbN||0)*0.15 + (compN*0.05)
    const { error } = await supabase.from('kpi_records').update({ attendance: attN, accuracy: accN, efficiency: effN, feedback: fbN, compliance_score: compN, overall_score: finalOverall, notes, updated_at: new Date().toISOString() }).eq('id', record.id)
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
            { label: 'Feedback (15%)', val: fb, set: setFb },
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Compliance (5%)</label>
          <div className="relative">
            <input type="number" min="0" max="100" step="0.01" value={comp} onChange={e => setComp(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-7 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="e.g. 100" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {compLoading ? 'Checking coaching + announcement acknowledgments...' :
             compAuto && compAuto.totalRequired > 0 ? `Auto-calculated: ${(compAuto.rate!*100).toFixed(0)}% (${compAuto.totalAcked}/${compAuto.totalRequired} acknowledged — ${compAuto.coachAcked}/${compAuto.coachTotal} coaching, ${compAuto.annAcked}/${compAuto.annTotal} announcements, ${compAuto.taskDone}/${compAuto.taskTotal} tasks). Edit above to override.` :
             'No coaching or announcements requiring acknowledgment found this month — set manually.'}
          </p>
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
  const [selClient, setSelClient] = useState<string>('All')
  const [showAtRisk, setShowAtRisk] = useState(false)
  const canDeleteScores = ['super_admin','admin'].includes(userRole)

  async function deleteRecord(r: KpiRecord) {
    if (!confirm(`Delete the ${r.month_label} KPI record for ${r.employee_name}? This cannot be undone.`)) return
    const { error } = await supabase.from('kpi_records').delete().eq('id', r.id)
    if (error) { showToast(error.message, 'error'); return }
    await writeAuditLog('DELETE_RECORD', currentUser, r.employee_name || '', r.month_label || '', 'Record', pct(r.overall_score), 'deleted')
    showToast('Record deleted')
    onEditRecord()
  }
  const [showPerfect, setShowPerfect] = useState(false)
  const CLIENTS_FILTER = ['All', 'EMMA', 'AB BSS', 'Harlan + Holden']
  const CLIENT_COLORS: Record<string,string> = { 'EMMA': '#3b82f6', 'AB BSS': '#10b981', 'Harlan + Holden': '#f59e0b' }

  const [myTeamEmpIds, setMyTeamEmpIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    supabase.from('teams').select('id, name, team_lead:employees(client)').order('name').then(({data}) => setTeams(data||[]))
    supabase.from('team_members').select('team_id, employee_id').then(({data: memberData}) => {
      setMembers(memberData||[])
      if (userRole === 'agent' && currentUser) {
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
    const viewerFilter = userRole === 'agent' && myTeamEmpIds ? myTeamEmpIds : null
    // Client filter
    const clientEmpIds = selClient === 'All' ? null : new Set(employees.filter(e => e.client === selClient).map(e => e.id))
    let base = records.filter(r => activeEmpIds.has(r.employee_id) && (teamEmpIds === null || teamEmpIds.has(r.employee_id)) && (viewerFilter === null || viewerFilter.has(r.employee_id)) && (clientEmpIds === null || clientEmpIds.has(r.employee_id)))
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
      result.push({ ...valid[0], attendance: avg(valid.map(r=>r.attendance)), accuracy: avg(valid.map(r=>r.accuracy)), efficiency: avg(valid.map(r=>r.efficiency)), feedback: avg(valid.map(r=>r.feedback)), compliance_score: avg(valid.map(r=>r.compliance_score)), overall_score: avg(valid.map(r=>r.overall_score)), month_label: perfView === 'quarterly' ? QUARTERS[selQuarter]+' '+selYear : selYear, notes: null })
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
      {editRecord && userRole !== 'agent' && <EditScoreModal record={editRecord} currentUser={currentUser} onSaved={onEditRecord} onClose={() => setEditRecord(null)} showToast={showToast} />}

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

      {/* Client filter tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {CLIENTS_FILTER.map(c => (
          <button key={c} onClick={() => { setSelClient(c); setSelTeam('all') }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${selClient===c ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            style={selClient===c ? {background: c==='All' ? '#1e3a8a' : CLIENT_COLORS[c]||'#1e3a8a'} : {}}>
            {c}
          </button>
        ))}
        {(() => {
          const clientTeams = teams.filter((t:any) => selClient === 'All' || t.team_lead?.client === selClient)
          if (clientTeams.length === 0) return null
          return (
            <select value={selTeam} onChange={e => setSelTeam(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 ml-1">
              <option value="all">All Teams{selClient !== 'All' ? ` (${selClient})` : ''}</option>
              {clientTeams.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )
        })()}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="bg-blue-50 p-2 rounded-lg"><Users className="w-5 h-5 text-blue-500"/></div>
          <div><p className="text-xs text-gray-500">Employees</p><p className="text-lg font-bold text-gray-900">{ranked.length}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="bg-purple-50 p-2 rounded-lg"><BarChart2 className="w-5 h-5 text-purple-500"/></div>
          <div><p className="text-xs text-gray-500">Avg Score</p><p className="text-lg font-bold text-gray-900">{avgScore>0?(avgScore*100).toFixed(2)+'%':'N/A'}</p></div>
        </div>
        <div onClick={() => setShowPerfect(v=>!v)} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
          <div className="bg-emerald-50 p-2 rounded-lg"><Award className="w-5 h-5 text-emerald-500"/></div>
          <div><p className="text-xs text-gray-500">Perfect (100%) <span className="text-blue-500">{showPerfect?'▲':'▼'}</span></p><p className="text-lg font-bold text-gray-900">{ranked.filter(r=>(r.overall_score||0)>=0.9999).length}</p></div>
        </div>
        <div onClick={() => setShowAtRisk(v=>!v)} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:border-red-300 hover:shadow-md transition-all">
          <div className="bg-red-50 p-2 rounded-lg"><AlertCircle className="w-5 h-5 text-red-500"/></div>
          <div><p className="text-xs text-gray-500">At Risk (&lt;97%) <span className="text-blue-500">{showAtRisk?'▲':'▼'}</span></p><p className="text-lg font-bold text-gray-900">{ranked.filter(r=>(r.overall_score||0)<0.97).length}</p></div>
        </div>
      </div>

      {/* At Risk panel */}
      {showAtRisk && ranked.filter(r=>(r.overall_score||0)<0.97).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-red-800">⚠️ At Risk Employees ({ranked.filter(r=>(r.overall_score||0)<0.97).length})</p>
            <button onClick={() => setShowAtRisk(false)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ranked.filter(r=>(r.overall_score||0)<0.97).map(r => {
              const emp = employees.find(e => e.id === r.employee_id)
              return (
                <div key={r.id} className="bg-white border border-red-100 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.employee_name}</p>
                    <p className="text-xs text-gray-400">{emp?.client || ''} · {r.designation}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${(r.overall_score||0) >= 0.94 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {pct(r.overall_score)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {showAtRisk && ranked.filter(r=>(r.overall_score||0)<0.97).length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-sm text-emerald-700">✅ No at-risk employees for this period!</div>
      )}

      {/* Perfect employees panel */}
      {showPerfect && ranked.filter(r=>(r.overall_score||0)>=0.9999).length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-800">🏆 Perfect Score Employees ({ranked.filter(r=>(r.overall_score||0)>=0.9999).length})</p>
            <button onClick={() => setShowPerfect(false)} className="text-emerald-400 hover:text-emerald-600 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ranked.filter(r=>(r.overall_score||0)>=0.9999).map(r => {
              const emp = employees.find(e => e.id === r.employee_id)
              return (
                <div key={r.id} className="bg-white border border-emerald-100 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.employee_name}</p>
                    <p className="text-xs text-gray-400">{emp?.client || ''} · {r.designation}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">100% 🏆</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {showPerfect && ranked.filter(r=>(r.overall_score||0)>=0.9999).length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">No perfect scores this period yet.</div>
      )}

      {ranked.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
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
                  {ranked.map((r) => {
                    const emp = employees.find(e => e.id === r.employee_id)
                    const clientColor = emp?.client && selClient !== 'All' ? CLIENT_COLORS[emp.client] || '#6b7280' : null
                    return (
                    <Cell key={r.id} fill={clientColor || (
                      (r.overall_score||0) >= 0.9999 ? '#10b981' :
                      (r.overall_score||0) >= 0.97 ? '#3b82f6' :
                      (r.overall_score||0) >= 0.94 ? '#f59e0b' : '#ef4444'
                    )}/>
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-5 mt-3 text-xs text-gray-500 flex-wrap">
              {[['#10b981','100%'],['#3b82f6','97-99%'],['#f59e0b','94-96%'],['#ef4444','<94%']].map(([c,l])=>(
                <span key={l} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:c}}/>{l}</span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-700 text-sm mb-1">Avg Score Shape</h4>
            <p className="text-xs text-gray-400 mb-2">{ranked.length} employee{ranked.length!==1?'s':''}{selClient!=='All'?` · ${selClient}`:''}{selTeam!=='all'?` · ${teams.find((t:any)=>t.id===selTeam)?.name||''}`:''} — {viewLabel}</p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={[
                { metric: 'Attendance', value: parseFloat((avgOf(ranked,'attendance')*100).toFixed(2)) },
                { metric: 'Accuracy', value: parseFloat((avgOf(ranked,'accuracy')*100).toFixed(2)) },
                { metric: 'Efficiency', value: parseFloat((avgOf(ranked,'efficiency')*100).toFixed(2)) },
                { metric: 'Feedback', value: parseFloat((avgOf(ranked,'feedback')*100).toFixed(2)) },
                { metric: 'Compliance', value: parseFloat((avgOf(ranked,'compliance_score')*100).toFixed(2)) },
              ]} outerRadius="75%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={{fontSize:10}} />
                <PolarRadiusAxis domain={[0,100]} tick={{fontSize:8}} tickCount={5} />
                <Radar dataKey="value" stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.35} />
                <Tooltip formatter={(v:unknown) => typeof v === 'number' ? v.toFixed(2) + '%' : String(v)} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['#','Employee','Designation','Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 15%','Compliance 5%','Overall',...(userRole !== 'agent' ? ['Notes',''] : [])].map(h => (
                <th key={h} className={`px-4 py-3 font-medium text-gray-600 ${['Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 15%','Compliance 5%','Overall'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ranked.length===0 && <tr><td colSpan={userRole !== 'agent' ? 11 : 9} className="text-center py-12 text-gray-400">No records for active employees in this period.</td></tr>}
              {ranked.map((r,i) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-medium">{i+1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.designation}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.attendance)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.accuracy)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.efficiency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.feedback)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.compliance_score)}</td>
                  <td className="px-4 py-3 text-right"><span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${scoreBg(r.overall_score)}`}>{pct(r.overall_score)}</span></td>
                  {userRole !== 'agent' && <td className="px-4 py-3 text-gray-500 text-xs max-w-xs"><ExpandableNote note={r.notes} /></td>}
                  {userRole !== 'agent' && <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {(perfView==='monthly'||perfView==='weekly') && <button onClick={() => setEditRecord(r)} className="text-gray-400 hover:text-blue-600 p-1 transition" title="Edit scores"><Edit2 className="w-4 h-4"/></button>}
                      {(perfView==='monthly'||perfView==='weekly') && canDeleteScores && <button onClick={() => deleteRecord(r)} className="text-gray-400 hover:text-red-600 p-1 transition" title="Delete record"><Trash2 className="w-4 h-4"/></button>}
                    </div>
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
function TeamDashboard({ records, employees, activeEmpIds, showToast, currentUser, userRole, onEditRecord }:
  { records: KpiRecord[], employees: Employee[], activeEmpIds: Set<string>, showToast: (m: string, t?: 'success'|'error') => void, currentUser: string, userRole: string, onEditRecord: () => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selTeam, setSelTeam] = useState<string>('')
  const [selMonth, setSelMonth] = useState(MONTHS[new Date().getMonth()])
  const [selYear, setSelYear] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState(true)
  const [editRecord, setEditRecord] = useState<KpiRecord | null>(null)
  const canEditScores = ['super_admin','admin','Team Lead'].includes(userRole)
  const canDeleteScores = ['super_admin','admin'].includes(userRole)

  async function deleteRecord(r: KpiRecord) {
    if (!confirm(`Delete the ${r.month_label} KPI record for ${r.employee_name}? This cannot be undone.`)) return
    const { error } = await supabase.from('kpi_records').delete().eq('id', r.id)
    if (error) { showToast(error.message, 'error'); return }
    await writeAuditLog('DELETE_RECORD', currentUser, r.employee_name || '', r.month_label || '', 'Record', pct(r.overall_score), 'deleted')
    showToast('Record deleted')
    onEditRecord()
  }

  async function loadTeams() {
    setLoading(true)
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('teams').select('*, team_lead:employees(name)').order('name'),
      supabase.from('team_members').select('*, employee:employees(name, designation, employment_type, client)')
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
      {editRecord && <EditScoreModal record={editRecord} currentUser={currentUser} onSaved={onEditRecord} onClose={() => setEditRecord(null)} showToast={showToast} />}
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
      {teamRecords.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-md">
          <h4 className="font-semibold text-gray-700 text-sm mb-1">Team Avg Score Shape</h4>
          <p className="text-xs text-gray-400 mb-2">{selectedTeam?.name || ''} — {selMonth} {selYear}</p>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={[
              { metric: 'Attendance', value: parseFloat((avgOf(teamRecords,'attendance')*100).toFixed(2)) },
              { metric: 'Accuracy', value: parseFloat((avgOf(teamRecords,'accuracy')*100).toFixed(2)) },
              { metric: 'Efficiency', value: parseFloat((avgOf(teamRecords,'efficiency')*100).toFixed(2)) },
              { metric: 'Feedback', value: parseFloat((avgOf(teamRecords,'feedback')*100).toFixed(2)) },
              { metric: 'Compliance', value: parseFloat((avgOf(teamRecords,'compliance_score')*100).toFixed(2)) },
            ]} outerRadius="75%">
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{fontSize:10}} />
              <PolarRadiusAxis domain={[0,100]} tick={{fontSize:8}} tickCount={5} />
              <Radar dataKey="value" stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.35} />
              <Tooltip formatter={(v:unknown) => typeof v === 'number' ? v.toFixed(2) + '%' : String(v)} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['#','Employee','Designation','Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 15%','Compliance 5%','Overall','Notes',...(canEditScores ? [''] : [])].map(h => (
                <th key={h} className={`px-4 py-3 font-medium text-gray-600 ${['Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 15%','Compliance 5%','Overall'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {teamRecords.length===0 && <tr><td colSpan={canEditScores ? 11 : 10} className="text-center py-12 text-gray-400">No records for active members in this period.</td></tr>}
              {teamRecords.map((r,i) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-medium">{i+1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.designation}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.attendance)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.accuracy)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.efficiency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.feedback)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.compliance_score)}</td>
                  <td className="px-4 py-3 text-right"><span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${scoreBg(r.overall_score)}`}>{pct(r.overall_score)}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs"><ExpandableNote note={r.notes} /></td>
                  {canEditScores && <td className="px-4 py-3 whitespace-nowrap"><div className="flex items-center gap-1">
                    <button onClick={() => setEditRecord(r)} className="text-gray-400 hover:text-blue-600 p-1 transition" title="Edit scores"><Edit2 className="w-4 h-4"/></button>
                    {canDeleteScores && <button onClick={() => deleteRecord(r)} className="text-gray-400 hover:text-red-600 p-1 transition" title="Delete record"><Trash2 className="w-4 h-4"/></button>}
                  </div></td>}
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
function EmployeeDashboard({ records, employees, activeEmpIds, selEmployee, setSelEmployee, currentUser, userRole, onEditRecord, showToast }:
  { records: KpiRecord[], employees: Employee[], activeEmpIds: Set<string>, selEmployee: string, setSelEmployee: (v: string) => void, currentUser: string, userRole: string, onEditRecord: () => void, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [statusFilter, setStatusFilter] = useState<'active'|'inactive'>('active')
  const [focusMonth, setFocusMonth] = useState<string>('')
  const [editRecord, setEditRecord] = useState<KpiRecord | null>(null)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const canEditScores = ['super_admin','admin','Team Lead'].includes(userRole)
  const canDeleteScores = ['super_admin','admin'].includes(userRole)

  async function deleteRecord(r: KpiRecord) {
    if (!confirm(`Delete the ${r.month_label} KPI record for ${r.employee_name}? This cannot be undone.`)) return
    const { error } = await supabase.from('kpi_records').delete().eq('id', r.id)
    if (error) { showToast(error.message, 'error'); return }
    await writeAuditLog('DELETE_RECORD', currentUser, r.employee_name || '', r.month_label || '', 'Record', pct(r.overall_score), 'deleted')
    showToast('Record deleted')
    onEditRecord()
  }

  const emp = employees.find(e => e.id === selEmployee)
  const empRecords = records.filter(r => r.employee_id === selEmployee && r.overall_score !== null && (r.overall_score||0) > 0)
    .sort((a,b) => (yearOf(a.month_label)*12 + monthIndex(a.month_label)) - (yearOf(b.month_label)*12 + monthIndex(b.month_label)))
  const monthKeyOf = (r: KpiRecord) => `${yearOf(r.month_label)}-${String(monthIndex(r.month_label)+1).padStart(2,'0')}`

  // Focus-month selector: pick any tracked month and the chart/table scope
  // to a trailing 6-month window ending at that month, so a TL can jump to
  // whatever month they're coaching on and see the lead-up trend.
  useEffect(() => {
    if (empRecords.length > 0 && !empRecords.some(r => monthKeyOf(r) === focusMonth)) {
      setFocusMonth(monthKeyOf(empRecords[empRecords.length - 1]))
    }
  }, [selEmployee, empRecords.length])

  const focusIdx = empRecords.findIndex(r => monthKeyOf(r) === focusMonth)
  const windowedRecords = focusIdx === -1 ? empRecords : empRecords.slice(Math.max(0, focusIdx - 5), focusIdx + 1)
  const focusRecord = focusIdx === -1 ? empRecords[empRecords.length-1] : empRecords[focusIdx]

  const chartData = windowedRecords.map(r => ({
    month: r.month_label.substring(0,10),
    score: r.overall_score ? parseFloat((r.overall_score*100).toFixed(2)) : 0,
    attendance: r.attendance ? parseFloat((r.attendance*100).toFixed(2)) : 0,
    accuracy: r.accuracy ? parseFloat((r.accuracy*100).toFixed(2)) : 0,
    efficiency: r.efficiency ? parseFloat((r.efficiency*100).toFixed(2)) : 0,
    feedback: r.feedback ? parseFloat((r.feedback*100).toFixed(2)) : 0,
    compliance: r.compliance_score ? parseFloat((r.compliance_score*100).toFixed(2)) : 0,
  }))
  const radarData = focusRecord ? [
    { metric: 'Attendance', value: focusRecord.attendance ? parseFloat((focusRecord.attendance*100).toFixed(2)) : 0 },
    { metric: 'Accuracy', value: focusRecord.accuracy ? parseFloat((focusRecord.accuracy*100).toFixed(2)) : 0 },
    { metric: 'Efficiency', value: focusRecord.efficiency ? parseFloat((focusRecord.efficiency*100).toFixed(2)) : 0 },
    { metric: 'Feedback', value: focusRecord.feedback ? parseFloat((focusRecord.feedback*100).toFixed(2)) : 0 },
    { metric: 'Compliance', value: focusRecord.compliance_score ? parseFloat((focusRecord.compliance_score*100).toFixed(2)) : 0 },
  ] : []
  const avgScore = empRecords.length ? empRecords.reduce((s,r) => s+(r.overall_score||0),0)/empRecords.length : 0
  const latest = empRecords[empRecords.length-1]
  const best = empRecords.reduce((b,r) => ((r.overall_score||0)>(b?.overall_score||0)?r:b), empRecords[0])
  const eligibleEmployees = employees.filter(e => statusFilter === 'active' ? e.active : !e.active)

  return (
    <div className="space-y-6">
      {editRecord && <EditScoreModal record={editRecord} currentUser={currentUser} onSaved={onEditRecord} onClose={() => setEditRecord(null)} showToast={showToast} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-blue-900">Employee Performance</h2><p className="text-sm text-gray-500">{empRecords.length} months tracked</p></div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            {(['active','inactive'] as const).map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setSelEmployee('') }} className={`px-3 py-2 font-medium transition capitalize ${statusFilter === s ? 'bg-blue-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{s}</button>
            ))}
          </div>
          <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 max-w-xs">
            <option value="">Select employee...</option>
            {eligibleEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      {emp && <>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">{emp.name.split(',')[0]?.charAt(0)||'?'}</div>
          <div><h3 className="font-bold text-gray-900">{emp.name}</h3><p className="text-sm text-gray-500">{emp.designation}{!emp.active && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}</p></div>
        </div>
        {empRecords.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-blue-900">📅 Focus month for coaching:</span>
            <select value={focusMonth} onChange={e => setFocusMonth(e.target.value)} className="border border-blue-300 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900">
              {empRecords.map(r => <option key={r.id} value={monthKeyOf(r)}>{r.month_label}</option>)}
            </select>
            <span className="text-xs text-blue-600">Charts and history below scope to this month</span>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[{label:'Avg Score',value:avgScore>0?(avgScore*100).toFixed(2)+'%':'N/A'},{label:'Months Tracked',value:empRecords.length},{label:'Best Score',value:best?pct(best.overall_score):'N/A'},{label:'Perfect Months',value:empRecords.filter(r=>(r.overall_score||0)>=0.9999).length}].map(c => <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">{c.label}</p><p className="text-xl font-bold text-gray-900 mt-1">{c.value}</p></div>)}
        </div>
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-700 mb-1 text-sm">Performance Trend</h4>
              <p className="text-xs text-gray-400 mb-4">Trailing 6 months ending {focusRecord?.month_label} — all 5 KPI components + Overall</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{top:5,right:10,left:-20,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="month" tick={{fontSize:10}}/>
                  <YAxis domain={[0,101]} tick={{fontSize:10}} tickFormatter={v=>v+'%'}/>
                  <Tooltip formatter={(v:unknown) => typeof v === 'number' ? v.toFixed(2) + '%' : String(v)} />
                  <Legend wrapperStyle={{fontSize:11}} />
                  <ReferenceLine y={97} stroke="#fbbf24" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={2} dot={{r:3,fill:'#10b981'}} name="Attendance"/>
                  <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} dot={{r:3,fill:'#3b82f6'}} name="Accuracy"/>
                  <Line type="monotone" dataKey="efficiency" stroke="#8b5cf6" strokeWidth={2} dot={{r:3,fill:'#8b5cf6'}} name="Efficiency"/>
                  <Line type="monotone" dataKey="feedback" stroke="#ec4899" strokeWidth={2} dot={{r:3,fill:'#ec4899'}} name="Feedback"/>
                  <Line type="monotone" dataKey="compliance" stroke="#06b6d4" strokeWidth={2} dot={{r:3,fill:'#06b6d4'}} name="Compliance"/>
                  <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2.5} dot={{r:4,fill:'#f59e0b'}} name="Overall" strokeDasharray="5 2"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-700 mb-1 text-sm">Score Shape — {focusRecord?.month_label}</h4>
              <p className="text-xs text-gray-400 mb-2">All 5 components at a glance, great for coaching</p>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" tick={{fontSize:10}} />
                  <PolarRadiusAxis domain={[0,100]} tick={{fontSize:8}} tickCount={5} />
                  <Radar dataKey="value" stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.35} />
                  <Tooltip formatter={(v:unknown) => typeof v === 'number' ? v.toFixed(2) + '%' : String(v)} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h4 className="font-semibold text-gray-700 text-sm">Monthly History</h4></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                {['Month','Designation','Attendance','Accuracy','Efficiency','Feedback','Compliance','Overall','Notes',...(canEditScores ? [''] : [])].map(h => (
                  <th key={h} className={`px-4 py-2.5 font-medium text-gray-500 ${['Attendance','Accuracy','Efficiency','Feedback','Compliance','Overall'].includes(h)?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(() => {
                  const currentYear = String(new Date().getFullYear())
                  const yearGroups = new Map<string, KpiRecord[]>()
                  ;[...empRecords].reverse().forEach(r => {
                    const y = String(yearOf(r.month_label))
                    if (!yearGroups.has(y)) yearGroups.set(y, [])
                    yearGroups.get(y)!.push(r)
                  })
                  const sortedYears = Array.from(yearGroups.keys()).sort((a,b) => b.localeCompare(a))
                  const colCount = canEditScores ? 10 : 9
                  return sortedYears.map(year => {
                    const yearRecords = yearGroups.get(year)!
                    const expanded = year === currentYear || expandedYears.has(year)
                    return (
                      <Fragment key={year}>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <td colSpan={colCount} className="px-4 py-2">
                            <button onClick={() => setExpandedYears(prev => { const next = new Set(prev); next.has(year) ? next.delete(year) : next.add(year); return next })} className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-700 transition">
                              {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              {year} {year === currentYear && <span className="text-xs font-normal text-blue-600">(current)</span>}
                              <span className="text-xs font-normal text-gray-400">— {yearRecords.length} month{yearRecords.length!==1?'s':''}</span>
                            </button>
                          </td>
                        </tr>
                        {expanded && yearRecords.map(r => (
                          <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${monthKeyOf(r) === focusMonth ? 'bg-blue-50/50' : ''}`}>
                            <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">{r.month_label}</td>
                            <td className="px-4 py-2.5 text-gray-500">{r.designation}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.attendance)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.accuracy)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.efficiency)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.feedback)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{pct(r.compliance_score)}</td>
                            <td className="px-4 py-2.5 text-right"><span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${scoreBg(r.overall_score)}`}>{pct(r.overall_score)}</span></td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs"><ExpandableNote note={r.notes} /></td>
                            {canEditScores && <td className="px-4 py-2.5 whitespace-nowrap"><div className="flex items-center gap-1">
                              <button onClick={() => setEditRecord(r)} className="text-gray-400 hover:text-blue-600 p-1 transition" title="Edit scores"><Edit2 className="w-4 h-4"/></button>
                              {canDeleteScores && <button onClick={() => deleteRecord(r)} className="text-gray-400 hover:text-red-600 p-1 transition" title="Delete record"><Trash2 className="w-4 h-4"/></button>}
                            </div></td>}
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })
                })()}
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
  const [compliance, setCompliance] = useState('')
  const [complianceAuto, setComplianceAuto] = useState<ComplianceBreakdown | null>(null)
  const [complianceLoading, setComplianceLoading] = useState(false)
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
      setCompliance(existing.compliance_score!==null?(existing.compliance_score*100).toFixed(2):'')
    } else { setEditId(null); setAttendance(''); setAccuracy(''); setEfficiency(''); setFeedback(''); setNotes(''); setCoached(false); setCompliance('') }
  }, [empId, monthLabel])

  useEffect(() => {
    if (!selEmp) return
    let cancelled = false
    setComplianceLoading(true)
    const existing = records.find(r=>r.employee_id===empId&&r.month_label===monthLabel)
    getComplianceBreakdown(selEmp.email, monthLabel).then(b => {
      if (cancelled) return
      setComplianceAuto(b)
      // Only auto-fill if there's no existing saved record for this month, or the
      // existing record never had a compliance value set yet.
      if ((!existing || existing.compliance_score === null) && b.rate !== null) setCompliance((b.rate*100).toFixed(2))
      setComplianceLoading(false)
    })
    return () => { cancelled = true }
  }, [empId, monthLabel, selEmp])

  function calcOverall(compliancePct=0) { const a=parseFloat(attendance)/100,b=parseFloat(accuracy)/100,c=parseFloat(efficiency)/100,d=parseFloat(feedback)/100; if([a,b,c,d].some(isNaN))return null; return a*0.2+b*0.3+c*0.3+d*0.15+(compliancePct*0.05) }
  const compN = compliance !== '' ? parseFloat(compliance)/100 : 0
  const overall = calcOverall(compN)
  const allMonths = ['2024','2025','2026','2027','2028','2029','2030'].flatMap(y => MONTHS.map(m => `${m} ${y}`))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { employee_id:empId, employee_name:selEmp?.name||'', designation:designation||selEmp?.designation||'', month_label:monthLabel, attendance:attendance!==''?parseFloat(attendance)/100:null, accuracy:accuracy!==''?parseFloat(accuracy)/100:null, efficiency:efficiency!==''?parseFloat(efficiency)/100:null, feedback:feedback!==''?parseFloat(feedback)/100:null, compliance_score:compN, overall_score:overall, notes, coached, updated_at:new Date().toISOString() }
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Compliance <span className="text-gray-400 font-normal text-xs">(5%)</span></label>
          <div className="relative"><input type="number" min="0" max="100" step="0.01" value={compliance} onChange={e=>setCompliance(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-7 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="e.g. 100"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span></div>
          <p className="text-xs text-gray-400 mt-1">
            {complianceLoading ? 'Checking coaching + announcement acknowledgments...' :
             complianceAuto && complianceAuto.totalRequired > 0 ? `Auto-calculated: ${(complianceAuto.rate!*100).toFixed(0)}% (${complianceAuto.totalAcked}/${complianceAuto.totalRequired} acknowledged — ${complianceAuto.coachAcked}/${complianceAuto.coachTotal} coaching, ${complianceAuto.annAcked}/${complianceAuto.annTotal} announcements, ${complianceAuto.taskDone}/${complianceAuto.taskTotal} tasks). Edit above to override.` :
             'No coaching or announcements requiring acknowledgment found this month — set manually.'}
          </p>
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
function EmployeeManager({ employees, onChanged, showToast, currentUser, userRole }:
  { employees: Employee[], onChanged: () => void, showToast: (m: string, t?: 'success'|'error') => void, currentUser: string, userRole: string }) {
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newEmpId, setNewEmpId] = useState('')
  const [newDepartments, setNewDepartments] = useState<string[]>([])
  const [newEmpType, setNewEmpType] = useState('Agent')
  const [newClient, setNewClient] = useState(CLIENTS[0])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editEmpId, setEditEmpId] = useState('')
  const [editDepartments, setEditDepartments] = useState<string[]>([])
  const [editEmpType, setEditEmpType] = useState('Agent')
  const [editClient, setEditClient] = useState(CLIENTS[0])
  const [editPortalRole, setEditPortalRole] = useState<string>('agent')
  const [searchQ, setSearchQ] = useState('')
  const [filterClient, setFilterClient] = useState('All')
  const [showInactive, setShowInactive] = useState(false)
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set())
  const canExport = userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead'
  const canManagePhotos = userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead'
  const canEdit = canEditEmployees(userRole)
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({})
  const [uploadingFor, setUploadingFor] = useState<string|null>(null)

  async function loadAvatars() {
    const { data } = await supabase.from('app_users').select('username, avatar_url').not('avatar_url', 'is', null)
    const map: Record<string, string> = {}
    ;(data || []).forEach((u: any) => { if (u.avatar_url) map[u.username.toLowerCase()] = u.avatar_url })
    setAvatarMap(map)
  }

  useEffect(() => { loadAvatars() }, [employees])

  async function uploadAvatarFor(email: string, file: File) {
    if (!email) { showToast('This employee has no work email on file yet — add one first.', 'error'); return }
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return }
    const emailLower = email.trim().toLowerCase()
    setUploadingFor(emailLower)
    try {
      const ext = file.name.split('.').pop()
      const path = `${emailLower}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()
      // Photo lives on app_users.avatar_url. If they don't have a login yet,
      // there's no row to attach it to — surface that clearly rather than
      // silently doing nothing.
      const { data: existing } = await supabase.from('app_users').select('id').eq('username', emailLower).single()
      if (!existing) {
        showToast(`${email} doesn't have a portal login yet — grant access in Settings first, then their photo will save.`, 'error')
        setUploadingFor(null)
        return
      }
      await supabase.from('app_users').update({ avatar_url: publicUrl }).eq('username', emailLower)
      showToast('Photo updated!')
      loadAvatars()
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Upload failed', 'error') }
    setUploadingFor(null)
  }

  async function exportToExcel() {
    const XLSX = await import('xlsx')
    const rows = employees
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(e => ({
        'Employee ID': e.employee_id || '',
        'Name': e.name,
        'Internal Tag (auto-generated)': e.designation,
        'Role': e.employment_type || '',
        'Client': e.client || '',
        'Department(s)': (e.departments || []).join(', '),
        'Work Email': e.email || '',
        'Status': e.active ? 'Active' : 'Inactive',
      }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 32 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Employees')
    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `ABBSS_Employee_Records_${dateStr}.xlsx`)
    showToast('Export downloaded!')
  }

  function toggleDept(dept: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(dept) ? list.filter(d => d !== dept) : [...list, dept])
  }

  async function addEmployee() {
    if (!newName.trim()) return
    // Duplicate check: Employee ID first (most reliable unique identifier),
    // then email, since both should be unique per person/role.
    const empIdTrimmed = newEmpId.trim()
    const emailTrimmed = newEmail.trim().toLowerCase()
    if (empIdTrimmed) {
      const idMatch = employees.find(e => e.employee_id && e.employee_id.trim().toLowerCase() === empIdTrimmed.toLowerCase())
      if (idMatch) {
        showToast(`Employee ID ${empIdTrimmed} already belongs to ${idMatch.name}. Edit that record instead of adding a new one.`, 'error')
        return
      }
    }
    if (emailTrimmed) {
      const emailMatch = employees.find(e => e.email && e.email.trim().toLowerCase() === emailTrimmed)
      if (emailMatch) {
        showToast(`${emailTrimmed} is already used by ${emailMatch.name}. Add a new role for them by editing that record, or use a different email.`, 'error')
        return
      }
    }
    setAdding(true)
    const existingForPerson = employees.filter(e => e.name.trim().toLowerCase() === newName.trim().toLowerCase())
    const generatedDesig = generateDesignation(newEmpType, newClient, existingForPerson)
    const {error} = await supabase.from('employees').insert({
      name:newName.trim(), designation:generatedDesig,
      email:newEmail.trim()||null,
      employee_id: newEmpId.trim()||null,
      departments: newDepartments.length ? newDepartments : null,
      employment_type: newEmpType,
      client: newClient,
      active:true
    })
    if (error) showToast(error.message,'error')
    else { await writeAuditLog('ADD_EMPLOYEE',currentUser,newName.trim(),'','Status','','Active'); setNewName(''); setNewEmail(''); setNewEmpId(''); setNewDepartments([]); setNewEmpType('Agent'); setNewClient(CLIENTS[0]); onChanged() }
    setAdding(false)
  }

  async function saveEdit(id: string) {
    const emp = employees.find(e=>e.id===id)
    const existingForPerson = employees.filter(e => e.name.trim().toLowerCase() === editName.trim().toLowerCase())
    const generatedDesig = generateDesignation(editEmpType, editClient, existingForPerson, id)
    const {error} = await supabase.from('employees').update({name:editName,designation:generatedDesig,email:editEmail||null,employee_id:editEmpId||null,departments:editDepartments.length?editDepartments:null,employment_type:editEmpType,client:editClient}).eq('id',id)
    if (error) { showToast(error.message,'error'); return }
    // Sync to app_users if a work email is present. If the email actually
    // changed, look up their EXISTING login by the OLD email first and
    // rename it -- otherwise this silently creates a duplicate orphaned
    // login account under the new email while the old one lingers forever
    // (this is exactly how stale/incorrect login emails have crept in).
    if (editEmail && editEmail.trim()) {
      const emailLower = editEmail.trim().toLowerCase()
      const oldEmailLower = emp?.email?.trim().toLowerCase()
      let existingUser: any = null
      if (oldEmailLower && oldEmailLower !== emailLower) {
        const { data } = await supabase.from('app_users').select('id,role,email').or(`email.eq.${oldEmailLower},username.eq.${oldEmailLower}`).maybeSingle()
        existingUser = data
      }
      if (!existingUser) {
        const { data } = await supabase.from('app_users').select('id,role,email').or(`email.eq.${emailLower},username.eq.${emailLower}`).maybeSingle()
        existingUser = data
      }

      if (existingUser && existingUser.email?.toLowerCase() !== emailLower) {
        // Found their login under the old email -- rename it rather than
        // creating a second account.
        await supabase.from('app_users').update({ username: emailLower, email: emailLower, ...(editPortalRole ? { role: editPortalRole } : {}) }).eq('id', existingUser.id)
        showToast(`Login email corrected to ${emailLower} (was ${existingUser.email}). They'll log in with the new address going forward.`, 'success')
        fetch('/api/notify/role-changed', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: emailLower, oldRole: existingUser.role, newRole: existingUser.role, changedBy: currentUser || 'admin' }) }).catch(() => {})
      } else if (!existingUser) {
        const tempPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100)
        await supabase.from('app_users').insert({
          username: emailLower, email: emailLower, name: editName,
          role: editPortalRole || 'agent', password_hash: tempPassword,
          must_change_password: true, active: true,
        })
        showToast(`Login created for ${emailLower.split('@')[0]} — temp password: ${tempPassword}`, 'success')
        fetch('/api/notify/user-added', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ newUsername: emailLower, newRole: editPortalRole || 'agent', addedBy: currentUser || 'admin' }) }).catch(() => {})
      } else if (existingUser.role !== editPortalRole && userRole === 'super_admin') {
        await supabase.from('app_users').update({ role: editPortalRole }).eq('id', existingUser.id)
        showToast(`Portal role updated to ${editPortalRole} for ${emailLower.split('@')[0]}`, 'success')
        fetch('/api/notify/role-changed', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: emailLower, oldRole: existingUser.role, newRole: editPortalRole, changedBy: currentUser || 'admin' }) }).catch(() => {})
      }
    }
    await writeAuditLog('EDIT_EMPLOYEE',currentUser,editName,'','Role/Client',emp?.designation||'',generatedDesig)

    // Build a human-readable diff of what actually changed, then email
    // whoever's email is on the record (regardless of portal login).
    const fieldLabels: Record<string,string> = { name: 'Name', email: 'Work Email', employee_id: 'Employee ID', employment_type: 'Role', client: 'Client Supported', departments: 'Department(s)' }
    const before: Record<string, any> = { name: emp?.name, email: emp?.email, employee_id: emp?.employee_id, employment_type: emp?.employment_type, client: emp?.client, departments: (emp?.departments||[]).join(', ') }
    const after: Record<string, any> = { name: editName, email: editEmail||null, employee_id: editEmpId||null, employment_type: editEmpType, client: editClient, departments: editDepartments.join(', ') }
    const changes = Object.keys(fieldLabels)
      .filter(k => String(before[k] ?? '') !== String(after[k] ?? ''))
      .map(k => ({ field: fieldLabels[k], from: before[k] ?? '', to: after[k] ?? '' }))

    const notifyEmail = editEmail?.trim() || emp?.email
    if (changes.length > 0 && notifyEmail) {
      try {
        const res = await fetch('/api/notify/employee-updated', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeName: editName, employeeEmail: notifyEmail, changes, changedBy: currentUser || 'admin' })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          showToast(`Saved, but the notification email failed: ${data.error || 'unknown error'}`, 'error')
        }
      } catch {
        showToast('Saved, but the notification email could not be sent (network error).', 'error')
      }
    }

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
    const matchClient = filterClient === 'All' || e.client === filterClient
    return matchSearch && matchActive && matchClient
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
        <div className="flex items-center gap-2">
          {canExport && <button onClick={exportToExcel} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 font-medium transition"><FileSpreadsheet className="w-3.5 h-3.5"/>Export to Excel</button>}
          <button onClick={()=>setShowInactive(!showInactive)} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${showInactive?'bg-gray-800 text-white border-gray-800':'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{showInactive?'Hide Inactive':'Show Inactive'}</button>
        </div>
      </div>

      {canEdit && (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500"/>Add Employee / Role</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input value={newEmpId} onChange={e=>setNewEmpId(e.target.value)} placeholder="Employee ID (ABBSS-XXXXXX)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Full name (Last, First)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <select value={newEmpType} onChange={e=>setNewEmpType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={newClient} onChange={e=>setNewClient(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Work email (@ab-businesssupport.com)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <button onClick={addEmployee} disabled={adding||!newName.trim()} className="bg-blue-900 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 justify-center"><PlusCircle className="w-4 h-4"/>Add Employee</button>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Department(s) — used for ticket routing and org mapping</p>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map(d => (
              <label key={d} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition ${newDepartments.includes(d) ? DEPT_BADGE_COLORS[d] : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={newDepartments.includes(d)} onChange={()=>toggleDept(d, newDepartments, setNewDepartments)} className="w-3 h-3"/>
                {d}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Work email links to app login. Same person supporting multiple roles/clients? Add them again with a different Role and/or Client.</p>
      </div>
      )}

      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search by name, role, or client..." className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/></div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium">Client:</span>
        {['All', ...CLIENTS].map(c => (
          <button key={c} onClick={()=>setFilterClient(c)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition border ${filterClient===c ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{c}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {groupEntries.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No employees found.</div>}
        {groupEntries.map(([name, emps], gi) => {
          const isMulti = emps.length > 1
          const isExpanded = expandedNames.has(name) || emps.length === 1
          const allActive = emps.every(e => e.active)
          const someActive = emps.some(e => e.active)
          const initial = name.split(',')[0]?.charAt(0) || '?'
          const groupEmail = emps.find(e => e.email)?.email || ''
          const groupAvatarUrl = groupEmail ? avatarMap[groupEmail.toLowerCase()] : undefined
          const isUploadingThis = uploadingFor === groupEmail.toLowerCase()

          return (
            <div key={name} className={gi > 0 ? 'border-t border-gray-200' : ''}>
              {/* Group header row */}
              <div className={`flex items-center gap-3 px-4 py-3 ${isMulti ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'}`} onClick={() => isMulti && toggleExpand(name)}>
                {(canManagePhotos || currentUser?.toLowerCase() === groupEmail.toLowerCase()) && groupEmail ? (
                  <label onClick={e => e.stopPropagation()} className="relative flex-shrink-0 cursor-pointer group" title="Click to upload/change photo">
                    {groupAvatarUrl
                      ? <img src={groupAvatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover"/>
                      : <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${someActive ? avatarColor(name) : 'bg-gray-200'}`}>{initial}</div>
                    }
                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition">
                      {isUploadingThis ? <span className="text-white text-[9px]">...</span> : <span className="text-white text-[10px] opacity-0 group-hover:opacity-100">📷</span>}
                    </div>
                    <input type="file" accept="image/*" className="hidden" disabled={isUploadingThis}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatarFor(groupEmail, f) }}/>
                  </label>
                ) : (
                  groupAvatarUrl
                    ? <img src={groupAvatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0"/>
                    : <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white ${someActive ? avatarColor(name) : 'bg-gray-200'}`}>{initial}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${someActive ? 'text-gray-900' : 'text-gray-400'}`}>{name}</p>
                  {!isExpanded && isMulti && (
                    <p className="text-xs text-gray-500">{emps.map(e=>`${e.employment_type||'Agent'} (${e.client||'AB BSS'})`).join(' - ')}</p>
                  )}
                  {!isMulti && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {emps[0].employment_type && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${EMPLOYMENT_TYPE_COLORS[emps[0].employment_type] || 'bg-gray-100 text-gray-600'}`}>{emps[0].employment_type}</span>}
                      {emps[0].client && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CLIENT_COLORS[emps[0].client] || 'bg-gray-100 text-gray-600'}`}>{emps[0].client}</span>}
                      {emps[0].employee_id && <span className="text-xs font-mono bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">{emps[0].employee_id}</span>}
                      {emps[0].departments && emps[0].departments.map(d => (
                        <span key={d} className={`text-xs px-1.5 py-0.5 rounded border ${DEPT_BADGE_COLORS[d] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>{d}</span>
                      ))}
                    </div>
                  )}
                </div>
                {isMulti && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{emps.length} roles</span>
                )}
                {!isMulti && (
                  <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                    {canEdit ? (
                      <>
                        <button onClick={()=>toggleActive(emps[0])} className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer ${emps[0].active?'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600':'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>{emps[0].active?'Active':'Inactive'}</button>
                        <button onClick={async()=>{setEditId(editId===emps[0].id?null:emps[0].id);setEditName(emps[0].name);setEditEmail(emps[0].email||'');setEditEmpId(emps[0].employee_id||'');setEditDepartments(emps[0].departments||[]);setEditEmpType(emps[0].employment_type||'Agent');setEditClient(emps[0].client||CLIENTS[0]);if(emps[0].email){const el=emps[0].email.toLowerCase();const{data}=await supabase.from('app_users').select('role').or(`email.eq.${el},username.eq.${el}`).single();setEditPortalRole(data?.role||'agent')}else{setEditPortalRole('agent')}}} className={`p-1 ${editId===emps[0].id?'text-blue-600':'text-gray-400 hover:text-blue-600'}`}><Edit2 className="w-4 h-4"/></button>
                        <button onClick={()=>deleteEmployee(emps[0].id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                      </>
                    ) : (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${emps[0].active?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-400'}`}>{emps[0].active?'Active':'Inactive'}</span>
                    )}
                  </div>
                )}
                {isMulti && (
                  <span className="text-gray-400 ml-1">{isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</span>
                )}
              </div>

              {/* Edit panel for single-role employees */}
              {!isMulti && editId === emps[0].id && (
                <div className="border-t border-blue-100 bg-blue-50/40 px-4 py-4" onClick={e=>e.stopPropagation()}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Employee ID</label>
                      <input value={editEmpId} onChange={e=>setEditEmpId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="ABBSS-XXXXXX"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                      <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Last, First"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                      <select value={editEmpType} onChange={e=>setEditEmpType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                        {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Client Supported</label>
                      <select value={editClient} onChange={e=>setEditClient(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                        {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Work Email</label>
                      <input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="@ab-businesssupport.com"/>
                    </div>
                    {userRole === 'super_admin' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Portal Role</label>
                      <select value={editPortalRole} onChange={e=>setEditPortalRole(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                        <option value="agent">Agent</option>
                        <option value="Team Lead">Team Lead</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>
                    )}

                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Department(s)</label>
                    <div className="flex flex-wrap gap-2">
                      {DEPARTMENTS.map(d => (
                        <label key={d} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition ${editDepartments.includes(d) ? DEPT_BADGE_COLORS[d] : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={editDepartments.includes(d)} onChange={()=>toggleDept(d, editDepartments, setEditDepartments)} className="w-3 h-3"/>
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>saveEdit(emps[0].id)} className="flex items-center gap-2 bg-blue-900 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><Save className="w-3.5 h-3.5"/>Save Changes</button>
                    <button onClick={()=>setEditId(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition">Cancel</button>
                  </div>
                </div>
              )}

              {/* Expanded sub-rows for multi-role employees */}
              {isExpanded && isMulti && emps.map((emp, ei) => (
                <div key={emp.id} className="flex items-center gap-3 pl-14 pr-4 py-2.5 border-t border-gray-100 bg-gray-50/50 hover:bg-gray-50">
                  <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                    <span className="text-gray-300 text-lg leading-none">{ei === emps.length-1 ? '+' : '├'}</span>
                  </div>
                  <>
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      {emp.employment_type && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${EMPLOYMENT_TYPE_COLORS[emp.employment_type] || 'bg-gray-100 text-gray-600'}`}>{emp.employment_type}</span>}
                      {emp.client && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CLIENT_COLORS[emp.client] || 'bg-gray-100 text-gray-600'}`}>{emp.client}</span>}
                      {emp.employee_id && <span className="text-xs font-mono bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">{emp.employee_id}</span>}
                      {emp.departments && emp.departments.map(d => (
                        <span key={d} className={`text-xs px-1.5 py-0.5 rounded border ${DEPT_BADGE_COLORS[d] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>{d}</span>
                      ))}
                    </div>
                    {canEdit ? (
                      <>
                        <button onClick={()=>toggleActive(emp)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer flex-shrink-0 ${emp.active?'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600':'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>{emp.active?'Active':'Inactive'}</button>
                        <button onClick={async()=>{setEditId(editId===emp.id?null:emp.id);setEditName(emp.name);setEditEmail(emp.email||'');setEditEmpId(emp.employee_id||'');setEditDepartments(emp.departments||[]);setEditEmpType(emp.employment_type||'Agent');setEditClient(emp.client||CLIENTS[0]);if(emp.email){const el=emp.email.toLowerCase();const{data}=await supabase.from('app_users').select('role').or(`email.eq.${el},username.eq.${el}`).single();setEditPortalRole(data?.role||'agent')}else{setEditPortalRole('agent')}}} className={`p-1 ${editId===emp.id?'text-blue-600':'text-gray-400 hover:text-blue-600'}`}><Edit2 className="w-4 h-4"/></button>
                        <button onClick={()=>deleteEmployee(emp.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                      </>
                    ) : (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${emp.active?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-400'}`}>{emp.active?'Active':'Inactive'}</span>
                    )}
                  </>
                  {editId === emp.id && (
                    <div className="absolute left-0 right-0 border-t border-blue-100 bg-blue-50/40 px-4 py-4 z-10" style={{top:'100%'}} onClick={e=>e.stopPropagation()}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Employee ID</label>
                          <input value={editEmpId} onChange={e=>setEditEmpId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="ABBSS-XXXXXX"/></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                          <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Last, First"/></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                          <select value={editEmpType} onChange={e=>setEditEmpType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Client Supported</label>
                          <select value={editClient} onChange={e=>setEditClient(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Work Email</label>
                          <input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="@ab-businesssupport.com"/></div>
                        {userRole === 'super_admin' && (
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Portal Role</label>
                          <select value={editPortalRole} onChange={e=>setEditPortalRole(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                            <option value="agent">Agent</option>
                            <option value="Team Lead">Team Lead</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                          </select></div>
                        )}

                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Department(s)</label>
                        <div className="flex flex-wrap gap-2">
                          {DEPARTMENTS.map(d => (
                            <label key={d} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition ${editDepartments.includes(d) ? DEPT_BADGE_COLORS[d] : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={editDepartments.includes(d)} onChange={()=>toggleDept(d, editDepartments, setEditDepartments)} className="w-3 h-3"/>
                              {d}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>saveEdit(emp.id)} className="flex items-center gap-2 bg-blue-900 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition"><Save className="w-3.5 h-3.5"/>Save Changes</button>
                        <button onClick={()=>setEditId(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition">Cancel</button>
                      </div>
                    </div>
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
function TeamManager({ employees, showToast, userRole }:
  { employees: Employee[], showToast: (m: string, t?: 'success'|'error') => void, userRole: string }) {
  const canEdit = canManageTeams(userRole)
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newLeadId, setNewLeadId] = useState('')
  const [selTeam, setSelTeam] = useState<string|null>(null)
  const [addMemberId, setAddMemberId] = useState('')
  const [editTeamId, setEditTeamId] = useState<string|null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [editTeamDept, setEditTeamDept] = useState('')

  async function loadTeams() {
    setLoading(true)
    const [{data:t},{data:m}] = await Promise.all([supabase.from('teams').select('*, team_lead:employees(name, email)').order('name'),supabase.from('team_members').select('*, employee:employees(name, designation, employment_type, client, email)')])
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

  async function updateTeam(id: string) {
    if (!editTeamName.trim()) { showToast('Team name cannot be empty', 'error'); return }
    const {error} = await supabase.from('teams').update({name: editTeamName.trim(), department: editTeamDept.trim()}).eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setEditTeamId(null); loadTeams(); showToast('Team updated!')
  }

  async function notifyTeamChange(action: 'added'|'removed', employeeName: string, employeeEmail: string|null, teamName: string, leadEmail: string|null) {
    if (!employeeEmail) return
    try {
      const res = await fetch('/api/notify/team-change', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, employeeName, employeeEmail, teamName, leadEmail })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(`Team updated, but the notification email failed: ${data.error || 'unknown error'}`, 'error')
      }
    } catch {
      showToast('Team updated, but the notification email could not be sent (network error).', 'error')
    }
  }

  async function addMember() {
    if (!selTeam||!addMemberId) return
    const emp = employees.find(e => e.id === addMemberId)
    const team = teams.find(t => t.id === selTeam)
    const {error} = await supabase.from('team_members').insert({team_id:selTeam,employee_id:addMemberId})
    if (error) showToast('Member already in team','error')
    else {
      setAddMemberId(''); loadTeams(); showToast('Member added!')
      if (emp && team) notifyTeamChange('added', emp.name, emp.email, team.name, team.team_lead?.email)
    }
  }

  async function removeMember(id: string) {
    const member = members.find(m => m.id === id)
    const team = teams.find(t => t.id === selTeam)
    await supabase.from('team_members').delete().eq('id',id)
    loadTeams()
    if (member?.employee && team) notifyTeamChange('removed', member.employee.name, member.employee.email, team.name, team.team_lead?.email)
  }
  async function updateLead(teamId: string, leadId: string) { await supabase.from('teams').update({team_lead_id:leadId||null}).eq('id',teamId); loadTeams() }

  const teamMembers = members.filter(m=>m.team_id===selTeam)
  const teamMemberIds = teamMembers.map(m=>m.employee_id)
  const availableToAdd = employees.filter(e=>e.active&&!teamMemberIds.includes(e.id))
  const selectedTeam = teams.find(t=>t.id===selTeam)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-blue-900">Team Management</h2><p className="text-sm text-gray-500">{teams.length} teams configured</p></div>
      {canEdit && (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><PlusCircle className="w-4 h-4 text-blue-500"/>Create New Team</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Team name" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <input value={newDept} onChange={e=>setNewDept(e.target.value)} placeholder="Department" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          <select value={newLeadId} onChange={e=>setNewLeadId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"><option value="">Select team lead...</option>{employees.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <button onClick={createTeam} disabled={!newTeamName.trim()} className="bg-blue-600 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"><PlusCircle className="w-4 h-4"/>Create</button>
        </div>
      </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50"><h3 className="font-semibold text-gray-700 text-sm">All Teams</h3></div>
          {loading?<div className="p-8 text-center text-gray-400">Loading...</div>:teams.length===0?<div className="p-8 text-center text-gray-400 text-sm">No teams yet.</div>:teams.map((team,i)=>(
            <div key={team.id} onClick={()=>editTeamId!==team.id && setSelTeam(team.id)} className={`flex items-center gap-3 px-4 py-3 ${editTeamId===team.id?'':'cursor-pointer'} transition ${i>0?'border-t border-gray-100':''} ${selTeam===team.id?'bg-blue-50':'hover:bg-gray-50'}`}>
              {editTeamId===team.id ? (
                <div className="flex-1 flex flex-col sm:flex-row gap-2" onClick={e=>e.stopPropagation()}>
                  <input value={editTeamName} onChange={e=>setEditTeamName(e.target.value)} placeholder="Team name" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
                  <input value={editTeamDept} onChange={e=>setEditTeamDept(e.target.value)} placeholder="Department" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"/>
                  <div className="flex gap-1">
                    <button onClick={()=>updateTeam(team.id)} className="bg-blue-600 hover:bg-blue-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">Save</button>
                    <button onClick={()=>setEditTeamId(null)} className="text-gray-500 hover:text-gray-700 px-2 py-1.5 text-xs transition">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 text-sm">{team.name}</p><p className="text-xs text-gray-500">{team.department}{team.team_lead?.name?` - Lead: ${team.team_lead.name.split(',')[0]}`:' - No lead'}</p><p className="text-xs text-gray-400">{members.filter(m=>m.team_id===team.id).length} members</p></div>
                  {canEdit && (
                    <>
                      <button onClick={e=>{e.stopPropagation();setEditTeamId(team.id);setEditTeamName(team.name);setEditTeamDept(team.department||'')}} className="text-gray-400 hover:text-blue-600 p-1 transition"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={e=>{e.stopPropagation();deleteTeam(team.id)}} className="text-gray-400 hover:text-red-600 p-1 transition"><Trash2 className="w-4 h-4"/></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {!selTeam?<div className="p-8 text-center text-gray-400 text-sm">Select a team to manage members</div>:(
            <>
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700 text-sm">{selectedTeam?.name} — Members</h3>
                <div className="mt-2 flex items-center gap-2"><span className="text-xs text-gray-500">Team Lead:</span>{canEdit ? (<select value={selectedTeam?.team_lead_id||''} onChange={e=>updateLead(selTeam,e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs text-gray-900"><option value="">No lead assigned</option>{employees.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name.split(',')[0]}</option>)}</select>) : (<span className="text-xs text-gray-700 font-medium">{selectedTeam?.team_lead?.name?.split(',')[0] || 'No lead assigned'}</span>)}</div>
              </div>
              {canEdit && (
              <div className="p-4 border-b border-gray-100">
                <div className="flex gap-2"><select value={addMemberId} onChange={e=>setAddMemberId(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"><option value="">Add member...</option>{availableToAdd.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><button onClick={addMember} disabled={!addMemberId} className="bg-blue-600 hover:bg-blue-900 text-white px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">Add</button></div>
              </div>
              )}
              <div>
                {teamMembers.length===0?<div className="p-6 text-center text-gray-400 text-sm">No members yet</div>:teamMembers.map((m,i)=>(
                  <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 ${i>0?'border-t border-gray-100':''}`}>
                    <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{m.employee?.name?.split(',')[0]?.charAt(0)||'?'}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{m.employee?.name}</p><p className="text-xs text-gray-500">{m.employee?.employment_type||'Agent'} ({m.employee?.client||'AB BSS'})</p></div>
                    <button onClick={()=>removeMember(m.id)} className={`text-gray-400 hover:text-red-600 p-1 transition ${canEdit ? '' : 'invisible'}`}><X className="w-3.5 h-3.5"/></button>
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
  const [resettingId, setResettingId] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const roleColors: Record<string,string> = { super_admin: 'bg-purple-50 text-purple-700', admin: 'bg-blue-50 text-blue-700', 'Team Lead': 'bg-emerald-50 text-emerald-700', agent: 'bg-gray-100 text-gray-600' }
  const roleLabels: Record<string,string> = { super_admin: 'Super Admin', admin: 'Admin', 'Team Lead': 'Team Lead', agent: 'Agent' }

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('app_users').select('id,username,email,role,active,created_at,must_change_password').order('role').order('username')
    setAppUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function resetPassword(u: any) {
    setResettingId(u.id)
    setSaving(true)
    const tempPass = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 900 + 100)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username: u.username, newPassword: tempPass, adminReset: true })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      await supabase.from('app_users').update({ must_change_password: true }).eq('id', u.id)
      // Send email notification to the user
      fetch('/api/notify/password-reset', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username: u.username, tempPassword: tempPass, resetBy: currentUser })
      }).catch(() => {})
      showToast(`Password reset! Email sent to ${u.username.split('@')[0]} with their temp password.`, 'success')
      loadUsers()
    } catch(err:unknown) { showToast(err instanceof Error ? err.message : 'Failed', 'error') }
    setSaving(false)
    setResettingId(null)
  }

  async function changeRole(u: any, newRole: string) {
    if (newRole === u.role) return
    const { error } = await supabase.from('app_users').update({ role: newRole }).eq('id', u.id)
    if (error) { showToast(error.message, 'error'); return }
    showToast(`Role updated for ${u.username.split('@')[0]}`, 'success')
    loadUsers()
    fetch('/api/notify/role-changed', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: u.username, oldRole: u.role, newRole, changedBy: currentUser || 'admin' })
    }).catch(() => {})
  }

  async function toggleActive(u: any) {
    await supabase.from('app_users').update({ active: !u.active }).eq('id', u.id)
    showToast(`${u.username.split('@')[0]} ${!u.active ? 'activated' : 'deactivated'}`, 'success')
    loadUsers()
  }

  async function deleteUser(u: any) {
    if (!confirm(`Permanently delete "${u.username}"? This cannot be undone.`)) return
    await supabase.from('app_users').delete().eq('id', u.id)
    showToast('User deleted', 'success')
    loadUsers()
  }

  const filtered = appUsers.filter(u =>
    !searchQ || u.username.toLowerCase().includes(searchQ.toLowerCase())
  )

  // Group by role
  const grouped: Record<string, any[]> = {}
  filtered.forEach(u => {
    const r = u.role || 'agent'
    if (!grouped[r]) grouped[r] = []
    grouped[r].push(u)
  })
  const roleOrder = ['super_admin', 'admin', 'Team Lead', 'agent']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-500 mt-0.5">Manage portal access, roles, and passwords. To grant new access, go to <span className="font-medium text-blue-700">People → Employees</span> and edit the employee's portal role.</p>
        </div>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search users..." className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 w-56" />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-4">
          {roleOrder.filter(r => grouped[r]?.length > 0).map(role => (
            <div key={role} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[role]}`}>{roleLabels[role] || role}</span>
                <span className="text-xs text-gray-400">{grouped[role].length} user{grouped[role].length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {grouped[role].map(u => (
                  <div key={u.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <UserAvatar username={u.username} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${u.active ? 'text-gray-900' : 'text-gray-400'}`}>{u.username}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">Added {new Date(u.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                          {u.must_change_password && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0 rounded-full">Must change password</span>}
                          {!u.active && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0 rounded-full">Inactive</span>}
                        </div>
                      </div>
                      {/* Role selector — super_admin can change all, admin can't touch super_admin */}
                      {(currentUserRole === 'super_admin' || (currentUserRole === 'admin' && u.role !== 'super_admin')) ? (
                        <select value={u.role} onChange={e => changeRole(u, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${roleColors[u.role]||'bg-gray-100 text-gray-600'}`}>
                          {currentUserRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
                          <option value="admin">Admin</option>
                          <option value="Team Lead">Team Lead</option>
                          <option value="agent">Agent</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role]||'bg-gray-100 text-gray-600'}`}>{roleLabels[u.role]||u.role}</span>
                      )}
                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => toggleActive(u)} title={u.active ? 'Deactivate' : 'Activate'}
                          className={`text-xs px-2 py-1 rounded-lg transition ${u.active ? 'bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'}`}>
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => resetPassword(u)} disabled={saving && resettingId === u.id}
                          className="text-xs px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition disabled:opacity-50">
                          {saving && resettingId === u.id ? '...' : '🔑 Reset PW'}
                        </button>
                        {currentUserRole === 'super_admin' && u.username !== currentUser && (
                          <button onClick={() => deleteUser(u)} className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition">×</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No users found.</div>}
        </div>
      )}
    </div>
  )
}




// -- Directory Links ---------------------------------------------------------

// -- Directory Links ---------------------------------------------------------

// -- Huddle Notes ------------------------------------------------------------
function HuddleNotes({ currentUser, userRole, showToast }: { currentUser: string | null, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const canCreate = ['super_admin','admin','Team Lead'].includes(userRole)
  const [huddles, setHuddles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allUsers, setAllUsers] = useState<{username: string, display_name: string | null, client: string | null}[]>([])
  const [participantSearch, setParticipantSearch] = useState('')
  const [participantClient, setParticipantClient] = useState<string>('All')
  const [viewHuddle, setViewHuddle] = useState<any | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    huddle_date: new Date().toISOString().slice(0,16),
    agenda: '',
    participants: [] as string[],
    attachments: [] as {name:string,url:string,type:string}[],
  })

  useEffect(() => { loadHuddles(); loadUsers() }, [])

  async function loadHuddles() {
    setLoading(true)
    let q = supabase.from('huddle_notes').select('*').order('huddle_date', { ascending: false })
    const { data } = await q
    setHuddles(data || [])
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase.from('employees').select('name, email, client').eq('active', true).order('name')
    setAllUsers((data || []).map((e: any) => ({ username: e.email || e.name, display_name: e.name, client: e.client || null })))
  }

  function toggleParticipant(email: string) {
    setForm(p => ({
      ...p,
      participants: p.participants.includes(email)
        ? p.participants.filter(e => e !== email)
        : [...p.participants, email]
    }))
  }

  async function uploadFile(file: File) {
    setUploading(true)
    const path = `huddles/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const type = file.type.startsWith('image/') ? 'image' : ext === 'pdf' ? 'pdf' : 'doc'
    setForm(p => ({ ...p, attachments: [...p.attachments, { name: file.name, url: urlData.publicUrl, type }] }))
    setUploading(false)
  }

  async function saveHuddle() {
    if (!form.title.trim() || !form.huddle_date || !currentUser) return
    setSaving(true)
    const { data, error } = await supabase.from('huddle_notes').insert({
      title: form.title.trim(),
      huddle_date: form.huddle_date,
      agenda: form.agenda.trim(),
      participants: form.participants,
      attachments: form.attachments,
      created_by: currentUser,
    }).select().single()

    if (error) { showToast(error.message, 'error'); setSaving(false); return }

    // In-portal notifications
    if (form.participants.length > 0) {
      await supabase.from('notifications').insert(
        form.participants
          .filter(e => e !== currentUser)
          .map(email => ({
            recipient_email: email,
            type: 'huddle',
            title: `Huddle Notes: ${form.title.trim()}`,
            body: `You were listed as a participant in a huddle on ${new Date(form.huddle_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}.`,
            reference_id: data.id,
          }))
      )

      // Email notifications
      fetch('/api/notify/huddle-created', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: form.participants,
          title: form.title.trim(),
          huddleDate: form.huddle_date,
          agenda: form.agenda.trim(),
          createdBy: currentUser,
        })
      }).catch(() => {})
    }

    showToast('Huddle saved & participants notified!', 'success')
    setForm({ title: '', huddle_date: new Date().toISOString().slice(0,16), agenda: '', participants: [], attachments: [] })
    setShowForm(false)
    loadHuddles()
    setSaving(false)
  }

  // Export helpers
  function exportCSV() {
    const filtered = filteredHuddles()
    const rows = [
      ['Date','Title','Participants','Agenda','Created By'],
      ...filtered.map(h => [
        new Date(h.huddle_date).toLocaleDateString(),
        h.title,
        (h.participants||[]).join('; '),
        (h.agenda||'').replace(/\n/g,' '),
        h.created_by,
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'huddle-notes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function exportPrint() {
    const filtered = filteredHuddles()
    const html = `<html><head><title>Huddle Notes</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin-bottom:24px}.huddle{border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px}.huddle h2{font-size:15px;margin:0 0 8px}.meta{color:#6b7280;font-size:13px;margin-bottom:8px}.agenda{background:#f9fafb;padding:12px;border-radius:6px;font-size:13px;white-space:pre-wrap}</style></head><body><h1>Huddle Notes Export</h1>${filtered.map(h=>`<div class="huddle"><h2>${h.title}</h2><div class="meta">📅 ${new Date(h.huddle_date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} &nbsp;|&nbsp; 👤 ${h.created_by.split('@')[0]} &nbsp;|&nbsp; 👥 ${(h.participants||[]).map((e:string)=>e.split('@')[0]).join(', ')}</div>${h.agenda?`<div class="agenda">${h.agenda}</div>`:''}</div>`).join('')}</body></html>`
    const w = window.open('','_blank'); w?.document.write(html); w?.document.close(); w?.print()
  }

  function filteredHuddles() {
    return huddles.filter(h => {
      const d = new Date(h.huddle_date)
      if (filterFrom && d < new Date(filterFrom)) return false
      if (filterTo && d > new Date(filterTo + 'T23:59:59')) return false
      return true
    })
  }

  const filtered = filteredHuddles()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">Team Huddle Notes</h3>
          <p className="text-xs text-gray-500 mt-0.5">Record meeting notes and notify participants automatically</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <div className="flex gap-1">
              <button onClick={exportCSV} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 hover:bg-emerald-100 text-emerald-700 border border-green-200 transition">⬇ CSV</button>
              <button onClick={exportPrint} className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition">🖨 Print</button>
            </div>
          )}
          {canCreate && <button onClick={() => setShowForm(v=>!v)} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showForm ? 'Cancel' : '+ New Huddle'}</button>}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-gray-900 text-sm">New Huddle Note</h4>
          <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Huddle title (e.g. Weekly Team Huddle)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <div>
            <label className="text-xs text-gray-500 font-medium">Date & Time</label>
            <input type="datetime-local" value={form.huddle_date} onChange={e => setForm(p=>({...p,huddle_date:e.target.value}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Agenda / Notes</label>
            <textarea value={form.agenda} onChange={e => setForm(p=>({...p,agenda:e.target.value}))} placeholder="What was discussed, decisions made, key points..." rows={5} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium">Participants <span className="text-gray-400">({form.participants.length} selected)</span></label>
              <button
                onClick={() => {
                  const allEmails = allUsers.map(u => u.username)
                  const allSelected = allEmails.every(e => form.participants.includes(e))
                  setForm(p => ({ ...p, participants: allSelected ? [] : allEmails }))
                }}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2 py-1 rounded-lg transition">
                {allUsers.every(u => form.participants.includes(u.username)) ? '✕ Deselect All' : '✓ Select All'}
              </button>
            </div>
            {/* Client filter */}
            <div className="flex gap-1 flex-wrap mb-2">
              {(['All', 'EMMA', 'AB BSS', 'Harlan + Holden'] as string[]).map(c => (
                <button key={c} onClick={() => setParticipantClient(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${participantClient === c ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {c}
                </button>
              ))}
            </div>
            {/* Search box */}
            <input
              value={participantSearch}
              onChange={e => setParticipantSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 mb-2"
            />
            {/* Selected chips */}
            {form.participants.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {form.participants.map(email => {
                  const u = allUsers.find(u => u.username === email)
                  return (
                    <span key={email} className="flex items-center gap-1 text-xs bg-blue-900 text-white px-2 py-1 rounded-full">
                      {u?.display_name || email.split('@')[0]}
                      <button onClick={() => toggleParticipant(email)} className="hover:text-blue-200 ml-0.5">×</button>
                    </span>
                  )
                })}
              </div>
            )}
            {/* Filtered dropdown list */}
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
              {allUsers
                .filter(u => {
                  const search = participantSearch.toLowerCase()
                  const matchSearch = !search || (u.display_name || '').toLowerCase().includes(search) || u.username.toLowerCase().includes(search)
                  const matchClient = participantClient === 'All' || u.client === participantClient
                  return matchSearch && matchClient
                })
                .map(u => (
                  <button key={u.username} onClick={() => toggleParticipant(u.username)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition hover:bg-gray-50 ${form.participants.includes(u.username) ? 'bg-blue-50' : ''}`}>
                    <div>
                      <span className={`font-medium ${form.participants.includes(u.username) ? 'text-blue-900' : 'text-gray-900'}`}>{u.display_name || u.username.split('@')[0]}</span>
                      {u.display_name && <span className="text-xs text-gray-400 ml-2">{u.username}</span>}
                    </div>
                    {form.participants.includes(u.username) && <span className="text-blue-600 text-xs font-medium">✓</span>}
                  </button>
                ))
              }
              {allUsers.filter(u => {
                const s = participantSearch.toLowerCase()
                const matchSearch = !s || (u.display_name||'').toLowerCase().includes(s) || u.username.toLowerCase().includes(s)
                const matchClient = participantClient === 'All' || u.client === participantClient
                return matchSearch && matchClient
              }).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">No employees found</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Attachments</label>
            <div className="mt-1 flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50">{uploading ? '⏳ Uploading...' : '📎 Attach File'}</button>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx" onChange={async e => { for (const f of Array.from(e.target.files||[])) await uploadFile(f) }} className="hidden" />
            </div>
            {form.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.attachments.map((a,i) => (
                  <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs">
                    <span>{a.type==='image'?'🖼':a.type==='pdf'?'📄':'📎'}</span>
                    <span className="text-gray-700 max-w-xs truncate">{a.name}</span>
                    <button onClick={() => setForm(p=>({...p,attachments:p.attachments.filter((_,j)=>j!==i)}))} className="text-gray-400 hover:text-red-500 ml-1">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={saveHuddle} disabled={saving||uploading||!form.title.trim()} className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{saving ? 'Saving...' : 'Save & Notify Participants'}</button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {huddles.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <span className="text-xs text-gray-500 font-medium">Filter by date:</span>
          <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
          {(filterFrom||filterTo) && <button onClick={()=>{setFilterFrom('');setFilterTo('')}} className="text-xs text-blue-600 hover:underline">Clear</button>}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {huddles.length} huddles</span>
        </div>
      )}

      {/* Huddle list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">{huddles.length === 0 ? 'No huddle notes yet. Create your first one!' : 'No huddles in this date range.'}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(h => (
            <div key={h.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition cursor-pointer" onClick={() => setViewHuddle(viewHuddle?.id===h.id ? null : h)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{h.title}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">📅 {new Date(h.huddle_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})} · {new Date(h.huddle_date).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
                    <span className="text-xs text-gray-500">👤 {h.created_by.split('@')[0]}</span>
                    <span className="text-xs text-gray-500">👥 {(h.participants||[]).length} participants</span>
                  </div>
                </div>
                <span className="text-gray-400 text-xs flex-shrink-0">{viewHuddle?.id===h.id ? '▲' : '▼'}</span>
              </div>
              {viewHuddle?.id===h.id && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4" onClick={e=>e.stopPropagation()}>
                  {h.agenda && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Agenda / Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{h.agenda}</p>
                    </div>
                  )}
                  {(h.participants||[]).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Participants</p>
                      <div className="flex flex-wrap gap-1">
                        {(h.participants as string[]).map(e => (
                          <span key={e} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{e.split('@')[0]}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(h.attachments||[]).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {(h.attachments as any[]).map((a,i) => (
                          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-1.5 text-xs text-blue-700 transition">
                            <span>{a.type==='image'?'🖼':a.type==='pdf'?'📄':'📎'}</span><span className="truncate max-w-xs">{a.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {viewHuddle && false && null}
    </div>
  )
}

// -- Operating Cadence ----------------------------------------------
// -- Operating Cadence: checklist items with stable IDs per frequency.
// Used by both the tracker UI and the compliance calculation, so this
// is the single source of truth for what counts as a cadence item.
type CadenceItem = { id: string, frequency: 'daily' | 'weekly' | 'monthly', label: string }

const CADENCE_ITEMS: CadenceItem[] = [
  // Daily
  { id: 'd-attendance', frequency: 'daily', label: 'Review attendance' },
  { id: 'd-workload', frequency: 'daily', label: 'Review workload and queues' },
  { id: 'd-sla', frequency: 'daily', label: 'Check SLA/KPI risks' },
  { id: 'd-assist', frequency: 'daily', label: 'Identify employees needing assistance' },
  { id: 'd-escalate', frequency: 'daily', label: 'Escalate urgent operational issues' },
  { id: 'd-blockers', frequency: 'daily', label: 'Answer questions and remove blockers' },
  { id: 'd-monitor', frequency: 'daily', label: 'Monitor productivity' },
  { id: 'd-recognize', frequency: 'daily', label: 'Recognize good performance immediately' },
  // Weekly
  { id: 'w-huddle', frequency: 'weekly', label: 'Monday Team Huddle (30-45 min)' },
  { id: 'w-catchup', frequency: 'weekly', label: 'Midweek Catch-up (Wed/Thu)' },
  { id: 'w-report', frequency: 'weekly', label: 'Friday Performance Tracking report submitted' },
  // Monthly
  { id: 'm-coach1', frequency: 'monthly', label: 'Coaching Session #1 (Week 2)' },
  { id: 'm-coach2', frequency: 'monthly', label: 'Coaching Session #2 (Week 4)' },
  { id: 'm-review', frequency: 'monthly', label: 'Monthly Performance Review completed' },
  { id: 'm-talent', frequency: 'monthly', label: 'Talent Review completed' },
  { id: 'm-process', frequency: 'monthly', label: 'Process Improvement Review completed' },
]

// Returns the period key for "today" at a given frequency, so a Daily
// item resets every new day, Weekly resets every Monday, Monthly resets
// every 1st of the month -- per spec, fully automatic, no manual reset.
function currentPeriodKey(frequency: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date()
  if (frequency === 'daily') return now.toISOString().slice(0, 10)
  if (frequency === 'monthly') return now.toISOString().slice(0, 7)
  // weekly: key = the Monday of this week
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  return monday.toISOString().slice(0, 10)
}

// Returns the last N period keys for a frequency, oldest first, so a
// history graph can be built going backward from today -- e.g. last
// 14 days, last 8 weeks (Mondays), last 6 months.
function historicalPeriodKeys(frequency: 'daily' | 'weekly' | 'monthly', count: number): { key: string, label: string }[] {
  const out: { key: string, label: string }[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    if (frequency === 'daily') {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      out.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
    } else if (frequency === 'monthly') {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) })
    } else {
      // weekly: i weeks before this week's Monday
      const day = now.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() + diffToMonday)
      const d = new Date(thisMonday)
      d.setDate(thisMonday.getDate() - i * 7)
      out.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
    }
  }
  return out
}

function OperatingCadence({ currentUser, userRole, showToast }: { currentUser: string | null, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [tab, setTab] = useState<'daily'|'weekly'|'monthly'|'deliverables'|'compliance'|'manage'|'huddle'>('daily')
  const [completions, setCompletions] = useState<Record<string, { done: boolean, note: string }>>({})
  const [cadenceItems, setCadenceItems] = useState<CadenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const canViewCompliance = userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead'
  const canManageItems = userRole === 'super_admin' || userRole === 'admin'

  // Add task form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ label: '', frequency: 'daily' as 'daily'|'weekly'|'monthly' })
  const [addSaving, setAddSaving] = useState(false)

  async function loadCadenceItems() {
    const { data } = await supabase.from('cadence_items').select('*').is('retired_at', null).order('frequency').order('sort_order')
    setCadenceItems((data || []) as CadenceItem[])
    return data || []
  }

  async function loadCompletions(items: CadenceItem[]) {
    if (!currentUser || items.length === 0) { setLoading(false); return }
    const periods = items.map(it => currentPeriodKey(it.frequency))
    const { data } = await supabase.from('cadence_completions')
      .select('*')
      .eq('team_lead_email', currentUser.toLowerCase())
      .in('period_key', Array.from(new Set(periods)))
    const map: Record<string, { done: boolean, note: string }> = {}
    ;(data || []).forEach((row: any) => { map[`${row.item_id}__${row.period_key}`] = { done: row.done, note: row.note || '' } })
    setCompletions(map)
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    loadCadenceItems().then(items => loadCompletions(items as CadenceItem[]))
  }, [currentUser])

  function keyFor(item: CadenceItem) { return `${item.id}__${currentPeriodKey(item.frequency)}` }

  async function toggleItem(item: CadenceItem) {
    if (!currentUser) return
    const k = keyFor(item)
    const current = completions[k]
    const nextDone = !current?.done
    setSavingId(item.id)
    await supabase.from('cadence_completions').upsert({
      team_lead_email: currentUser.toLowerCase(),
      item_id: item.id,
      frequency: item.frequency,
      period_key: currentPeriodKey(item.frequency),
      done: nextDone,
      note: current?.note || '',
    }, { onConflict: 'team_lead_email,item_id,period_key' })
    setCompletions(prev => ({ ...prev, [k]: { done: nextDone, note: current?.note || '' } }))
    setSavingId(null)
  }

  async function saveNote(item: CadenceItem, note: string) {
    if (!currentUser) return
    const k = keyFor(item)
    const current = completions[k]
    await supabase.from('cadence_completions').upsert({
      team_lead_email: currentUser.toLowerCase(),
      item_id: item.id,
      frequency: item.frequency,
      period_key: currentPeriodKey(item.frequency),
      done: current?.done || false,
      note,
    }, { onConflict: 'team_lead_email,item_id,period_key' })
    setCompletions(prev => ({ ...prev, [k]: { done: current?.done || false, note } }))
  }

  async function addItem() {
    if (!addForm.label.trim()) return
    setAddSaving(true)
    const id = `${addForm.frequency.charAt(0)}-${addForm.label.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,30)}-${Date.now()}`
    const maxOrder = cadenceItems.filter(i => i.frequency === addForm.frequency).length + 1
    const { error } = await supabase.from('cadence_items').insert({
      id, frequency: addForm.frequency, label: addForm.label.trim(), sort_order: maxOrder
    })
    if (error) { showToast(error.message, 'error') }
    else {
      showToast('Task added!', 'success')
      setAddForm({ label: '', frequency: 'daily' })
      setShowAddForm(false)
      const items = await loadCadenceItems()
      await loadCompletions(items as CadenceItem[])
    }
    setAddSaving(false)
  }

  async function retireItem(id: string) {
    const { error } = await supabase.from('cadence_items').update({ retired_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast(error.message, 'error') }
    else {
      showToast('Task retired (hidden from checklist, history preserved)', 'success')
      const items = await loadCadenceItems()
      await loadCompletions(items as CadenceItem[])
    }
  }

  const CheckItem = ({ item }: { item: CadenceItem }) => {
    const k = keyFor(item)
    const state = completions[k] || { done: false, note: '' }
    const [noteDraft, setNoteDraft] = useState(state.note)
    const [showNote, setShowNote] = useState(false)
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="flex items-start gap-3">
          <button onClick={() => toggleItem(item)} disabled={savingId === item.id}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${state.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-blue-400'}`}>
            {state.done && <CheckCircle className="w-3.5 h-3.5 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${state.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</p>
            {!showNote && !state.note && (
              <button onClick={() => setShowNote(true)} className="text-xs text-blue-600 hover:underline mt-1">+ Add note</button>
            )}
            {(showNote || state.note) && (
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                onBlur={() => saveNote(item, noteDraft)}
                placeholder="What did you accomplish? (optional)"
                rows={2}
                className="mt-1.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  const Card = ({ title, items }: { title: string, items: CadenceItem[] }) => (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
      <h4 className="font-semibold text-gray-900 text-sm mb-1">{title}</h4>
      {items.length === 0 ? <p className="text-sm text-gray-400">No tasks yet.</p> : items.map(item => <CheckItem key={item.id} item={item} />)}
    </div>
  )

  const dailyItems = cadenceItems.filter(i => i.frequency === 'daily')
  const weeklyItems = cadenceItems.filter(i => i.frequency === 'weekly')
  const monthlyItems = cadenceItems.filter(i => i.frequency === 'monthly')

  const tabs: [string,string][] = [
    ['daily','Daily'],['weekly','Weekly'],['monthly','Monthly'],['deliverables','Deliverables'],
    ...(canViewCompliance ? [['compliance','Compliance']] as [string,string][] : []),
    ['huddle','📋 Team Huddle'],
    ...(canManageItems ? [['manage','⚙ Manage Tasks']] as [string,string][] : []),
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-blue-900">Team Leader Operating Cadence</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your daily, weekly, and monthly rhythm for effective team leadership</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(([key,label]) => (
          <button key={key} onClick={() => setTab(key as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab===key ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : (
      <>
      {tab === 'daily' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">⏱️ <strong>15-30 minutes</strong> at the start of each shift — resets automatically each new day</div>
          <Card title="Daily Operations Check" items={dailyItems} />
          <div className="bg-green-50 border border-emerald-100 rounded-xl p-3 text-sm text-green-800"><strong>Output:</strong> Risks identified + immediate action plan</div>
        </div>
      )}

      {tab === 'weekly' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">Resets automatically every Monday</div>
          <Card title="This Week" items={weeklyItems} />
          <div className="bg-green-50 border border-emerald-100 rounded-xl p-3 text-sm text-green-800"><strong>Tip:</strong> Track weekly to spot trends before month-end</div>
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">Resets automatically on the 1st of each month</div>
          <Card title="This Month" items={monthlyItems} />
        </div>
      )}

      {tab === 'deliverables' && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="text-left px-4 py-2 font-semibold text-gray-700">Deliverable</th><th className="text-left px-4 py-2 font-semibold text-gray-700">Frequency</th></tr></thead>
              <tbody>
                {[['Weekly team huddle','Weekly'],['Weekly catch-up meeting','Weekly'],['Weekly volume & KPI report','Weekly'],['Coaching sessions (min 2/employee)','Monthly'],['Monthly team performance report','Monthly'],['Recognition summary','Monthly'],['Training needs assessment','Monthly'],['Process improvement recommendations','Monthly'],['Escalation & risk summary','Monthly']].map((row,i)=>(
                  <tr key={i} className="border-t border-gray-100"><td className="px-4 py-2 text-gray-700">{row[0]}</td><td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${row[1]==='Weekly'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{row[1]}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <h4 className="font-semibold text-amber-900 text-sm mb-2">Manager-to-TL Cadence</h4>
            <ul className="space-y-1 text-sm text-amber-800">
              <li>• <strong>Weekly</strong> ops sync (30-45 min)</li>
              <li>• <strong>Monthly</strong> 1-on-1 (45-60 min)</li>
              <li>• <strong>Monthly</strong> business review</li>
              <li>• <strong>Quarterly</strong> leadership review</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'compliance' && canViewCompliance && (
        <CadenceCompliance currentUser={currentUser} userRole={userRole} cadenceItems={cadenceItems} showToast={showToast} />
      )}

      {tab === 'huddle' && (
        <HuddleNotes currentUser={currentUser} userRole={userRole} showToast={showToast} />
      )}

      {tab === 'manage' && canManageItems && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
            ⚠️ <strong>Retiring a task</strong> hides it from the checklist but preserves all historical completion data. Scores from past periods are not affected.
          </div>

          {/* Add new task */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 text-sm">Add New Task</h4>
              <button onClick={() => setShowAddForm(v => !v)} className="text-xs bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showAddForm ? 'Cancel' : '+ Add Task'}</button>
            </div>
            {showAddForm && (
              <div className="space-y-3 pt-1">
                <input value={addForm.label} onChange={e => setAddForm(p=>({...p,label:e.target.value}))} placeholder="Task description..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
                <div className="flex items-center gap-3">
                  <select value={addForm.frequency} onChange={e => setAddForm(p=>({...p,frequency:e.target.value as any}))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <button onClick={addItem} disabled={addSaving || !addForm.label.trim()} className="ml-auto bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{addSaving ? 'Adding...' : 'Add Task'}</button>
                </div>
              </div>
            )}
          </div>

          {/* Current active tasks by frequency */}
          {(['daily','weekly','monthly'] as const).map(freq => {
            const items = cadenceItems.filter(i => i.frequency === freq)
            return (
              <div key={freq} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="font-semibold text-gray-700 text-sm capitalize">{freq} Tasks</span>
                  <span className="text-xs text-gray-400">{items.length} active</span>
                </div>
                {items.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No active tasks.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                        <span className="text-sm text-gray-700">{item.label}</span>
                        <button onClick={() => { if (confirm(`Retire "${item.label}"? It will be hidden from checklists but history is preserved.`)) retireItem(item.id) }}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition flex-shrink-0 ml-4">
                          Retire
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>
      )}
    </div>
  )
}

// -- Cadence Compliance: % of cadence items completed, per Team Lead.
// Manager/Super Admin see everyone; Team Lead sees only their own.
// Uses live cadence_items count so scores stay accurate after add/retire.
function CadenceCompliance({ currentUser, userRole, cadenceItems, showToast }: { currentUser: string | null, userRole: string, cadenceItems: CadenceItem[], showToast: (m: string, t?: 'success'|'error') => void }) {
  const isManager = userRole === 'super_admin' || userRole === 'admin'
  const [currentRates, setCurrentRates] = useState<{ email: string, daily: number, weekly: number, monthly: number }[]>([])
  const [loadingCurrent, setLoadingCurrent] = useState(true)

  const [historyFreq, setHistoryFreq] = useState<'daily'|'weekly'|'monthly'>('daily')
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)

  const FREQ_HISTORY_LENGTH = { daily: 14, weekly: 8, monthly: 6 }

  async function loadCurrentRates() {
    setLoadingCurrent(true)
    const byFreq: Record<'daily'|'weekly'|'monthly', string> = {
      daily: currentPeriodKey('daily'), weekly: currentPeriodKey('weekly'), monthly: currentPeriodKey('monthly'),
    }
    let q = supabase.from('cadence_completions').select('team_lead_email, frequency, done, period_key')
      .in('period_key', Object.values(byFreq))
    if (!isManager && currentUser) q = q.eq('team_lead_email', currentUser.toLowerCase())
    const { data } = await q

    const totals = {
      daily: cadenceItems.filter(i => i.frequency === 'daily').length,
      weekly: cadenceItems.filter(i => i.frequency === 'weekly').length,
      monthly: cadenceItems.filter(i => i.frequency === 'monthly').length,
    }
    const byEmail: Record<string, { daily: number, weekly: number, monthly: number }> = {}
    ;(data || []).forEach((row: any) => {
      if (row.period_key !== byFreq[row.frequency as 'daily'|'weekly'|'monthly']) return
      if (!row.done) return
      if (!byEmail[row.team_lead_email]) byEmail[row.team_lead_email] = { daily: 0, weekly: 0, monthly: 0 }
      byEmail[row.team_lead_email][row.frequency as 'daily'|'weekly'|'monthly']++
    })
    const emails = isManager ? Object.keys(byEmail) : (currentUser ? [currentUser.toLowerCase()] : [])
    const result = emails.map(email => {
      const c = byEmail[email] || { daily: 0, weekly: 0, monthly: 0 }
      return {
        email,
        daily: totals.daily ? Math.round((c.daily / totals.daily) * 100) : 0,
        weekly: totals.weekly ? Math.round((c.weekly / totals.weekly) * 100) : 0,
        monthly: totals.monthly ? Math.round((c.monthly / totals.monthly) * 100) : 0,
      }
    })
    setCurrentRates(result)
    if (!selectedEmail && result.length > 0) setSelectedEmail(result[0].email)
    setLoadingCurrent(false)
  }

  async function loadHistory() {
    if (!selectedEmail) { setHistoryData([]); setLoadingHistory(false); return }
    setLoadingHistory(true)
    const periods = historicalPeriodKeys(historyFreq, FREQ_HISTORY_LENGTH[historyFreq])
    const periodKeys = periods.map(p => p.key)
    const { data } = await supabase.from('cadence_completions')
      .select('period_key, done')
      .eq('team_lead_email', selectedEmail)
      .eq('frequency', historyFreq)
      .in('period_key', periodKeys)

    const total = cadenceItems.filter(i => i.frequency === historyFreq).length
    const doneByPeriod: Record<string, number> = {}
    ;(data || []).forEach((row: any) => { if (row.done) doneByPeriod[row.period_key] = (doneByPeriod[row.period_key] || 0) + 1 })

    const chartData = periods.map(p => ({
      label: p.label,
      rate: total > 0 ? Math.round(((doneByPeriod[p.key] || 0) / total) * 100) : 0,
    }))
    setHistoryData(chartData)
    setLoadingHistory(false)
  }

  useEffect(() => { loadCurrentRates() }, [currentUser, userRole, cadenceItems])
  useEffect(() => { loadHistory() }, [selectedEmail, historyFreq, cadenceItems])

  const RateBadge = ({ label, value }: { label: string, value: number }) => (
    <div className="text-center">
      <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-sm font-bold ${value >= 80 ? 'bg-emerald-100 text-emerald-700' : value >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{value}%</div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-600">
        Daily, Weekly, and Monthly each show their own compliance rate for the current period. {isManager ? 'Showing all Team Leads with activity.' : 'Showing your own compliance.'}
      </div>

      {loadingCurrent ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : currentRates.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No cadence activity recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {currentRates.map(r => (
            <button key={r.email} onClick={() => setSelectedEmail(r.email)}
              className={`w-full bg-white border rounded-xl p-4 flex items-center gap-5 text-left transition ${selectedEmail === r.email ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{r.email.split('@')[0]}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedEmail === r.email ? 'Viewing history below' : 'Click to view history'}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <RateBadge label="Daily" value={r.daily} />
                <RateBadge label="Weekly" value={r.weekly} />
                <RateBadge label="Monthly" value={r.monthly} />
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedEmail && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-semibold text-gray-900 text-sm">History — {selectedEmail.split('@')[0]}</h4>
            <div className="flex gap-1">
              {(['daily','weekly','monthly'] as const).map(f => (
                <button key={f} onClick={() => setHistoryFreq(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${historyFreq === f ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
          </div>
          {loadingHistory ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading history...</div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={historyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Compliance']} />
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="rate" stroke="#1e3a8a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-gray-400">Green dashed line = 80% target. Dips below show missed days/weeks/months at a glance.</p>
        </div>
      )}
    </div>
  )
}

// -- Resources Panel ----------------------------------------------
function ResourcesPanel({ userRole, showToast }: { userRole: string, showToast: (m: string, t: 'success'|'error') => void }) {
  const [resources, setResources] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const canManage = ['super_admin','admin'].includes(userRole)

  useEffect(() => { loadResources() }, [])

  async function loadResources() {
    const { data } = await supabase.from('resources').select('*').order('created_at', { ascending: false })
    setResources(data || [])
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `resources/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const fileType = ext === 'pdf' ? 'pdf' : ['doc','docx'].includes(ext) ? 'doc' : ['xls','xlsx'].includes(ext) ? 'xls' : ['png','jpg','jpeg','webp'].includes(ext) ? 'image' : 'file'
    await supabase.from('resources').insert({ title: title.trim() || file.name, file_name: file.name, file_url: urlData.publicUrl, file_type: fileType, uploaded_by: 'admin' })
    setTitle(''); setUploading(false); showToast('Resource added!', 'success'); loadResources()
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteResource(id: string) {
    await supabase.from('resources').delete().eq('id', id)
    setResources(prev => prev.filter(r => r.id !== id))
    showToast('Removed', 'success')
  }

  function icon(type: string) {
    if (type === 'pdf') return '📄'
    if (type === 'doc') return '📝'
    if (type === 'xls') return '📊'
    if (type === 'image') return '🖼️'
    return '📎'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-blue-900">Resources</h1>
        <p className="text-sm text-gray-500 mt-0.5">Forms, documents, and templates for the team</p>
      </div>

      {canManage && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resource name (optional)..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg py-3 text-sm text-gray-500 hover:text-blue-600 transition disabled:opacity-50">
            {uploading ? 'Uploading...' : '📤 Upload form, document, or template'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={handleUpload} className="hidden" />
        </div>
      )}

      {resources.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No resources yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resources.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-300 transition">
              <span className="text-3xl">{icon(r.file_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{r.title}</p>
                <p className="text-xs text-gray-400 truncate">{r.file_name}</p>
              </div>
              <a href={r.file_url} target="_blank" rel="noopener noreferrer" download className="text-xs bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">Download</a>
              {canManage && <button onClick={() => deleteResource(r.id)} className="text-gray-300 hover:text-red-500 text-sm">x</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function DirectoryLinks({ userRole, showToast }: { userRole: string, showToast: (m: string, t: 'success'|'error') => void }) {
  const [links, setLinks] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', description: '', client: '' })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('All')
  const [searchQ, setSearchQ] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', url: '', description: '', client: '' })
  const canManage = ['super_admin','admin'].includes(userRole)
  const colors = ['border-blue-400','border-green-400','border-purple-400','border-orange-400','border-pink-400','border-cyan-400']
  const tabs = ['All', ...CLIENTS, 'General']

  useEffect(() => { loadLinks() }, [])

  async function loadLinks() {
    const { data } = await supabase.from('directory_links').select('*').order('created_at', { ascending: true })
    setLinks(data || [])
  }

  async function addLink() {
    if (!form.name.trim() || !form.url.trim()) return
    setSaving(true)
    let url = form.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    const { error } = await supabase.from('directory_links').insert({ name: form.name.trim(), url, description: form.description.trim(), client: form.client || null })
    if (error) showToast(error.message, 'error')
    else { setForm({ name:'', url:'', description:'', client:'' }); setShowForm(false); showToast('Link added!', 'success'); loadLinks() }
    setSaving(false)
  }

  function startEdit(link: any) {
    setEditId(link.id)
    setEditForm({ name: link.name || '', url: link.url || '', description: link.description || '', client: link.client || '' })
    setShowForm(false)
  }

  async function saveEdit() {
    if (!editId || !editForm.name.trim() || !editForm.url.trim()) return
    setSaving(true)
    let url = editForm.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    const { error } = await supabase.from('directory_links').update({ name: editForm.name.trim(), url, description: editForm.description.trim(), client: editForm.client || null }).eq('id', editId)
    if (error) showToast(error.message, 'error')
    else { setEditId(null); showToast('Link updated!', 'success'); loadLinks() }
    setSaving(false)
  }

  async function deleteLink(id: string) {
    await supabase.from('directory_links').delete().eq('id', id)
    setLinks(prev => prev.filter(l => l.id !== id))
    showToast('Removed', 'success')
  }

  const filteredLinks = (activeTab === 'All' ? links
    : activeTab === 'General' ? links.filter(l => !l.client)
    : links.filter(l => l.client === activeTab)
  ).filter(l => !searchQ.trim() || l.name.toLowerCase().includes(searchQ.toLowerCase()) || (l.description || '').toLowerCase().includes(searchQ.toLowerCase()))

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Links</h2>
          <p className="text-sm text-gray-500">Quick access to company tools and websites</p>
        </div>
        {canManage && <button onClick={() => { setShowForm(!showForm); setEditId(null) }} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showForm ? 'Cancel' : '+ Add Link'}</button>}
      </div>

      {showForm && canManage && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Link name (e.g. ClockSmart)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <input value={form.url} onChange={e => setForm(p=>({...p,url:e.target.value}))} placeholder="URL (e.g. https://...)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} placeholder="Short description (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <select value={form.client} onChange={e => setForm(p=>({...p,client:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
            <option value="">General (not client-specific)</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={addLink} disabled={saving} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{saving ? 'Saving...' : 'Add Link'}</button>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${activeTab === t ? 'border-blue-900 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}{t !== 'All' && <span className="ml-1.5 text-xs text-gray-400">({t === 'General' ? links.filter(l=>!l.client).length : links.filter(l=>l.client===t).length})</span>}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={`Search ${activeTab === 'All' ? 'all links' : activeTab + ' links'}...`} className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
      </div>

      {filteredLinks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No links found{activeTab !== 'All' ? ` for ${activeTab}` : ''}{searchQ.trim() ? ` matching "${searchQ}"` : ''}.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map((link, i) => (
            editId === link.id ? (
              <div key={link.id} className="relative bg-white rounded-xl border-l-4 border-blue-400 border border-gray-100 p-5 shadow-sm space-y-2">
                <input value={editForm.name} onChange={e => setEditForm(p=>({...p,name:e.target.value}))} placeholder="Link name" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
                <input value={editForm.url} onChange={e => setEditForm(p=>({...p,url:e.target.value}))} placeholder="URL" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
                <input value={editForm.description} onChange={e => setEditForm(p=>({...p,description:e.target.value}))} placeholder="Description (optional)" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
                <select value={editForm.client} onChange={e => setEditForm(p=>({...p,client:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                  <option value="">General (not client-specific)</option>
                  {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditId(null)} className="flex-1 border border-gray-300 text-gray-700 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={saveEdit} disabled={saving} className="flex-1 bg-blue-900 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-blue-800 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <div key={link.id} className={`relative bg-white rounded-xl border-l-4 ${colors[i % colors.length]} border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all group`}>
                {canManage && (
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button onClick={() => startEdit(link)} className="text-gray-300 hover:text-blue-600 text-xs">✎</button>
                    <button onClick={() => deleteLink(link.id)} className="text-gray-300 hover:text-red-500 text-xs">x</button>
                  </div>
                )}
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">🔗</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 group-hover:text-blue-900 transition-colors">{link.name}</p>
                        {link.client && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CLIENT_COLORS[link.client] || 'bg-gray-100 text-gray-600'}`}>{link.client}</span>}
                      </div>
                      {link.description && <p className="text-xs text-gray-500 mt-1">{link.description}</p>}
                      <p className="text-xs text-blue-500 mt-2 truncate">{link.url}</p>
                    </div>
                  </div>
                </a>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// -- Coming Soon -------------------------------------------------------------
// -- Org Chart ------------------------------------------------------------
function OrgChart({ employees, showToast }: { employees: Employee[], showToast: (m: string, t?: 'success'|'error') => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{data:t},{data:m},{data:users}] = await Promise.all([
        supabase.from('teams').select('*, team_lead:employees(id, name, designation, employment_type, client, email)').eq('active', true).order('department').order('name'),
        supabase.from('team_members').select('*, employee:employees(id, name, designation, employment_type, employee_id, client, email)'),
        supabase.from('app_users').select('username, avatar_url').not('avatar_url', 'is', null),
      ])
      setTeams(t||[]); setMembers(m||[]); setLoading(false)
      const map: Record<string, string> = {}
      ;(users || []).forEach((u: any) => { if (u.avatar_url) map[u.username.toLowerCase()] = u.avatar_url })
      setAvatarMap(map)
    }
    load()
  }, [])

  const initial = (name: string) => name.trim().charAt(0).toUpperCase()

  // Group teams by the client their team lead supports (falls back to 'Unassigned')
  const clientMap = new Map<string, any[]>()
  teams.forEach(t => {
    const client = t.team_lead?.client || 'Unassigned'
    if (!clientMap.has(client)) clientMap.set(client, [])
    clientMap.get(client)!.push(t)
  })
  const clientEntries = Array.from(clientMap.entries()).sort(([a],[b]) => a.localeCompare(b))

  const matchesSearch = (name: string) => !searchQ || name.toLowerCase().includes(searchQ.toLowerCase())

  const PersonCard = ({ name, empType, client, avatarUrl, isLead }: { name: string, empType?: string|null, client?: string|null, avatarUrl?: string|null, isLead?: boolean }) => (
    <div className={`flex items-center gap-3 rounded-xl border transition ${isLead ? 'bg-blue-900 border-blue-900 shadow-md px-4 py-3.5' : 'bg-white border-gray-200 hover:border-blue-200 px-3 py-2.5'} ${searchQ && !matchesSearch(name) ? 'opacity-30' : ''}`}>
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className={`rounded-full object-cover flex-shrink-0 ${isLead ? 'w-12 h-12 ring-2 ring-white/40' : 'w-8 h-8'}`}/>
        : <div className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white ${isLead ? 'w-12 h-12 text-base bg-white/20' : 'w-8 h-8 text-xs ' + avatarColor(name)}`}>{initial(name)}</div>
      }
      <div className="min-w-0">
        <p className={`font-semibold truncate ${isLead ? 'text-base text-white' : 'text-sm text-gray-900'}`}>{name.split(',').reverse().join(' ').trim()}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {empType && <span className={`${isLead ? 'text-xs px-1.5 py-0.5' : 'text-[10px] px-1 py-0'} rounded font-medium ${isLead ? 'bg-white/20 text-white' : EMPLOYMENT_TYPE_COLORS[empType] || 'bg-gray-100 text-gray-600'}`}>{empType}</span>}
          {client && <span className={`${isLead ? 'text-xs px-1.5 py-0.5' : 'text-[10px] px-1 py-0'} rounded font-medium ${isLead ? 'bg-white/20 text-white' : CLIENT_COLORS[client] || 'bg-gray-100 text-gray-600'}`}>{client}</span>}
        </div>
      </div>
    </div>
  )

  const totalTeams = teams.length
  const totalMembers = members.length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Org Chart</h2>
          <p className="text-sm text-gray-500">{clientEntries.length} client{clientEntries.length !== 1 ? 's' : ''} - {totalTeams} team{totalTeams !== 1 ? 's' : ''} - {totalMembers} member{totalMembers !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Highlight a person..." className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 w-56"/>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading org chart...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🏢</div>
          <p className="font-medium">No teams set up yet</p>
          <p className="text-sm mt-1">Create teams under People → Teams to populate the org chart.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {clientEntries.map(([client, clientTeams]) => (
            <div key={client} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${CLIENT_COLORS[client] ? CLIENT_COLORS[client] + ' border-transparent' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{client}</span>
                <div className="flex-1 h-px bg-gray-200"/>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {clientTeams.map(team => {
                  const teamMembers = members.filter(m => m.team_id === team.id)
                  const leadName = team.team_lead?.name
                  return (
                    <div key={team.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{team.name}</p>
                      {leadName ? (
                        <PersonCard name={leadName} empType={team.team_lead.employment_type} client={team.team_lead.client} avatarUrl={team.team_lead.email ? avatarMap[team.team_lead.email.toLowerCase()] : undefined} isLead />
                      ) : (
                        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-xs text-gray-400">No team lead assigned</div>
                      )}
                      {teamMembers.length > 0 && (
                        <div className="pl-3 border-l-2 border-blue-100 ml-4 space-y-2">
                          {teamMembers.map(m => (
                            <PersonCard key={m.id} name={m.employee?.name || 'Unknown'} empType={m.employee?.employment_type} client={m.employee?.client} avatarUrl={m.employee?.email ? avatarMap[m.employee.email.toLowerCase()] : undefined} />
                          ))}
                        </div>
                      )}
                      {teamMembers.length === 0 && (
                        <p className="text-xs text-gray-400 pl-4">No members yet</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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

// -- Tickets ------------------------------------------------------------------
type TicketAttachment = { name: string, url: string, type: string }
type Ticket = {
  id: string
  title: string
  description: string
  category: string
  ticket_type: string | null
  department: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
  created_by: string
  requested_by: string | null
  assigned_to: string | null
  owner: string | null
  attachments: TicketAttachment[]
  sla_hours: number
  sla_deadline: string | null
  created_at: string
  updated_at: string
}

const TICKET_CATEGORIES = ['IT', 'HR', 'Admin', 'Management', 'Logistics', 'Operations']
const TICKET_TYPES: Record<string, string[]> = {
  'IT': ['ICA / COE Request', 'Portal Request / Development / Issue', 'Equipment Request / Report', 'Open Door Policy', 'Process Improvement'],
  'HR': ['ICA / COE Request', 'Portal Request / Development / Issue', 'Equipment Request / Report', 'Open Door Policy', 'Process Improvement'],
  'Admin': ['ICA / COE Request', 'Portal Request / Development / Issue', 'Equipment Request / Report', 'Open Door Policy', 'Process Improvement'],
  'Management': ['ICA / COE Request', 'Portal Request / Development / Issue', 'Equipment Request / Report', 'Open Door Policy', 'Process Improvement'],
  'Logistics': ['ICA / COE Request', 'Portal Request / Development / Issue', 'Equipment Request / Report', 'Open Door Policy', 'Process Improvement'],
  'Operations': ['ICA / COE Request', 'Portal Request / Development / Issue', 'Equipment Request / Report', 'Open Door Policy', 'Process Improvement'],
}
const TICKET_TYPE_DEFINITIONS: Record<string, string> = {
  'ICA / COE Request': 'Independent Contractor Agreement or Certificate of Employment request. Use this for any employment verification, contract renewals, or official documentation needs.',
  'Portal Request / Development / Issue': 'Anything related to the AB BSS Operations Portal — feature requests, bug reports, access issues, or development improvements you\'d like to see.',
  'Equipment Request / Report': 'Device or equipment requests, hardware issues, peripheral needs (keyboard, headset, etc.), or reporting damaged/missing equipment.',
  'Open Door Policy': 'Request a sit-down or meeting with any team member, Team Lead, or Operations management. We encourage open communication at all levels.',
  'Process Improvement': 'Suggestions for improving existing workflows, implementing new processes, or flagging inefficiencies you\'ve observed. All ideas are welcome.',
}
const PRIORITY_COLORS: Record<string, string> = { Low: 'bg-gray-100 text-gray-600', Medium: 'bg-amber-100 text-amber-700', High: 'bg-orange-100 text-orange-700', Urgent: 'bg-red-100 text-red-700' }
const STATUS_COLORS: Record<string, string> = { Open: 'bg-blue-100 text-blue-700', 'In Progress': 'bg-purple-100 text-purple-700', Resolved: 'bg-emerald-100 text-emerald-700', Closed: 'bg-gray-100 text-gray-500' }

function getSLAStatus(ticket: Ticket): { label: string, color: string, urgent: boolean } {
  if (!ticket.sla_deadline || ticket.status === 'Resolved' || ticket.status === 'Closed') {
    return { label: ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'SLA Met' : 'No SLA', color: 'text-gray-400', urgent: false }
  }
  const now = new Date()
  const deadline = new Date(ticket.sla_deadline)
  const diffMs = deadline.getTime() - now.getTime()
  const diffHrs = diffMs / (1000 * 60 * 60)
  if (diffMs < 0) return { label: `Overdue by ${Math.abs(Math.round(diffHrs))}h`, color: 'text-red-600', urgent: true }
  if (diffHrs < 4) return { label: `${Math.round(diffHrs)}h left`, color: 'text-orange-500', urgent: true }
  if (diffHrs < 8) return { label: `${Math.round(diffHrs)}h left`, color: 'text-amber-500', urgent: false }
  return { label: `${Math.round(diffHrs)}h left`, color: 'text-emerald-600', urgent: false }
}

// -- BCP (Business Continuity Planning): Task List + who's trained --------
type BCPTask = {
  id: string
  title: string
  category: string | null
  description: string | null
  created_by: string | null
  created_at: string
}

const BCP_CATEGORIES = ['Onboarding', 'Payroll', 'Recruitment', 'Client Management', 'Finance/AR/AP', 'IT/Systems', 'HR/Admin', 'Other']
const BCP_CATEGORY_COLORS: Record<string, string> = {
  Onboarding: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Payroll: 'bg-amber-50 text-amber-700 border-amber-200',
  Recruitment: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'Client Management': 'bg-blue-50 text-blue-700 border-blue-200',
  'Finance/AR/AP': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'IT/Systems': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'HR/Admin': 'bg-violet-50 text-violet-700 border-violet-200',
  Other: 'bg-gray-100 text-gray-600 border-gray-200',
}

function BCPPanel({ employees, currentUser, userRole, showToast }: { employees: Employee[], currentUser: string, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const canManage = userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead'
  const [tasks, setTasks] = useState<BCPTask[]>([])
  const [coverage, setCoverage] = useState<Record<string, string[]>>({}) // task_id -> employee_ids[]
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [posting, setPosting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [savingCoverage, setSavingCoverage] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', category: BCP_CATEGORIES[0], description: '' })

  async function loadData() {
    setLoading(true)
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('bcp_tasks').select('*').order('category').order('title'),
      supabase.from('bcp_task_coverage').select('task_id, employee_id'),
    ])
    setTasks((t || []) as BCPTask[])
    const map: Record<string, string[]> = {}
    ;(c || []).forEach((row: any) => {
      if (!map[row.task_id]) map[row.task_id] = []
      map[row.task_id].push(row.employee_id)
    })
    setCoverage(map)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function addTask() {
    if (!form.title.trim()) { showToast('Please add a task title.', 'error'); return }
    setPosting(true)
    const { error } = await supabase.from('bcp_tasks').insert({
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || null,
      created_by: currentUser,
    })
    setPosting(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Task added!')
    setForm({ title: '', category: BCP_CATEGORIES[0], description: '' })
    setShowForm(false)
    loadData()
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task and its coverage mapping?')) return
    await supabase.from('bcp_tasks').delete().eq('id', id)
    showToast('Task deleted')
    loadData()
  }

  async function toggleCoverage(taskId: string, employeeId: string, currentlyTrained: boolean) {
    setSavingCoverage(taskId + employeeId)
    if (currentlyTrained) {
      await supabase.from('bcp_task_coverage').delete().eq('task_id', taskId).eq('employee_id', employeeId)
    } else {
      await supabase.from('bcp_task_coverage').insert({ task_id: taskId, employee_id: employeeId })
    }
    await loadData()
    setSavingCoverage(null)
  }

  // De-dupe employees by name (multi-role rows share a person) for the coverage picker
  const uniqueEmployees = (() => {
    const seen = new Set<string>()
    const list: Employee[] = []
    employees.filter(e => e.active).forEach(e => {
      const key = e.name.trim().toLowerCase()
      if (!seen.has(key)) { seen.add(key); list.push(e) }
    })
    return list.sort((a, b) => a.name.localeCompare(b.name))
  })()

  const filtered = tasks.filter(t =>
    (filterCategory === 'All' || t.category === filterCategory) &&
    (!searchQ || t.title.toLowerCase().includes(searchQ.toLowerCase()))
  )

  const tasksWithNoCoverage = tasks.filter(t => !coverage[t.id] || coverage[t.id].length === 0).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Business Continuity Plan</h2>
          <p className="text-sm text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} tracked{tasksWithNoCoverage > 0 ? ` · ${tasksWithNoCoverage} with no one trained yet` : ''}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showForm ? 'Cancel' : '+ New Task'}</button>
        )}
      </div>

      {showForm && canManage && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Task name, e.g. 'Process payroll cutoff'" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What does this task involve? (optional)" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" />
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {BCP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div className="flex justify-end">
            <button onClick={addTask} disabled={posting} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{posting ? 'Adding...' : 'Add Task'}</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search tasks..." className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 w-52"/>
        </div>
        {['All', ...BCP_CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCategory(c)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition border ${filterCategory === c ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No tasks found. {canManage && 'Add the first one above.'}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const trainedIds = new Set(coverage[task.id] || [])
            const trainedEmps = uniqueEmployees.filter(e => trainedIds.has(e.id))
            const isExpanded = expandedId === task.id
            return (
              <div key={task.id} className={`bg-white border rounded-xl overflow-hidden ${trainedEmps.length === 0 ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between gap-2 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : task.id)}>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {task.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${BCP_CATEGORY_COLORS[task.category] || BCP_CATEGORY_COLORS.Other}`}>{task.category}</span>}
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{task.title}</h3>
                    {trainedEmps.length === 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 flex-shrink-0">⚠ No one trained</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 flex-shrink-0">{trainedEmps.length} trained</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canManage && <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }} className="text-gray-300 hover:text-red-500 text-xs transition">×</button>}
                    <span className="text-gray-400">{isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    {task.description && <p className="text-sm text-gray-600">{task.description}</p>}
                    {!canManage && (
                      <div className="flex flex-wrap gap-2">
                        {trainedEmps.length === 0 ? (
                          <p className="text-xs text-gray-400">No one is trained on this task yet.</p>
                        ) : trainedEmps.map(e => (
                          <span key={e.id} className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2.5 py-1">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(e.name)}`}>{e.name.charAt(0).toUpperCase()}</span>
                            {e.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {canManage && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Who can perform this task — click to toggle</p>
                        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                          {uniqueEmployees.map(e => {
                            const isTrained = trainedIds.has(e.id)
                            const isSaving = savingCoverage === task.id + e.id
                            return (
                              <button key={e.id} onClick={() => toggleCoverage(task.id, e.id, isTrained)} disabled={isSaving}
                                className={`flex items-center gap-1.5 text-xs rounded-full pl-1 pr-2.5 py-1 border transition ${isTrained ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'} ${isSaving ? 'opacity-50' : ''}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(e.name)}`}>{e.name.charAt(0).toUpperCase()}</span>
                                {e.name}
                                {isTrained && <span className="text-emerald-500">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -- Tasks: Manager/Team Lead assigns a task to a subordinate -------------
type AppTask = {
  id: string
  title: string
  description: string | null
  assigned_to: string
  assigned_by: string
  due_date: string | null
  is_done: boolean
  priority: 'Low'|'Medium'|'High'
  status: 'No Status'|'To Do'|'In Progress'|'Complete'
  created_at: string
}

const TASK_STATUSES: AppTask['status'][] = ['No Status','To Do','In Progress','Complete']
const TASK_STATUS_STYLE: Record<AppTask['status'], string> = {
  'No Status': 'text-gray-400', 'To Do': 'text-gray-500', 'In Progress': 'text-blue-600', 'Complete': 'text-emerald-600'
}
const TASK_PRIORITY_STYLE: Record<AppTask['priority'], string> = {
  Low: 'bg-emerald-100 text-emerald-700', Medium: 'bg-amber-100 text-amber-700', High: 'bg-red-100 text-red-700'
}

function TasksPanel({ employees, currentUser, userRole, showToast }: { employees: Employee[], currentUser: string, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const canAssign = userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead'
  const canSeeAll = userRole === 'super_admin'
  const [tasks, setTasks] = useState<AppTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [posting, setPosting] = useState(false)
  const [viewMode, setViewMode] = useState<'list'|'board'>('list')
  const [filterStatus, setFilterStatus] = useState<'All' | 'To Do' | 'Done'>('All')
  const [assignerFilter, setAssignerFilter] = useState('All') // Super Admin only: filter by who assigned it
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'Medium' as AppTask['priority'] })
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [recipientSearch, setRecipientSearch] = useState('')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  // Build a lookup of email -> name for display, and the list of people
  // a Manager/Team Lead can actually assign to (anyone with a work email).
  const assignableEmployees = employees.filter(e => e.active && e.email)
  const nameByEmail = (email: string) => assignableEmployees.find(e => e.email?.toLowerCase() === email.toLowerCase())?.name || email.split('@')[0]
  const visibleRecipients = assignableEmployees.filter(e => !recipientSearch.trim() || e.name.toLowerCase().includes(recipientSearch.toLowerCase()))

  async function loadTasks() {
    setLoading(true)
    let q = supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    // Agents, Team Leads, and Admins only see tasks assigned to them, plus
    // (for Team Lead/Admin) tasks they personally assigned to others so
    // they can track completion. Only Super Admin sees everyone's tasks.
    if (!canSeeAll) {
      if (userRole === 'Team Lead' || userRole === 'admin') {
        q = q.or(`assigned_to.eq.${currentUser.toLowerCase()},assigned_by.eq.${currentUser}`)
      } else {
        q = q.eq('assigned_to', currentUser.toLowerCase())
      }
    }
    const { data, error } = await q
    if (!error) setTasks((data || []) as AppTask[])
    setLoading(false)
  }

  useEffect(() => { loadTasks() }, [])

  function toggleRecipient(email: string) {
    setSelectedEmails(prev => { const next = new Set(prev); next.has(email) ? next.delete(email) : next.add(email); return next })
  }
  function selectAllRecipients() {
    setSelectedEmails(new Set(visibleRecipients.map(e => e.email!.toLowerCase())))
  }
  function clearAllRecipients() {
    setSelectedEmails(new Set())
  }

  async function createTask() {
    if (!form.title.trim() || selectedEmails.size === 0) { showToast('Please add a title and select at least one recipient.', 'error'); return }
    setPosting(true)
    const recipients = Array.from(selectedEmails)
    const rows = recipients.map(email => ({
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: email,
      assigned_by: currentUser,
      due_date: form.due_date || null,
      priority: form.priority,
      status: 'To Do',
      is_done: false,
    }))
    const { error } = await supabase.from('tasks').insert(rows)
    setPosting(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast(`Task assigned to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}!`)
    recipients.forEach(email => {
      fetch('/api/notify/task-assigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: email, assignedBy: currentUser, title: form.title.trim(), description: form.description.trim(), dueDate: form.due_date || null })
      }).catch(() => {})
    })
    setForm({ title: '', description: '', due_date: '', priority: 'Medium' })
    setSelectedEmails(new Set()); setRecipientSearch('')
    setShowForm(false)
    loadTasks()
  }

  async function setStatus(task: AppTask, status: AppTask['status']) {
    await supabase.from('tasks').update({ status, is_done: status === 'Complete' }).eq('id', task.id)
    loadTasks()
  }

  async function toggleDone(task: AppTask) {
    const next = !task.is_done
    await supabase.from('tasks').update({ is_done: next, status: next ? 'Complete' : 'To Do' }).eq('id', task.id)
    loadTasks()
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    showToast('Task deleted')
    loadTasks()
  }

  const assigners = canSeeAll ? Array.from(new Set(tasks.map(t => t.assigned_by))).sort() : []
  const filtered = tasks.filter(t => {
    if (filterStatus === 'To Do' && t.is_done) return false
    if (filterStatus === 'Done' && !t.is_done) return false
    if (canSeeAll && assignerFilter !== 'All' && t.assigned_by !== assignerFilter) return false
    return true
  })

  const isOverdue = (dueDate: string | null) => dueDate ? new Date(dueDate) < new Date(new Date().toDateString()) : false

  const TaskRow = ({ t }: { t: AppTask }) => (
    <div className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${t.is_done ? 'border-gray-200 opacity-60' : isOverdue(t.due_date) ? 'border-red-300' : 'border-gray-200'}`}>
      <button onClick={() => toggleDone(t)} className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${t.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-blue-400'}`}>
        {t.is_done && <CheckCircle className="w-3.5 h-3.5 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-semibold text-sm ${t.is_done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.title}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TASK_PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
        </div>
        {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
        <p className="text-xs text-gray-400 mt-1.5">
          {canSeeAll && <>Assigned to <span className="font-medium text-gray-600">{nameByEmail(t.assigned_to)}</span> · </>}
          By {t.assigned_by.split('@')[0]}
          {t.due_date && <> · <span className={isOverdue(t.due_date) && !t.is_done ? 'text-red-500 font-medium' : ''}>{isOverdue(t.due_date) && !t.is_done ? '⚠ Overdue: ' : 'Due '}{new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></>}
        </p>
      </div>
      {(canAssign && (canSeeAll || t.assigned_by === currentUser)) && <button onClick={() => deleteTask(t.id)} className="text-gray-300 hover:text-red-500 text-xs transition flex-shrink-0">×</button>}
    </div>
  )

  // Group into month buckets (by created_at) so history can be collapsed
  // month-over-month. Current month is expanded by default.
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const monthGroups = new Map<string, AppTask[]>()
  filtered.forEach(t => {
    const key = t.created_at.slice(0, 7)
    if (!monthGroups.has(key)) monthGroups.set(key, [])
    monthGroups.get(key)!.push(t)
  })
  const sortedMonthKeys = Array.from(monthGroups.keys()).sort((a, b) => b.localeCompare(a))
  const monthLabel = (key: string) => new Date(key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  function toggleMonth(key: string) {
    setExpandedMonths(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }
  const isMonthExpanded = (key: string) => key === currentMonthKey || expandedMonths.has(key)

  const BoardCard = ({ t }: { t: AppTask }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className={`font-semibold text-sm text-gray-900 ${t.status === 'Complete' ? 'line-through text-gray-400' : ''}`}>{t.title}</p>
        {(canAssign && (canSeeAll || t.assigned_by === currentUser)) && <button onClick={() => deleteTask(t.id)} className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0">×</button>}
      </div>
      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TASK_PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
      {t.due_date && <p className={`text-xs ${isOverdue(t.due_date) && t.status !== 'Complete' ? 'text-red-500 font-medium' : 'text-gray-500'}`}>{new Date(t.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
      {canSeeAll && <p className="text-xs text-gray-400">{nameByEmail(t.assigned_to)}</p>}
      <select value={t.status} onChange={e => setStatus(t, e.target.value as AppTask['status'])} className="w-full border border-gray-200 rounded px-1.5 py-1 text-[11px] text-gray-700">
        {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Tasks</h2>
          <p className="text-sm text-gray-500">{canSeeAll ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} across the team` : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} involving you`}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            <button onClick={() => setViewMode('list')} className={`px-3 py-2 font-medium transition ${viewMode === 'list' ? 'bg-blue-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>☰ List</button>
            <button onClick={() => setViewMode('board')} className={`px-3 py-2 font-medium transition ${viewMode === 'board' ? 'bg-blue-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>▤ By Status</button>
          </div>
          {canAssign && (
            <button onClick={() => setShowForm(!showForm)} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showForm ? 'Cancel' : '+ Assign Task'}</button>
          )}
        </div>
      </div>

      {showForm && canAssign && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Details (optional)..." rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600">Recipients ({selectedEmails.size} selected)</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllRecipients} className="text-xs text-blue-700 hover:underline">Select All</button>
                <button type="button" onClick={clearAllRecipients} className="text-xs text-gray-400 hover:underline">Clear</button>
              </div>
            </div>
            <input value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} placeholder="Search people..." className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-900" />
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-50">
              {visibleRecipients.map(e => {
                const email = e.email!.toLowerCase()
                const checked = selectedEmails.has(email)
                return (
                  <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={checked} onChange={() => toggleRecipient(email)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    <span className="text-gray-800">{e.name}</span>
                  </label>
                )
              })}
              {visibleRecipients.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">No matches.</p>}
            </div>
            {selectedEmails.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Array.from(selectedEmails).map(email => (
                  <span key={email} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                    {nameByEmail(email)}
                    <button onClick={() => toggleRecipient(email)} className="hover:text-blue-900">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as AppTask['priority'] }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
              {(['Low','Medium','High'] as const).map(p => <option key={p} value={p}>{p} priority</option>)}
            </select>
          </div>
          <div className="flex justify-end">
            <button onClick={createTask} disabled={posting} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{posting ? 'Assigning...' : `Assign to ${selectedEmails.size || ''} ${selectedEmails.size === 1 ? 'Person' : 'People'}`}</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {viewMode === 'list' && (['All', 'To Do', 'Done'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition border ${filterStatus === s ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{s}</button>
        ))}
        {canSeeAll && assigners.length > 0 && (
          <select value={assignerFilter} onChange={e => setAssignerFilter(e.target.value)} className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 ml-auto">
            <option value="All">All assigners (TL/Admin)</option>
            {assigners.map(a => <option key={a} value={a}>{a.split('@')[0]}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No tasks found.</div>
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_STATUSES.map(status => {
            const colTasks = filtered.filter(t => (t.status || 'To Do') === status)
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className={`text-sm font-semibold ${TASK_STATUS_STYLE[status]}`}>{status}</span>
                  <span className="text-xs text-gray-400">{colTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {colTasks.map(t => <BoardCard key={t.id} t={t} />)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMonthKeys.map(key => {
            const monthTasks = monthGroups.get(key)!
            const expanded = isMonthExpanded(key)
            return (
              <div key={key} className="space-y-2">
                <button onClick={() => toggleMonth(key)} className="w-full flex items-center justify-between px-1 py-1.5 text-left group">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    {monthLabel(key)} {key === currentMonthKey && <span className="text-xs font-normal text-blue-600">(current)</span>}
                  </span>
                  <span className="text-xs text-gray-400">{monthTasks.length} task{monthTasks.length !== 1 ? 's' : ''}</span>
                </button>
                {expanded && (
                  <div className="space-y-2">
                    {monthTasks.map(t => <TaskRow key={t.id} t={t} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
function TicketsPanel({ currentUser, userRole, showToast }: { currentUser: string, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const canManage = userRole === 'super_admin' || userRole === 'admin'
  const canEdit = (t: Ticket) => canManage || t.created_by === currentUser
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [allEmployees, setAllEmployees] = useState<{name:string,email:string}[]>([])
  const [categoryOwners, setCategoryOwners] = useState<Record<string,string[]>>({})
  const [pocTab, setPocTab] = useState(false)
  const [pocSaving, setPocSaving] = useState<string|null>(null)
  const [pocSearch, setPocSearch] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterCat, setFilterCat] = useState<string>('All')
  const [scope, setScope] = useState<'mine'|'all'>(canManage ? 'all' : 'mine')
  const [expandedId, setExpandedId] = useState<string|null>(null)
  const [editingId, setEditingId] = useState<string|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    title: '', description: '', category: 'IT',
    ticket_type: TICKET_TYPES['IT'][0],
    priority: 'Medium' as Ticket['priority'],
    owner: '', sla_hours: 24
  })
  const [editForm, setEditForm] = useState<Partial<Ticket>>({})
  const [comments, setComments] = useState<Record<string,any[]>>({})
  const [commentDraft, setCommentDraft] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [commentAttachments, setCommentAttachments] = useState<TicketAttachment[]>([])
  const [uploadingComment, setUploadingComment] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)

  useEffect(() => {
    loadTickets()
    loadEmployees()
    loadCategoryOwners()
  }, [scope])

  async function loadCategoryOwners() {
    const { data } = await supabase.from('ticket_category_owners').select('*')
    const map: Record<string,string[]> = {}
    ;(data||[]).forEach((r:any) => { map[r.category] = r.owner_emails || [] })
    setCategoryOwners(map)
  }

  async function saveCategoryOwners(category: string, emails: string[]) {
    setPocSaving(category)
    await supabase.from('ticket_category_owners').upsert({
      category, owner_emails: emails, updated_by: currentUser, updated_at: new Date().toISOString()
    }, { onConflict: 'category' })
    setCategoryOwners(prev => ({ ...prev, [category]: emails }))
    setPocSaving(null)
    showToast(`${category} POCs updated!`, 'success')
  }

  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('name, email').eq('active', true).order('name')
    setAllEmployees((data || []).filter((e:any) => e.email))
  }

  async function loadTickets() {
    setLoading(true)
    let query = supabase.from('tickets').select('*').order('created_at', { ascending: false })
    if (userRole === 'agent') {
      // Agents see only their own tickets
      query = query.eq('created_by', currentUser)
    } else if (userRole === 'Team Lead') {
      // Team Leads see their own + tickets where they are owner
      query = query.or(`created_by.eq.${currentUser},owner.eq.${currentUser}`)
    } else if (scope === 'mine') {
      query = query.eq('created_by', currentUser)
    }
    // admin and super_admin with scope='all' see everything
    const { data, error } = await query
    if (!error) setTickets((data || []) as Ticket[])
    setLoading(false)
  }

  async function loadComments(ticketId: string) {
    const { data } = await supabase.from('ticket_comments').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true })
    setComments(prev => ({ ...prev, [ticketId]: data || [] }))
  }

  async function postComment(ticket: Ticket) {
    if (!commentDraft.trim() && commentAttachments.length === 0) return
    setPostingComment(true)
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id, comment: commentDraft.trim() || '(attachment only)',
      commented_by: currentUser, is_resolution: canManage,
      attachments: commentAttachments,
    })
    // Any update resets the SLA clock 24hrs from now
    await supabase.from('tickets').update({ sla_deadline: newDeadline, updated_at: new Date().toISOString() }).eq('id', ticket.id)
    setPostingComment(false)
    setCommentDraft(''); setCommentAttachments([])
    loadComments(ticket.id); loadTickets()
    notifySubmitter(ticket, 'comment', commentDraft.trim() || 'Added an attachment')
  }

  async function uploadCommentFile(file: File) {
    setUploadingComment(true)
    const path = `tickets/comments/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploadingComment(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const fileType = file.type.startsWith('image/') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'doc'
    setCommentAttachments(prev => [...prev, { name: file.name, url: urlData.publicUrl, type: fileType }])
    setUploadingComment(false)
  }

  function notifySubmitter(ticket: Ticket, updateType: 'comment'|'status'|'edit', detail?: string) {
    const submitterEmail = ticket.requested_by || ticket.created_by
    if (!submitterEmail) return
    fetch('/api/notify/ticket-updated', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: ticket.id, title: ticket.title, submitterEmail, updateType, updatedBy: currentUser, detail })
    }).catch(() => {})
  }

  function toggleExpand(ticket: Ticket) {
    const next = expandedId === ticket.id ? null : ticket.id
    setExpandedId(next)
    if (next) loadComments(ticket.id)
  }

  async function uploadFile(file: File) {
    setUploading(true)
    const path = `tickets/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    const fileType = file.type.startsWith('image/') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'doc'
    setAttachments(prev => [...prev, { name: file.name, url: urlData.publicUrl, type: fileType }])
    setUploading(false)
  }

  async function submitTicket() {
    if (!form.title.trim() || !form.description.trim()) { showToast('Please fill in title and description.', 'error'); return }
    setPosting(true)
    const slaDeadline = new Date(Date.now() + form.sla_hours * 60 * 60 * 1000).toISOString()
    // Auto-assign POCs for this category
    const pocs = categoryOwners[form.category] || []
    const primaryOwner = pocs.length > 0 ? pocs[0] : (form.owner || null)
    const { data, error } = await supabase.from('tickets').insert({
      title: form.title.trim(), description: form.description.trim(),
      category: form.category, ticket_type: form.ticket_type,
      priority: form.priority, status: 'Open',
      created_by: currentUser, requested_by: currentUser,
      owner: primaryOwner,
      sla_hours: form.sla_hours, sla_deadline: slaDeadline,
      attachments,
    }).select().single()
    setPosting(false)
    if (error) { showToast(error.message, 'error'); return }
    setForm({ title: '', description: '', category: 'IT', ticket_type: TICKET_TYPES['IT'][0], priority: 'Medium', owner: '', sla_hours: 24 })
    setAttachments([]); setShowForm(false)
    showToast('Ticket submitted!', 'success')
    loadTickets()
    // Notify all POCs
    const notifyEmails = pocs.length > 0 ? pocs : (form.owner ? [form.owner] : [])
    if (notifyEmails.length > 0) {
      fetch('/api/notify/ticket-created', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: data?.id, title: form.title.trim(), category: form.category, priority: form.priority, createdBy: currentUser, ownerEmails: notifyEmails })
      }).catch(() => {})
    }
  }

  async function saveEdit(id: string) {
    const ticket = tickets.find(t => t.id === id)
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('tickets').update({
      ...editForm, sla_deadline: newDeadline, updated_at: new Date().toISOString()
    }).eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Ticket updated!', 'success')
    setEditingId(null); loadTickets()
    if (ticket) notifySubmitter(ticket, 'edit', 'Ticket details were updated')
  }

  async function updateStatus(id: string, status: Ticket['status']) {
    const ticket = tickets.find(t => t.id === id)
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('tickets').update({ status, sla_deadline: newDeadline, updated_at: new Date().toISOString() }).eq('id', id)
    showToast('Status updated', 'success'); loadTickets()
    if (ticket) notifySubmitter(ticket, 'status', `Status changed to ${status}`)
  }

  async function deleteTicket(id: string) {
    if (!confirm('Delete this ticket permanently?')) return
    await supabase.from('tickets').delete().eq('id', id)
    showToast('Ticket deleted', 'success'); loadTickets()
  }

  const filtered = tickets.filter(t =>
    (filterStatus === 'All' || t.status === filterStatus) &&
    (filterCat === 'All' || t.category === filterCat)
  )
  const openCount = tickets.filter(t => t.status === 'Open').length
  const inProgressCount = tickets.filter(t => t.status === 'In Progress').length
  const overdueCount = tickets.filter(t => getSLAStatus(t).label.startsWith('Overdue')).length

  const OwnerPicker = ({ value, onChange }: { value: string, onChange: (v:string) => void }) => (
    <div className="relative">
      <input value={ownerSearch || value} onChange={e => { setOwnerSearch(e.target.value); onChange(e.target.value); setShowOwnerDropdown(true) }}
        onFocus={() => setShowOwnerDropdown(true)}
        placeholder="Search and assign owner..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
      {showOwnerDropdown && (
        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-1">
          {allEmployees.filter(e => !ownerSearch || e.name.toLowerCase().includes(ownerSearch.toLowerCase()) || (e.email||'').toLowerCase().includes(ownerSearch.toLowerCase()))
            .map(e => (
              <button key={e.email} onClick={() => { onChange(e.email); setOwnerSearch(e.name); setShowOwnerDropdown(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-900">
                <span className="font-medium">{e.name}</span>
                <span className="text-gray-400 text-xs ml-2">{e.email}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Tickets</h2>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-sm text-gray-500">{openCount} open · {inProgressCount} in progress</p>
            {overdueCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠ {overdueCount} SLA overdue</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={() => setScope('mine')} className={`px-3 py-1.5 font-medium transition ${scope==='mine'?'bg-blue-900 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>My Tickets</button>
              <button onClick={() => setScope('all')} className={`px-3 py-1.5 font-medium transition ${scope==='all'?'bg-blue-900 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>All Tickets</button>
            </div>
          )}
          {userRole === 'super_admin' && (
            <button onClick={() => setPocTab(v=>!v)} className={`text-xs px-3 py-1.5 rounded-lg border transition ${pocTab ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>⚙ POC Settings</button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">{showForm ? 'Cancel' : '+ New Ticket'}</button>
        </div>
      </div>

      {/* POC Settings Panel — Super Admin only */}
      {pocTab && userRole === 'super_admin' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">Ticket POC Settings</h4>
            <p className="text-xs text-gray-500 mt-0.5">Assign points of contact per category. All POCs get notified when a ticket is created under their category.</p>
          </div>
          {TICKET_CATEGORIES.map(cat => {
            const owners = categoryOwners[cat] || []
            const search = pocSearch[cat] || ''
            return (
              <div key={cat} className="border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">{cat}</span>
                  <span className="text-xs text-gray-400">{owners.length} POC{owners.length !== 1 ? 's' : ''}</span>
                </div>
                {owners.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {owners.map(email => {
                      const emp = allEmployees.find(e => e.email === email)
                      return (
                        <span key={email} className="flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {emp?.name || email.split('@')[0]}
                          <button onClick={() => saveCategoryOwners(cat, owners.filter(e => e !== email))} className="hover:text-red-500 ml-0.5">×</button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="relative">
                  <input value={search} onChange={e => setPocSearch(p=>({...p,[cat]:e.target.value}))}
                    placeholder="Search and add POC..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
                  {search && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-y-auto mt-1">
                      {allEmployees
                        .filter(e => !owners.includes(e.email) && (e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())))
                        .map(e => (
                          <button key={e.email} onClick={() => { saveCategoryOwners(cat, [...owners, e.email]); setPocSearch(p=>({...p,[cat]:''})) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-900 flex items-center justify-between">
                            <span className="font-medium">{e.name}</span>
                            <span className="text-gray-400 text-xs">{e.email}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                {pocSaving === cat && <p className="text-xs text-blue-500">Saving...</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-gray-900 text-sm">New Ticket</h4>
          <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Brief summary of the issue..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} placeholder="Describe the issue in detail..." rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Category</label>
              <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value,ticket_type:TICKET_TYPES[e.target.value][0]}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                {TICKET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium">Ticket Type</label>
              <select value={form.ticket_type} onChange={e => setForm(p=>({...p,ticket_type:e.target.value}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                {(TICKET_TYPES[form.category]||[]).map(t => <option key={t}>{t}</option>)}
              </select>
              {TICKET_TYPE_DEFINITIONS[form.ticket_type] && (
                <p className="mt-1.5 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  ℹ️ {TICKET_TYPE_DEFINITIONS[form.ticket_type]}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Priority</label>
              <select value={form.priority} onChange={e => setForm(p=>({...p,priority:e.target.value as Ticket['priority']}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">SLA (hours)</label>
              <input type="number" min={1} value={form.sla_hours} onChange={e => setForm(p=>({...p,sla_hours:parseInt(e.target.value)||24}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </div>
          </div>
          {/* Show auto-assign info for all, owner picker only for admin+ */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
            {(categoryOwners[form.category]||[]).length > 0
              ? `🎯 This ticket will be auto-assigned to: ${(categoryOwners[form.category]||[]).map(e => allEmployees.find(emp=>emp.email===e)?.name || e.split('@')[0]).join(', ')}`
              : '⚠️ No POC assigned for this category yet. Ticket will be unassigned.'}
          </div>
          {canManage && (
          <div>
            <label className="text-xs text-gray-500 font-medium">Override Owner (optional)</label>
            <div className="mt-1">
              <OwnerPicker value={form.owner} onChange={v => setForm(p=>({...p,owner:v}))} />
            </div>
          </div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50">{uploading ? 'Uploading...' : '📎 Attach'}</button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={e => { Array.from(e.target.files||[]).forEach(uploadFile) }} className="hidden" />
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att,i) => (
                <div key={i} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs">
                  <span>{att.type==='image'?'🖼':att.type==='pdf'?'📄':'📝'}</span>
                  <span className="text-gray-700 max-w-xs truncate">{att.name}</span>
                  <button onClick={() => setAttachments(prev=>prev.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500 ml-1">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={submitTicket} disabled={posting||uploading} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{posting?'Submitting...':'Submit Ticket'}</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['All','Open','In Progress','Resolved','Closed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition border ${filterStatus===s?'bg-blue-900 text-white border-blue-900':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{s}</button>
        ))}
        <span className="text-gray-300">|</span>
        {['All',...TICKET_CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCat(c)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition border ${filterCat===c?'bg-blue-900 text-white border-blue-900':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{c}</button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading tickets...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No tickets found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const sla = getSLAStatus(t)
            const isEditing = editingId === t.id
            return (
              <div key={t.id} className={`bg-white border rounded-xl p-4 space-y-3 ${sla.urgent && t.status !== 'Resolved' && t.status !== 'Closed' ? 'border-red-300' : t.priority === 'Urgent' ? 'border-orange-200' : 'border-gray-200'}`}>

                {/* Ticket header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(t)}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span>
                      {t.ticket_type && <span className="text-xs text-gray-400">→ {t.ticket_type}</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">{t.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canEdit(t) && !isEditing && <button onClick={() => { setEditingId(t.id); setEditForm({ status: t.status, priority: t.priority, owner: t.owner||'', category: t.category, ticket_type: t.ticket_type||'', sla_hours: t.sla_hours }) }} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition">✎ Edit</button>}
                    {canManage && <button onClick={() => deleteTicket(t.id)} className="text-gray-300 hover:text-red-500 text-sm transition ml-1">×</button>}
                  </div>
                </div>

                {/* Ticket meta row */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
                  <div><span className="text-gray-400">Requested by</span><br/><span className="text-gray-700 font-medium">{(t.requested_by||t.created_by).split('@')[0]}</span></div>
                  <div><span className="text-gray-400">Owner</span><br/><span className="text-gray-700 font-medium">{t.owner ? t.owner.split('@')[0] : <span className="text-gray-300 italic">Unassigned</span>}</span></div>
                  <div><span className="text-gray-400">SLA</span><br/><span className={`font-medium ${sla.color}`}>{sla.label}</span></div>
                  <div><span className="text-gray-400">Submitted</span><br/><span className="text-gray-700">{new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-700">Edit Ticket</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Category</label>
                        <select value={editForm.category||''} onChange={e=>setEditForm(p=>({...p,category:e.target.value,ticket_type:TICKET_TYPES[e.target.value][0]}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                          {TICKET_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Ticket Type</label>
                        <select value={editForm.ticket_type||''} onChange={e=>setEditForm(p=>({...p,ticket_type:e.target.value}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                          {(TICKET_TYPES[editForm.category||'IT']||[]).map(tp=><option key={tp}>{tp}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Status</label>
                        <select value={editForm.status||''} onChange={e=>setEditForm(p=>({...p,status:e.target.value as Ticket['status']}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                          {['Open','In Progress','Resolved','Closed'].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Priority</label>
                        <select value={editForm.priority||''} onChange={e=>setEditForm(p=>({...p,priority:e.target.value as Ticket['priority']}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                          {['Low','Medium','High','Urgent'].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">SLA (hours)</label>
                        <input type="number" min={1} value={editForm.sla_hours||24} onChange={e=>setEditForm(p=>({...p,sla_hours:parseInt(e.target.value)||24}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Owner</label>
                        <select value={editForm.owner||''} onChange={e=>setEditForm(p=>({...p,owner:e.target.value}))} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                          <option value="">Unassigned</option>
                          {allEmployees.map(e=><option key={e.email} value={e.email}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                      <button onClick={() => saveEdit(t.id)} className="text-sm px-3 py-1.5 rounded-lg bg-blue-900 text-white hover:bg-blue-800 transition">Save Changes</button>
                    </div>
                  </div>
                )}

                {/* Expanded details */}
                {expandedId === t.id && !isEditing && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Details</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{t.description}</p>
                    </div>
                    {t.ticket_type && TICKET_TYPE_DEFINITIONS[t.ticket_type] && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                        ℹ️ <strong>{t.ticket_type}:</strong> {TICKET_TYPE_DEFINITIONS[t.ticket_type]}
                      </div>
                    )}
                    {t.attachments && t.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {t.attachments.map((att,i) => (
                          <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-lg px-2 py-1.5 text-xs text-blue-700 transition">
                            <span>{att.type==='image'?'🖼':att.type==='pdf'?'📄':'📝'}</span><span>{att.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Comments */}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-medium text-gray-500">Progress Notes</p>
                      {(comments[t.id]||[]).length === 0 ? (
                        <p className="text-xs text-gray-400">No notes yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(comments[t.id]||[]).map((c:any) => (
                            <div key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.is_resolution?'bg-blue-50 border border-blue-100':'bg-gray-50 border border-gray-100'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-700">{c.commented_by?.split('@')[0]}</span>
                                {c.is_resolution && <span className="text-[10px] px-1.5 py-0 rounded-full bg-blue-100 text-blue-700 font-medium">Admin Update</span>}
                                <span className="text-xs text-gray-400 ml-auto">{new Date(c.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>
                              </div>
                              <p className="text-gray-700 whitespace-pre-wrap">{c.comment}</p>
                              {c.attachments && c.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {c.attachments.map((att:any,i:number) => att.type === 'image' ? (
                                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                                      <img src={att.url} alt={att.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition" />
                                    </a>
                                  ) : (
                                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-white border border-gray-200 hover:border-blue-300 rounded-lg px-2 py-1 text-xs text-blue-700 transition">
                                      <span>{att.type==='pdf'?'📄':'📝'}</span><span>{att.name}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {(canManage || t.created_by === currentUser) && (
                        <div className="space-y-2 pt-1">
                          {commentAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {commentAttachments.map((att,i) => (
                                <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600">
                                  <span>{att.type==='image'?'🖼':att.type==='pdf'?'📄':'📝'}</span><span>{att.name}</span>
                                  <button onClick={() => setCommentAttachments(prev => prev.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500 ml-1">×</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} placeholder={canManage?'Add a status update or resolution note...':'Add additional details...'} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" onKeyDown={e=>{if(e.key==='Enter')postComment(t)}} />
                            <label className="flex items-center justify-center px-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 cursor-pointer transition text-sm">
                              📎
                              <input type="file" className="hidden" disabled={uploadingComment} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCommentFile(f); e.target.value = '' }} />
                            </label>
                            <button onClick={() => postComment(t)} disabled={postingComment||uploadingComment||(!commentDraft.trim() && commentAttachments.length===0)} className="bg-blue-900 hover:bg-blue-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50">{postingComment?'...':uploadingComment?'Uploading...':'Add'}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick expand toggle */}
                {expandedId !== t.id && (
                  <button onClick={() => toggleExpand(t)} className="text-xs text-blue-500 hover:underline">▼ View details</button>
                )}
                {expandedId === t.id && !isEditing && (
                  <button onClick={() => setExpandedId(null)} className="text-xs text-blue-500 hover:underline">▲ Hide details</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -- Observations Panel ------------------------------------------------------
// -- My Observations (Agent view: own notes only, read-only) ----------------
function MyObservations({ employees, currentUser }: { employees: Employee[], currentUser: string | null }) {
  const [obs, setObs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      if (!currentUser) { setLoading(false); return }
      const myEmp = employees.find(e => e.email?.toLowerCase() === currentUser.toLowerCase())
      if (!myEmp) { setObs([]); setLoading(false); return }
      const { data } = await supabase.from('observations').select('*').eq('employee_id', myEmp.id).order('created_at', { ascending: false })
      setObs(data || [])
      setLoading(false)
    }
    load()
  }, [currentUser, employees])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div><h2 className="text-xl font-bold text-blue-900">My Observations</h2><p className="text-sm text-gray-500">Notes your Team Lead or Manager have shared about your performance. Only visible to you.</p></div>
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : obs.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-3 opacity-30"/><p className="text-sm">No observations recorded for you yet.</p></div>
      ) : (
        <div className="space-y-3">
          {obs.map(o => (
            <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{o.month_label}</span>
                <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{o.observation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ObservationsPanel({ employees, currentUser, userRole, showToast }:
  { employees: Employee[], currentUser: string | null, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [obs, setObs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selEmp, setSelEmp] = useState<string>('')
  const [selMonth, setSelMonth] = useState<string>('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterEmp, setFilterEmp] = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [myTeamEmployeeIds, setMyTeamEmployeeIds] = useState<string[] | null>(null)

  const allMonths = ['2024','2025','2026','2027'].flatMap(y => MONTHS.map(m => `${m} ${y}`))

  useEffect(() => {
    if (employees.length > 0 && !selEmp) setSelEmp(employees[0].id)
  }, [employees])

  // Team Leads only see observations for employees on teams they lead.
  // Manager/Super Admin see everyone (no scoping applied).
  useEffect(() => {
    async function loadMyTeamScope() {
      if (userRole !== 'Team Lead' || !currentUser) { setMyTeamEmployeeIds(null); return }
      const myEmp = employees.find(e => e.email?.toLowerCase() === currentUser.toLowerCase())
      if (!myEmp) { setMyTeamEmployeeIds([]); return }
      const { data: myTeams } = await supabase.from('teams').select('id').eq('team_lead_id', myEmp.id)
      const teamIds = (myTeams || []).map(t => t.id)
      if (teamIds.length === 0) { setMyTeamEmployeeIds([]); return }
      const { data: members } = await supabase.from('team_members').select('employee_id').in('team_id', teamIds)
      setMyTeamEmployeeIds((members || []).map(m => m.employee_id))
    }
    loadMyTeamScope()
  }, [userRole, currentUser, employees])

  // Employees visible to the current viewer in dropdowns/filters
  const visibleEmployees = myTeamEmployeeIds === null
    ? employees
    : employees.filter(e => myTeamEmployeeIds.includes(e.id))

  async function loadObs() {
    setLoading(true)
    let q = supabase.from('observations').select('*').order('created_at', { ascending: false }).limit(200)
    if (filterEmp !== 'all') q = q.eq('employee_id', filterEmp)
    if (filterMonth !== 'all') q = q.eq('month_label', filterMonth)
    // Team Leads are scoped to their own team's employees only -- this is
    // a real query filter, not just hiding rows after the fact, so a
    // Team Lead never receives another team's observation data at all.
    if (myTeamEmployeeIds !== null) {
      if (myTeamEmployeeIds.length === 0) { setObs([]); setLoading(false); return }
      q = q.in('employee_id', myTeamEmployeeIds)
    }
    const { data } = await q
    setObs(data || [])
    setLoading(false)
  }

  useEffect(() => { loadObs() }, [filterEmp, filterMonth, myTeamEmployeeIds])

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
                {visibleEmployees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name} — {e.employment_type||'Agent'} ({e.client||'AB BSS'})</option>)}
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
            className="bg-blue-600 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2">
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
              {visibleEmployees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name.split(',')[0]} — {e.employment_type||'Agent'} ({e.client||'AB BSS'})</option>)}
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
        <label className={`cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
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
// -- Matrix (dev tracker: features, issues, pending SQL) --------------------
type MatrixItem = {
  id: string
  category: 'Feature' | 'Issue' | 'Pending SQL' | 'Security Fix' | 'RLS Fix' | 'Refactor' | 'Documentation'
  title: string
  description: string | null
  status: 'Open' | 'In Progress' | 'Blocked' | 'Done'
  priority: 'Low' | 'Medium' | 'High'
  created_by: string | null
  created_at: string
}

const MATRIX_CATEGORIES = ['Feature', 'Issue', 'Pending SQL', 'Security Fix', 'RLS Fix', 'Refactor', 'Documentation'] as const
const MATRIX_STATUS_COLORS: Record<string, string> = { Open: 'bg-blue-100 text-blue-700', 'In Progress': 'bg-amber-100 text-amber-700', Blocked: 'bg-red-100 text-red-700', Done: 'bg-emerald-100 text-emerald-700' }
const MATRIX_PRIORITY_COLORS: Record<string, string> = { Low: 'bg-gray-100 text-gray-600', Medium: 'bg-orange-100 text-orange-700', High: 'bg-red-100 text-red-700' }
const MATRIX_CATEGORY_COLORS: Record<string, string> = { Feature: 'bg-indigo-50 text-indigo-700 border-indigo-200', Issue: 'bg-red-50 text-red-700 border-red-200', 'Pending SQL': 'bg-purple-50 text-purple-700 border-purple-200', 'Security Fix': 'bg-rose-50 text-rose-700 border-rose-200', 'RLS Fix': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', Refactor: 'bg-cyan-50 text-cyan-700 border-cyan-200', Documentation: 'bg-slate-50 text-slate-700 border-slate-200' }

function MatrixPanel({ currentUser, showToast }: { currentUser: string|null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [items, setItems] = useState<MatrixItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('All')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [handoverView, setHandoverView] = useState(false)
  const emptyForm = { category: 'Issue' as MatrixItem['category'], title: '', description: '', priority: 'Medium' as MatrixItem['priority'] }
  const [form, setForm] = useState(emptyForm)

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase.from('dev_matrix').select('*').order('created_at', { ascending: false })
    setItems((data || []) as MatrixItem[])
    setLoading(false)
  }

  useEffect(() => { loadItems() }, [])

  async function addItem() {
    if (!form.title.trim()) { showToast('Please add a title.', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('dev_matrix').insert({
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      status: 'Open',
      created_by: currentUser,
    })
    setSaving(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Added to Matrix!')
    setForm(emptyForm)
    setShowForm(false)
    loadItems()
  }

  async function updateStatus(id: string, status: MatrixItem['status']) {
    await supabase.from('dev_matrix').update({ status }).eq('id', id)
    loadItems()
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this item from the Matrix?')) return
    await supabase.from('dev_matrix').delete().eq('id', id)
    showToast('Removed')
    loadItems()
  }

  const filtered = items.filter(i =>
    (filterCategory === 'All' || i.category === filterCategory) &&
    (filterStatus === 'All' || i.status === filterStatus)
  )

  const openCount = items.filter(i => i.status !== 'Done').length

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <div>
            <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-blue-500"/>Matrix — Build Tracker</h3>
            <p className="text-xs text-gray-400 mt-0.5">Track features shipped, issues to fix, and SQL still pending in Supabase. {openCount} open item{openCount !== 1 ? 's' : ''}.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHandoverView(!handoverView)} className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"><FileText className="w-4 h-4"/>{handoverView ? 'Back to Matrix' : 'Handover View'}</button>
            <button onClick={() => setShowForm(!showForm)} className="text-sm bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition flex items-center gap-1.5"><PlusCircle className="w-4 h-4"/>{showForm ? 'Cancel' : 'Add Item'}</button>
          </div>
        </div>

        {!handoverView && showForm && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as MatrixItem['category'] }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                {MATRIX_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as MatrixItem['priority'] }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </div>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Short title, e.g. 'Ticket status buttons hard to find'" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Details (optional)..." rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900 resize-none" />
            <div className="flex justify-end">
              <button onClick={addItem} disabled={saving} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">{saving ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        )}
      </div>

      {handoverView ? (
        <HandoverDoc items={items} />
      ) : (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        {['All', ...MATRIX_CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCategory(c)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition border ${filterCategory === c ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{c}</button>
        ))}
        <span className="text-gray-300">|</span>
        {['All', 'Open', 'In Progress', 'Blocked', 'Done'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition border ${filterStatus === s ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">Nothing here yet — add the first item above.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${MATRIX_CATEGORY_COLORS[item.category]}`}>{item.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MATRIX_PRIORITY_COLORS[item.priority]}`}>{item.priority}</span>
                  <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-500 text-xs transition flex-shrink-0">×</button>
              </div>
              {item.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.description}</p>}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-gray-400">{item.created_by?.split('@')[0] || 'Unknown'} · {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <div className="flex items-center gap-1.5">
                  {(['Open', 'In Progress', 'Blocked', 'Done'] as MatrixItem['status'][]).map(s => (
                    <button key={s} onClick={() => updateStatus(item.id, s)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${item.status === s ? MATRIX_STATUS_COLORS[s] + ' ring-1 ring-offset-1 ring-blue-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  )
}

function HandoverDoc({ items }: { items: MatrixItem[] }) {
  const shipped = items.filter(i => i.status === 'Done').sort((a,b) => a.created_at.localeCompare(b.created_at))
  const pendingSql = items.filter(i => i.category === 'Pending SQL' && i.status !== 'Done')
  const openIssues = items.filter(i => i.category === 'Issue' && i.status !== 'Done')
  const blocked = items.filter(i => i.status === 'Blocked')
  const other = items.filter(i => i.status !== 'Done' && i.category !== 'Pending SQL' && i.category !== 'Issue' && i.status !== 'Blocked')

  function handlePrint() {
    document.body.classList.add('printing-handover')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-handover'), 500)
  }

  const Section = ({ title, list, emptyText, tone }: { title: string, list: MatrixItem[], emptyText: string, tone: string }) => (
    <div className="mb-6">
      <h3 className={`text-sm font-bold uppercase tracking-wide mb-2 ${tone}`}>{title} ({list.length})</h3>
      {list.length === 0 ? <p className="text-sm text-gray-400 italic">{emptyText}</p> : (
        <div className="space-y-2">
          {list.map(i => (
            <div key={i.id} className="border-l-2 border-gray-200 pl-3 py-1">
              <p className="font-semibold text-sm text-gray-900">{i.title} <span className="text-xs text-gray-400 font-normal">({i.category}{i.priority === 'High' ? ' · High priority' : ''})</span></p>
              {i.description && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{i.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={handlePrint} className="text-sm bg-blue-900 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition">🖨 Print / Save as PDF</button>
      </div>
      <div className="print-handover bg-white rounded-xl border border-gray-200 p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">ABBSS Operations Portal — Handover Summary</h1>
        <p className="text-sm text-gray-500 mt-1">Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {items.length} total Matrix entries</p>
        <hr className="my-5 border-gray-200" />

        <Section title="⚠ Blocked -- needs attention before proceeding" list={blocked} emptyText="Nothing currently blocked." tone="text-red-700" />
        <Section title="Pending SQL migrations -- must be run in Supabase" list={pendingSql} emptyText="No pending SQL migrations outstanding." tone="text-purple-700" />
        <Section title="Open issues" list={openIssues} emptyText="No open issues logged." tone="text-orange-700" />
        {other.length > 0 && <Section title="Other open items" list={other} emptyText="" tone="text-gray-600" />}
        <Section title="Shipped features (chronological)" list={shipped} emptyText="Nothing marked Done yet." tone="text-emerald-700" />
      </div>
    </div>
  )
}

function SettingsPanel({ currentUser, userRole, showToast }: { currentUser: string|null, userRole: string, showToast: (m: string, t?: 'success'|'error') => void }) {
  const [activeTab, setActiveTab] = useState<'users'|'activity'|'password'|'manual'>(userRole === 'agent' ? 'password' : 'users')
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
        {([['users','App Users'],['activity','Audit Log'],['manual','Manual'],['password','Change Password']] as [string,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab===t?'bg-white shadow text-blue-900':'text-gray-600 hover:text-gray-900'}`}>{l}</button>
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
      {activeTab==='manual' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500"/>What Each Tab Does</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Announcements', 'Company-wide posts. Everyone can acknowledge; Team Lead+ can post.'],
                ['Gaming Hub', 'Monthly game leaderboard. Submit a screenshot score; admins review and approve.'],
                ['Tickets', 'Issue/request tracking with comments, screenshot attachments, and auto-resetting 24hr SLA.'],
                ['Tasks', 'Assign to-dos to one or more people. Board view groups by status; feeds into Compliance scoring.'],
                ['BCP', 'Business continuity plan and contingency procedures reference.'],
                ['Links', 'Quick-access company tools, grouped by client, with search.'],
                ['Resources', 'Shared reference documents and guides.'],
                ['Time Tracker', 'Paste time-tracking period exports to compute Attendance % and apply it to KPI records.'],
                ['Employee Records', 'Full HR profile data. Manager access and above.'],
                ['Hiring Pipeline', 'External recruiting/hiring tool -- opens in a new tab.'],
                ['KPI Entry', 'Enter or edit an employee\'s monthly Attendance/Accuracy/Efficiency/Feedback/Compliance scores.'],
                ['Observations', 'Log coaching observations and 1-on-1 notes for an employee.'],
                ['Coaching & 1-on-1', 'Structured coaching session records, with optional acknowledgment.'],
                ['Team Compliance', 'Who has and hasn\'t acknowledged coaching sessions/announcements or completed tasks, per employee, per month -- with a drill-down to the exact missing items.'],
                ['Operating Cadence', 'Recurring team rituals (huddles, reviews) and completion tracking.'],
                ['TL Scorecard', 'A Team Lead\'s own composite score: Compliance + Team Performance + Attendance.'],
                ['Dashboard', 'Team-wide KPI overview -- filterable by client, team, and time period, with charts.'],
                ['Employee Trends', 'One employee\'s performance history over time, with a focus-month selector.'],
                ['Team View', 'KPI scores for one team at a time, editable inline by Team Lead+.'],
                ['Employees', 'Manage employee profiles, roles, and status.'],
                ['Teams', 'Group employees into teams and assign a Team Lead.'],
                ['Org Chart', 'Visual reporting structure by client and team.'],
                ['Matrix', 'Internal dev log of features shipped, issues, and pending SQL migrations.'],
                ['Settings', 'App users, audit log, this manual, and your own password.'],
              ].map(([title, desc]) => (
                <div key={title} className="border border-gray-100 rounded-lg p-3">
                  <p className="font-semibold text-sm text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-1 flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500"/>Who Can Do What</h3>
            <p className="text-xs text-gray-400 mb-4">General access pattern by role. Some features have finer-grained rules than shown here -- ask if you need the exact behavior for something specific.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Feature</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Agent</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Team Lead</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Admin</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Super Admin</th>
                </tr></thead>
                <tbody>
                  {[
                    ['KPI scores -- view', 'View only', 'View', 'View', 'View'],
                    ['KPI scores -- edit/delete', '—', '✓', '✓', '✓'],
                    ['Compliance auto-calc', 'View only', 'View', 'View', 'View'],
                    ['Tasks -- assign to others', '—', '✓', '✓', '✓'],
                    ['Tasks -- visibility', 'Own only', 'Own + assigned by them', 'Own + assigned by them', 'Everyone'],
                    ['Tickets -- manage/close', 'Own only', '✓', '✓', '✓'],
                    ['Announcements -- post', '—', '✓', '✓', '✓'],
                    ['Employee Records', '—', '—', '✓', '✓'],
                    ['Time Tracker', '—', '—', '✓', '✓'],
                    ['Employees / Teams -- manage', '—', '—', '✓', '✓'],
                    ['Directory Links -- manage', '—', '—', '✓', '✓'],
                    ['TL Scorecard -- view', '—', 'Own only', 'Everyone', 'Everyone'],
                    ['Team Compliance (acks) -- view', '—', 'Own team only', 'Everyone', 'Everyone'],
                    ['Matrix (dev log)', '—', '—', '✓', '✓'],
                    ['App Users -- create/edit roles', '—', '—', 'View', '✓'],
                    ['Settings access', '—', '—', '—', '✓'],
                  ].map(row => (
                    <tr key={row[0]} className="border-b border-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{row[0]}</td>
                      {row.slice(1).map((cell, i) => (
                        <td key={i} className={`px-3 py-2 text-center ${cell === '✓' ? 'text-emerald-600 font-semibold' : cell === '—' ? 'text-gray-300' : 'text-gray-500'}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-4">To change what a specific person can access, go to the <button onClick={()=>setActiveTab('users')} className="text-blue-700 hover:underline font-medium">App Users</button> tab and update their role. Per-user access grants beyond the 4 standard roles aren't supported yet -- let your admin know if you need something more granular.</p>
          </div>
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

// -- Viewer Coaching Banner --------------------------------------------------
function ViewerCoachingBanner({ currentUser }: { currentUser: string | null }) {
  const [pending, setPending] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    supabase.from('coaching_logs')
      .select('id, date, type, discussion, coached_by')
      .eq('employee_email', currentUser.toLowerCase())
      .eq('requires_acknowledgment', true)
      .eq('agent_acknowledged', false)
      .order('date', { ascending: false })
      .then(({ data }) => { setPending(data || []); setLoaded(true) })
  }, [currentUser])

  if (!loaded) return null

  if (pending.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        You are all caught up! No pending coaching acknowledgments.
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">✍️</span>
        <div>
          <p className="font-bold text-amber-800 text-base">
            {pending.length} coaching session{pending.length > 1 ? 's' : ''} require{pending.length === 1 ? 's' : ''} your acknowledgment
          </p>
          <p className="text-xs text-amber-600 mt-0.5">Your Team Lead has logged a coaching session. Please review and sign off below.</p>
        </div>
      </div>
      <div className="space-y-2">
        {pending.map(p => (
          <div key={p.id} className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-amber-700">{p.type}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-xs text-gray-600">{new Date(p.date).toLocaleDateString('en-PH', {month:'long',day:'numeric',year:'numeric'})}</span>
              {p.coached_by && <span className="text-xs text-gray-400 ml-2">by {p.coached_by.split('@')[0]}</span>}
            </div>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⏳ Pending</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-amber-600">👇 Scroll to the Coaching Log table below to sign & acknowledge each session.</p>
    </div>
  )
}

// -- TL Scorecard -------------------------------------------------------------
// TLScorecard v3
function TLScorecard({ currentUser, userRole, showToast, records }: { currentUser: string|null, userRole: string, showToast: (m:string,t?:'success'|'error')=>void, records: KpiRecord[] }) {
  const isManager = userRole === 'super_admin' || userRole === 'admin'
  const [period, setPeriod] = useState<'mtd'|'weekly'>('mtd')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()) // 0-indexed
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all')
  const [tlTeams, setTlTeams] = useState<{id:string,name:string}[]>([])
  const [selectedTL, setSelectedTL] = useState<string>('')
  const [tlList, setTlList] = useState<{empId:string,email:string,name:string,photo:string|null}[]>([])
  const [score, setScore] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Period helpers
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const currentYear = new Date().getFullYear()
  const years = Array.from({length: 3}, (_,i) => currentYear - i)

  function getPeriodBounds() {
    if (period === 'mtd') {
      const start = new Date(selectedYear, selectedMonth, 1)
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59)
      const isCurrentMonth = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear()
      return {
        start: start.toISOString(),
        end: isCurrentMonth ? new Date().toISOString() : end.toISOString(),
        label: `${MONTHS[selectedMonth]} ${selectedYear}`
      }
    } else {
      const now = new Date()
      const day = now.getDay()
      const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); monday.setHours(0,0,0,0)
      return { start: monday.toISOString(), end: now.toISOString(), label: `Week of ${monday.toLocaleDateString('en-US',{month:'short',day:'numeric'})}` }
    }
  }

  const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`

  useEffect(() => {
    if (isManager) loadTLList()
    else {
      // For Team Lead — look up their employee ID by email
      supabase.from('employees').select('id').ilike('email', currentUser?.toLowerCase() || '').maybeSingle()
        .then(({ data }) => { if (data?.id) setSelectedTL(data.id) })
    }
  }, [])

  useEffect(() => {
    if (selectedTL) loadTLTeams(true)
  }, [selectedTL])

  useEffect(() => {
    if (selectedTL) loadScorecard()
  }, [selectedTL, period, selectedMonth, selectedYear, selectedTeamId, records])

  async function loadTLTeams(resetTeam = false) {
    const { data } = await supabase.from('teams').select('id,name').eq('team_lead_id', selectedTL).eq('active', true)
    setTlTeams(data || [])
    if (resetTeam) setSelectedTeamId('all')
  }

  async function loadTLList() {
    try {
      // Step 1: get unique team_lead_ids from active teams
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams').select('team_lead_id').eq('active', true).not('team_lead_id', 'is', null)
      if (teamsErr) { console.error('teams error:', teamsErr); setLoading(false); return }
      const uniqueIds = [...new Set((teamsData||[]).map((t:any) => t.team_lead_id).filter(Boolean))]
      if (uniqueIds.length === 0) { setLoading(false); return }
      // Step 2: get employee details for those IDs
      const { data: emps, error: empsErr } = await supabase
        .from('employees').select('id, name, email').in('id', uniqueIds)
      if (empsErr) { console.error('emps error:', empsErr); setLoading(false); return }
      const list = (emps||[]).map((e:any) => ({
        empId: e.id, name: e.name,
        email: e.email?.toLowerCase() || '',
        photo: null
      })).sort((a:any,b:any) => a.name.localeCompare(b.name))
      setTlList(list as any)
      if (list.length > 0) setSelectedTL(list[0].empId)
      else setLoading(false)
    } catch(e) { console.error('loadTLList failed:', e); setLoading(false) }
  }

  async function loadScorecard() {
    if (!selectedTL) return
    setLoading(true)
    const { start, end } = getPeriodBounds()

    // --- COMPLIANCE (30%) ---
    // 1. Cadence compliance (avg daily/weekly/monthly for period)
    const periods = ['daily','weekly','monthly']
    let cadenceTotal = 0
    for (const freq of periods) {
      const { data: items } = await supabase.from('cadence_items').select('id').is('retired_at',null).eq('frequency',freq)
      const totalItems = (items||[]).length
      if (totalItems === 0) { cadenceTotal += 100; continue }
      const { data: completions } = await supabase.from('cadence_completions')
        .select('period_key,done').eq('team_lead_email',selectedTL).eq('frequency',freq).eq('done',true)
        .gte('period_key', start.slice(0,10)).lte('period_key', end.slice(0,10))
      const uniquePeriods = new Set((completions||[]).map((c:any)=>c.period_key))
      const avgRate = uniquePeriods.size > 0
        ? Array.from(uniquePeriods).reduce((sum,pk) => {
            const count = (completions||[]).filter((c:any)=>c.period_key===pk).length
            return sum + Math.min(count/totalItems,1)*100
          }, 0) / uniquePeriods.size
        : 0
      cadenceTotal += avgRate
    }
    const cadenceScore = cadenceTotal / 3

    // 2. Coaching sessions (target: 2/month or 0.5/week)
    const coachTarget = period === 'mtd' ? 2 : 1
    const { count: coachCount } = await supabase.from('coaching_logs').select('id',{count:'exact',head:true})
      .eq('coached_by',selectedTL).gte('date',start.slice(0,10)).lte('date',end.slice(0,10))
    const coachScore = Math.min((coachCount||0)/coachTarget,1)*100

    // 3. Observations (target: 4/month or 1/week)
    const obsTarget = period === 'mtd' ? 4 : 1
    const { count: obsCount } = await supabase.from('observations').select('id',{count:'exact',head:true})
      .eq('observed_by',selectedTL).gte('created_at',start).lte('created_at',end)
    const obsScore = Math.min((obsCount||0)/obsTarget,1)*100

    // 4. Tickets resolved
    const { count: ticketsOwned } = await supabase.from('tickets').select('id',{count:'exact',head:true})
      .eq('owner',selectedTL).gte('created_at',start).lte('created_at',end)
    const { count: ticketsResolved } = await supabase.from('tickets').select('id',{count:'exact',head:true})
      .eq('owner',selectedTL).in('status',['Resolved','Closed']).gte('created_at',start).lte('created_at',end)
    const ticketScore = (ticketsOwned||0) > 0 ? Math.min((ticketsResolved||0)/(ticketsOwned||1),1)*100 : 100

    // 5. Huddle notes (target: 4/month or 1/week)
    const huddleTarget = period === 'mtd' ? 4 : 1
    const { count: huddleCount } = await supabase.from('huddle_notes').select('id',{count:'exact',head:true})
      .eq('created_by',selectedTL).gte('created_at',start).lte('created_at',end)
    const huddleScore = Math.min((huddleCount||0)/huddleTarget,1)*100

    // 6. KPI entry compliance (target: 1 entry per month)
    const { count: kpiCount } = await supabase.from('kpi_records').select('id',{count:'exact',head:true})
      .eq('month_label',monthLabel)
    const kpiScore = (kpiCount||0) > 0 ? 100 : 0

    const complianceSubScores = { cadenceScore, coachScore, obsScore, ticketScore, huddleScore, kpiScore }
    const complianceScore = (cadenceScore + coachScore + obsScore + ticketScore + huddleScore + kpiScore) / 6

    // Get TL photo
    // selectedTL is now employee UUID from teams table
    const { data: tlEmpInfo } = await supabase.from('employees').select('id,name,email').eq('id', selectedTL).maybeSingle()
    const tlPhoto = null
    const tlName = tlEmpInfo?.name || 'Unknown'

    // Get teams led by this TL
    const { data: tlTeamsData } = await supabase.from('teams').select('id,name,department').eq('team_lead_id', selectedTL).eq('active', true)
    let teamPerfScore = 0
    if (tlEmpInfo) {
      const { data: tlTeamsAll } = await supabase.from('teams').select('id').eq('team_lead_id', selectedTL).eq('active', true)
      const teamIds = selectedTeamId === 'all'
        ? (tlTeamsAll||[]).map((t:any) => t.id)
        : [selectedTeamId]
      if (teamIds.length > 0) {
        const { data: memberIds } = await supabase.from('team_members').select('employee_id').in('team_id', teamIds)
        const empIds = (memberIds||[]).map((m:any) => m.employee_id)
        if (empIds.length > 0) {
          const { data: kpiData } = await supabase.from('kpi_records').select('attendance,accuracy,efficiency,feedback,overall_score')
            .in('employee_id', empIds).eq('month_label', monthLabel)
          if ((kpiData||[]).length > 0) {
            const avg = (kpiData||[]).reduce((sum:number, r:any) => {
              const scorePct = (r.overall_score !== null && r.overall_score !== undefined)
                ? r.overall_score * 100
                : ((r.attendance||0)+(r.accuracy||0)+(r.efficiency||0)+(r.feedback||0))/4*100
              return sum + scorePct
            }, 0) / (kpiData||[]).length
            teamPerfScore = Math.min(avg, 100)
          }
        }
      }
    }

    // --- INDIVIDUAL ATTENDANCE (20%) ---
    let attendanceScore = 0
    if (tlEmpInfo) {
      const { data: tlKPI } = await supabase.from('kpi_records').select('attendance,overall_score')
        .eq('employee_id', selectedTL).eq('month_label', monthLabel).maybeSingle()
      attendanceScore = (tlKPI?.attendance || 0) * 100
    }

    // --- OVERALL ---
    const overall = (complianceScore * 0.30) + (teamPerfScore * 0.50) + (attendanceScore * 0.20)

    setScore({
      overall, complianceScore, teamPerfScore, attendanceScore,
      tlPhoto, tlName, tlTeams: tlTeamsData || [],
      ...complianceSubScores,
      coachCount: coachCount||0, coachTarget,
      obsCount: obsCount||0, obsTarget,
      ticketsOwned: ticketsOwned||0, ticketsResolved: ticketsResolved||0,
      huddleCount: huddleCount||0, huddleTarget,
      kpiCount: kpiCount||0,
    })
    setLoading(false)
  }

  function ScoreRing({ value, size=80, color }: { value:number, size?:number, color:string }) {
    const r = (size-10)/2, circ = 2*Math.PI*r
    const pct = Math.min(Math.max(value,0),100)
    const fontSize = size > 70 ? 16 : 12
    return (
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={8}/>
        {/* Progress arc — starts at top (−π/2) */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}/>
        {/* Text stays upright — no rotation needed */}
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fontSize={fontSize} fontWeight="700" fill={color}>{Math.round(pct)}%</text>
      </svg>
    )
  }

  function getColor(v:number) { return v>=80?'#10b981':v>=60?'#f59e0b':'#ef4444' }

  const SubItem = ({ label, score, count, target, extra }: { label:string, score:number, count?:number, target?:number, extra?:string }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 font-medium">{label}</p>
        {count !== undefined && target !== undefined && (
          <p className="text-xs text-gray-400 mt-0.5">{count} of {target} {extra||''}</p>
        )}
        {extra && count === undefined && <p className="text-xs text-gray-400 mt-0.5">{extra}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-24 bg-gray-100 rounded-full h-2">
          <div className="h-2 rounded-full transition-all" style={{width:`${Math.min(score,100)}%`,background:getColor(score)}}/>
        </div>
        <span className="text-sm font-semibold w-10 text-right" style={{color:getColor(score)}}>{Math.round(score)}%</span>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Team Lead Scorecard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Performance overview across Compliance, Team, and Attendance</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && tlList.length > 0 && (
            <select value={selectedTL} onChange={e=>setSelectedTL(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900">
              {tlList.map((tl:any) => <option key={tl.empId} value={tl.empId}>{tl.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {tlTeams.length > 0 && (
              <select value={selectedTeamId} onChange={e=>setSelectedTeamId(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900">
                <option value="all">All Teams</option>
                {tlTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={()=>setPeriod('mtd')} className={`px-3 py-1.5 font-medium transition ${period==='mtd'?'bg-blue-900 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>Monthly</button>
              <button onClick={()=>setPeriod('weekly')} className={`px-3 py-1.5 font-medium transition ${period==='weekly'?'bg-blue-900 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>Weekly</button>
            </div>
            {period === 'mtd' && (
              <div className="flex items-center gap-1">
                <select value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900">
                  {MONTHS.map((m,i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-900">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading scorecard...</div>
      ) : !score ? (
        <div className="text-center py-16 text-gray-400 text-sm">No data available.</div>
      ) : (
        <>
        {/* Overall score */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            {/* TL Photo */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
              {score.tlPhoto
                ? <img src={score.tlPhoto} alt={score.tlName} className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">{(score.tlName||'?').charAt(0).toUpperCase()}</div>
              }
            </div>
            <div>
              <p className="font-bold text-gray-900 text-base">{score.tlName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{getPeriodBounds().label}</p>
              {score.tlTeams.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {score.tlTeams.map((t:any) => (
                    <span key={t.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <ScoreRing value={score.overall} size={96} color={getColor(score.overall)} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{Math.round(score.overall)}%</p>
              <p className="text-sm text-gray-500">Overall Score</p>
            </div>
            <div className="ml-auto flex items-center gap-6 flex-wrap">
              {[
                {label:'Compliance',val:score.complianceScore,weight:'30%'},
                {label:'Team Perf.',val:score.teamPerfScore,weight:'50%'},
                {label:'Attendance',val:score.attendanceScore,weight:'20%'},
              ].map(c => (
                <div key={c.label} className="text-center">
                  <ScoreRing value={c.val} size={60} color={getColor(c.val)} />
                  <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                  <p className="text-xs text-gray-400">{c.weight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compliance breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Compliance Breakdown</h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">30% weight</span>
          </div>
          <SubItem label="Cadence Compliance" score={score.cadenceScore} extra="Avg across daily, weekly, monthly" />
          <SubItem label="Coaching Sessions" score={score.coachScore} count={score.coachCount} target={score.coachTarget} extra="sessions" />
          <SubItem label="Observations Logged" score={score.obsScore} count={score.obsCount} target={score.obsTarget} extra="observations" />
          <SubItem label="Tickets Resolved" score={score.ticketScore} count={score.ticketsResolved} target={score.ticketsOwned} extra="tickets owned" />
          <SubItem label="Huddle Notes Posted" score={score.huddleScore} count={score.huddleCount} target={score.huddleTarget} extra="huddles" />
          <SubItem label="KPI Entry Compliance" score={score.kpiScore} extra={score.kpiCount > 0 ? 'Entry submitted this month' : 'No entry submitted yet'} />
        </div>

        {/* Team Performance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Team Performance</h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">50% weight</span>
          </div>
          <div className="flex items-center gap-4">
            <ScoreRing value={score.teamPerfScore} size={70} color={getColor(score.teamPerfScore)} />
            <div>
              <p className="text-sm text-gray-700">Average KPI score of all team members</p>
              <p className="text-xs text-gray-400 mt-0.5">Based on productivity, quality, and attendance from KPI Entry for {monthLabel}</p>
            </div>
          </div>
        </div>

        {/* Individual Attendance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Individual Attendance</h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">20% weight</span>
          </div>
          <div className="flex items-center gap-4">
            <ScoreRing value={score.attendanceScore} size={70} color={getColor(score.attendanceScore)} />
            <div>
              <p className="text-sm text-gray-700">Team Lead's personal attendance score</p>
              <p className="text-xs text-gray-400 mt-0.5">From KPI Entry attendance field for {monthLabel}</p>
              {score.attendanceScore === 0 && <p className="text-xs text-amber-500 mt-1">⚠️ No attendance record found for this month</p>}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  )
}

// -- TL Tools: Coaching Log + Compliance ------------------------------------
type ComplianceDetail = ComplianceBreakdown & {
  missingCoaching: { title: string, date: string }[]
  missingAnnouncements: { title: string }[]
  missingTasks: { title: string }[]
}

// Like getComplianceBreakdown, but also returns the specific items still
// needing acknowledgment so a Team Lead can see exactly who's missing what,
// not just a percentage.
async function getComplianceDetail(employeeEmail: string | null | undefined, monthLabel: string): Promise<ComplianceDetail> {
  const empty: ComplianceDetail = { rate: null, coachTotal: 0, coachAcked: 0, annTotal: 0, annAcked: 0, taskTotal: 0, taskDone: 0, totalRequired: 0, totalAcked: 0, missingCoaching: [], missingAnnouncements: [], missingTasks: [] }
  if (!employeeEmail) return empty
  const mIdx = monthIndex(monthLabel), yr = yearOf(monthLabel)
  if (mIdx < 0 || !yr) return empty
  const start = new Date(yr, mIdx, 1).toISOString().slice(0, 10)
  const end = new Date(yr, mIdx + 1, 1).toISOString().slice(0, 10)

  const { data: coaching } = await supabase.from('coaching_logs')
    .select('agent_acknowledged, date, type')
    .eq('employee_email', employeeEmail)
    .eq('requires_acknowledgment', true)
    .eq('status', 'Final')
    .gte('date', start).lt('date', end)

  const { data: anns } = await supabase.from('announcements')
    .select('id, title')
    .gte('created_at', start).lt('created_at', end)

  const annIds = (anns || []).map((a:any) => a.id)
  let ackedIds: string[] = []
  if (annIds.length) {
    const { data: acks } = await supabase.from('announcement_acknowledgements')
      .select('announcement_id').eq('user_email', employeeEmail).in('announcement_id', annIds)
    ackedIds = (acks || []).map((a:any) => a.announcement_id)
  }

  const { data: taskData } = await supabase.from('tasks')
    .select('title, is_done')
    .eq('assigned_to', employeeEmail.toLowerCase())
    .gte('created_at', start).lt('created_at', end)

  const coachTotal = (coaching || []).length
  const coachAcked = (coaching || []).filter((c:any) => c.agent_acknowledged).length
  const taskTotal = (taskData || []).length
  const taskDone = (taskData || []).filter((t:any) => t.is_done).length
  const totalRequired = coachTotal + annIds.length + taskTotal
  const totalAcked = coachAcked + (annIds.length - (annIds.length - ackedIds.length)) + taskDone

  return {
    rate: totalRequired > 0 ? totalAcked / totalRequired : null,
    coachTotal, coachAcked, annTotal: annIds.length, annAcked: ackedIds.length, taskTotal, taskDone, totalRequired, totalAcked,
    missingCoaching: (coaching || []).filter((c:any) => !c.agent_acknowledged).map((c:any) => ({ title: c.type || 'Coaching session', date: c.date })),
    missingAnnouncements: (anns || []).filter((a:any) => !ackedIds.includes(a.id)).map((a:any) => ({ title: a.title })),
    missingTasks: (taskData || []).filter((t:any) => !t.is_done).map((t:any) => ({ title: t.title })),
  }
}

function TeamCompliancePanel({ employees, userRole, currentUser }: { employees: Employee[], userRole: string, currentUser: string | null }) {
  const [selMonth, setSelMonth] = useState(MONTHS[new Date().getMonth()])
  const [selYear, setSelYear] = useState(String(new Date().getFullYear()))
  const [selClient, setSelClient] = useState('All')
  const [selTeam, setSelTeam] = useState('all')
  const [teams, setTeams] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<{team_id:string, employee_id:string}[]>([])
  const [details, setDetails] = useState<Record<string, ComplianceDetail>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [teamMemberIds, setTeamMemberIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    supabase.from('teams').select('id, name, team_lead:employees(client)').order('name').then(({data}) => setTeams(data||[]))
    supabase.from('team_members').select('team_id, employee_id').then(({data}) => setTeamMembers(data||[]))
  }, [])

  // Team Leads only see their own team's members; Admin/Super Admin see everyone.
  useEffect(() => {
    if (userRole !== 'Team Lead') { setTeamMemberIds(null); return }
    (async () => {
      const { data: teams } = await supabase.from('teams').select('id, team_lead_id')
      const myTeamIds = (teams || []).filter((t:any) => employees.find(e => e.id === t.team_lead_id)?.email === currentUser).map((t:any) => t.id)
      if (myTeamIds.length === 0) { setTeamMemberIds(new Set()); return }
      const { data: members } = await supabase.from('team_members').select('employee_id').in('team_id', myTeamIds)
      setTeamMemberIds(new Set((members || []).map((m:any) => m.employee_id)))
    })()
  }, [userRole, currentUser, employees])

  const monthLabel = `${selMonth} ${selYear}`
  const teamFilterIds = selTeam !== 'all' ? new Set(teamMembers.filter(m => m.team_id === selTeam).map(m => m.employee_id)) : null
  const scopedEmployees = employees.filter(e => e.active && e.email
    && (selClient === 'All' || e.client === selClient)
    && (teamMemberIds === null || teamMemberIds.has(e.id))
    && (teamFilterIds === null || teamFilterIds.has(e.id)))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(scopedEmployees.map(async e => [e.id, await getComplianceDetail(e.email, monthLabel)] as const))
      .then(results => {
        if (cancelled) return
        const map: Record<string, ComplianceDetail> = {}
        results.forEach(([id, detail]) => { map[id] = detail })
        setDetails(map)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [monthLabel, scopedEmployees.map(e=>e.id).join(','), teamMemberIds])

  function toggleExpand(id: string) {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const allMonths = ['2024','2025','2026','2027','2028','2029','2030'].flatMap(y => MONTHS.map(m => `${m} ${y}`))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500"/>Team Acknowledgment Compliance</h3>
          <p className="text-xs text-gray-400 mt-0.5">Coaching sessions, announcements, and tasks -- who has and hasn't acknowledged/completed what.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={`${selMonth} ${selYear}`} onChange={e => { const [m,y] = e.target.value.split(' '); setSelMonth(m); setSelYear(y) }} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900">
            {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {userRole !== 'Team Lead' && (
            <>
              <select value={selClient} onChange={e => { setSelClient(e.target.value); setSelTeam('all') }} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900">
                <option value="All">All Clients</option>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {(() => {
                const clientTeams = teams.filter((t:any) => selClient === 'All' || t.team_lead?.client === selClient)
                return (
                  <select value={selTeam} onChange={e => setSelTeam(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900">
                    <option value="all">All Teams{selClient !== 'All' ? ` (${selClient})` : ''}</option>
                    {clientTeams.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading compliance data...</div>
      ) : scopedEmployees.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">{userRole === 'Team Lead' ? 'No team members found under you.' : 'No employees match this filter.'}</div>
      ) : (
        <div className="space-y-2">
          {scopedEmployees.map(e => {
            const d = details[e.id]
            const isExpanded = expanded.has(e.id)
            const pct = d?.rate !== null && d?.rate !== undefined ? Math.round(d.rate * 100) : null
            const missingCount = d ? d.missingCoaching.length + d.missingAnnouncements.length + d.missingTasks.length : 0
            return (
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => toggleExpand(e.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition text-left">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                    <span className="font-medium text-sm text-gray-900">{e.name}</span>
                    <span className="text-xs text-gray-400">{e.designation}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {missingCount > 0 && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{missingCount} pending</span>}
                    <span className={`text-sm font-bold px-2 py-1 rounded-lg ${pct === null ? 'bg-gray-50 text-gray-400' : pct >= 97 ? 'bg-emerald-50 text-emerald-700' : pct >= 80 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                      {pct === null ? 'No data' : `${pct}%`}
                    </span>
                  </div>
                </button>
                {isExpanded && d && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-xs text-gray-400">Coaching</p><p className="text-sm font-semibold text-gray-800">{d.coachAcked}/{d.coachTotal}</p></div>
                      <div><p className="text-xs text-gray-400">Announcements</p><p className="text-sm font-semibold text-gray-800">{d.annAcked}/{d.annTotal}</p></div>
                      <div><p className="text-xs text-gray-400">Tasks</p><p className="text-sm font-semibold text-gray-800">{d.taskDone}/{d.taskTotal}</p></div>
                    </div>
                    {missingCount === 0 ? (
                      <p className="text-xs text-emerald-600 font-medium">✓ Fully acknowledged/completed this month.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {d.missingCoaching.map((c,i) => <p key={`c${i}`} className="text-xs text-gray-600">📋 Not acknowledged: <span className="font-medium">{c.title}</span> ({new Date(c.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})})</p>)}
                        {d.missingAnnouncements.map((a,i) => <p key={`a${i}`} className="text-xs text-gray-600">📢 Not acknowledged: <span className="font-medium">{a.title}</span></p>)}
                        {d.missingTasks.map((t,i) => <p key={`t${i}`} className="text-xs text-gray-600">✅ Not completed: <span className="font-medium">{t.title}</span></p>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function TLToolsPanel({ employees, currentUser, userRole, showToast, onAckChange }:
  { employees: Employee[], currentUser: string | null, userRole: string, showToast: (m: string, t?: 'success'|'error') => void, onAckChange?: () => void }) {

  const [activeTab, setActiveTab] = useState<'coaching'|'compliance'|'ackCompliance'>('coaching')
  const canManage = userRole === 'super_admin' || userRole === 'admin' || userRole === 'Team Lead'
  const isViewer = userRole === 'agent'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-6 h-6 text-blue-800" />
        <h2 className="text-xl font-bold text-blue-900">Team Lead Tools</h2>
      </div>

      {isViewer && (
        <ViewerCoachingBanner currentUser={currentUser} />
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200">
        {([['coaching','📋 Coaching Log'],['compliance','📊 TL Compliance'],['ackCompliance','✅ Team Compliance']] as [string,string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'coaching' && (
        <CoachingLog employees={employees} currentUser={currentUser} userRole={userRole} canManage={canManage} showToast={showToast} onAckChange={onAckChange} />
      )}
      {activeTab === 'compliance' && canManage && (
        <TLComplianceReport employees={employees} currentUser={currentUser} userRole={userRole} />
      )}
      {activeTab === 'ackCompliance' && canManage && (
        <TeamCompliancePanel employees={employees} userRole={userRole} currentUser={currentUser} />
      )}
      {activeTab === 'compliance' && !canManage && (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/>
          <p className="font-medium">Access Restricted</p>
          <p className="text-sm mt-1">Compliance reports require Team Lead access or higher</p>
        </div>
      )}
    </div>
  )
}

// -- Coaching Log ------------------------------------------------------------
function CoachingLog({ employees, currentUser, userRole, canManage, showToast, onAckChange }:
  { employees: Employee[], currentUser: string | null, userRole: string, canManage: boolean, showToast: (m: string, t?: 'success'|'error') => void, onAckChange?: () => void }) {

  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterEmp, setFilterEmp] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [deleting, setDeleting] = useState<string|null>(null)

  const emptyForm = { employee_id: '', date: new Date().toISOString().split('T')[0], type: 'Performance', initiated_by: 'Team Lead', discussion: '', action_items: '', next_session_date: '', send_for_ack: false }
  const [form, setForm] = useState<any>({ ...emptyForm })
  const [ackLoading, setAckLoading] = useState<string|null>(null)
  const [editingDraftId, setEditingDraftId] = useState<string|null>(null)

  async function loadLogs() {
    setLoading(true)
    let query = supabase.from('coaching_logs').select('*').order('date', { ascending: false })
    if (userRole === 'agent' && currentUser) {
      query = query.eq('employee_email', currentUser.toLowerCase())
    }
    const { data } = await query
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { loadLogs() }, [])

  async function acknowledgeCoaching(logId: string) {
    setAckLoading(logId)
    const { error } = await supabase.from('coaching_logs').update({
      agent_acknowledged: true,
      agent_acknowledged_at: new Date().toISOString(),
      agent_acknowledged_by: currentUser,
    }).eq('id', logId)
    if (error) showToast('Failed to acknowledge: ' + error.message, 'error')
    else { showToast('Coaching session acknowledged! ✓'); onAckChange?.() }
    setAckLoading(null)
    loadLogs()
  }

  async function handleSave(asDraft: boolean = false) {
    if (!asDraft && (!form.employee_id || !form.date || !form.discussion.trim())) {
      showToast('Please fill in employee, date, and discussion points.', 'error'); return
    }
    if (asDraft && !form.employee_id) {
      showToast('Please at least select an employee before saving as draft.', 'error'); return
    }
    setSaving(true)
    const emp = employees.find(e => e.id === form.employee_id)
    const payload = {
      employee_id: form.employee_id,
      employee_name: emp?.name || '',
      employee_email: emp?.email || '',
      coached_by: currentUser,
      initiated_by: form.initiated_by,
      date: form.date,
      type: form.type,
      discussion: form.discussion.trim(),
      action_items: form.action_items.trim(),
      next_session_date: form.next_session_date || null,
      requires_acknowledgment: asDraft ? false : form.send_for_ack,
      agent_acknowledged: false,
      status: asDraft ? 'Draft' : 'Final',
    }
    const { error } = editingDraftId
      ? await supabase.from('coaching_logs').update(payload).eq('id', editingDraftId)
      : await supabase.from('coaching_logs').insert(payload)
    setSaving(false)
    if (error) { showToast('Failed to save: ' + error.message, 'error'); return }
    showToast(asDraft ? 'Saved as draft — come back anytime to finish it.' : (form.send_for_ack ? 'Coaching log saved! Agent will see it for acknowledgment.' : 'Coaching log saved!'))
    setForm({ ...emptyForm })
    setEditingDraftId(null)
    setShowForm(false)
    loadLogs()
  }

  function resumeDraft(draft: any) {
    setForm({
      employee_id: draft.employee_id,
      date: draft.date,
      type: draft.type,
      initiated_by: draft.initiated_by,
      discussion: draft.discussion || '',
      action_items: draft.action_items || '',
      next_session_date: draft.next_session_date || '',
      send_for_ack: draft.requires_acknowledgment || false,
    })
    setEditingDraftId(draft.id)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('coaching_logs').delete().eq('id', id)
    showToast('Entry deleted.')
    setDeleting(null)
    loadLogs()
  }

  const filtered = logs.filter(l => {
    if (l.status === 'Draft') return false
    if (filterEmp && l.employee_id !== filterEmp) return false
    if (filterMonth && !l.date.startsWith(filterMonth)) return false
    return true
  })

  const myDrafts = logs.filter(l => l.status === 'Draft' && l.coached_by === currentUser)

  const COACHING_TYPES = ['Performance', 'Behavior', 'Development', 'Recognition', 'Corrective Action']
  const INITIATED_BY = ['Team Lead', 'Agent', 'Manager', 'HR']

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Sessions', value: logs.length },
          { label: 'This Month', value: logs.filter(l => l.date.startsWith(new Date().toISOString().slice(0,7))).length },
          { label: 'Employees Coached', value: new Set(logs.map(l => l.employee_id)).size },
          { label: 'Pending Follow-ups', value: logs.filter(l => l.next_session_date && new Date(l.next_session_date) >= new Date()).length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending acknowledgment banner for agents */}
      {userRole === 'agent' && (() => {
        const pending = logs.filter(l => l.requires_acknowledgment && !l.agent_acknowledged)
        return pending.length > 0 ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-amber-600 text-lg">✍️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">You have {pending.length} coaching session{pending.length > 1 ? 's' : ''} pending your acknowledgment</p>
              <p className="text-xs text-amber-600 mt-0.5">Scroll down to find sessions marked "Sign & Acknowledge"</p>
            </div>
          </div>
        ) : null
      })()}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-900">
              <option value="">All Employees</option>
              {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          {(filterEmp || filterMonth) && (
            <button onClick={() => { setFilterEmp(''); setFilterMonth('') }} className="text-sm text-blue-600 hover:underline">Clear</button>
          )}
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-900 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            <PlusCircle className="w-4 h-4" /> Log Session
          </button>
        )}
      </div>

      {canManage && myDrafts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">📝 Your Drafts ({myDrafts.length}) — pick up where you left off</p>
          {myDrafts.map(d => (
            <div key={d.id} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium text-gray-800">{d.employee_name || 'No employee yet'}</span>
                <span className="text-xs text-gray-400 ml-2">{d.type} · {d.date ? new Date(d.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => resumeDraft(d)} className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg font-medium transition">Resume</button>
                <button onClick={() => handleDelete(d.id)} className="text-gray-400 hover:text-red-500 p-1 transition"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && canManage && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm">
          <h3 className="font-semibold text-blue-900 text-sm">New Coaching Session</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
              <select value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                <option value="">Select employee…</option>
                {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                {COACHING_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Initiated By</label>
              <select value={form.initiated_by} onChange={e => setForm({...form, initiated_by: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                {INITIATED_BY.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Key Discussion Points *</label>
            <textarea value={form.discussion} onChange={e => setForm({...form, discussion: e.target.value})} rows={3}
              placeholder="What was discussed during the session…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action Items</label>
            <textarea value={form.action_items} onChange={e => setForm({...form, action_items: e.target.value})} rows={2}
              placeholder="Commitments and next steps…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          </div>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-600 mb-1">Next Session Date</label>
            <input type="date" value={form.next_session_date} onChange={e => setForm({...form, next_session_date: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          </div>
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.send_for_ack} onChange={e => setForm({...form, send_for_ack: e.target.checked})}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700 font-medium">📧 Send to agent for e-signature acknowledgment</span>
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleSave(false)} disabled={saving}
              className="flex items-center gap-2 bg-blue-900 hover:bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              <Save className="w-4 h-4" />{saving ? 'Saving…' : (editingDraftId ? 'Finalize Session' : 'Save Session')}
            </button>
            <button onClick={() => handleSave(true)} disabled={saving || !form.employee_id}
              className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              <Save className="w-4 h-4" />Save as Draft
            </button>
            <button onClick={() => { setShowForm(false); setForm({...emptyForm}); setEditingDraftId(null) }}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Log table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium">No coaching sessions found</p>
          <p className="text-sm mt-1">{canManage ? 'Log your first session above.' : 'No sessions have been recorded for you yet.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {canManage && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Initiated By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discussion</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action Items</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Next Session</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent Sign-off</th>
                  {canManage && <th className="px-4 py-3 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(log => {
                  const nextDue = log.next_session_date ? new Date(log.next_session_date) : null
                  const isOverdue = nextDue && nextDue < new Date()
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      {canManage && <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{log.employee_name}</td>}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(log.date).toLocaleDateString('en-PH', {year:'numeric',month:'short',day:'numeric'})}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.type === 'Performance' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'Behavior' ? 'bg-yellow-100 text-yellow-700' :
                          log.type === 'Development' ? 'bg-emerald-100 text-emerald-700' :
                          log.type === 'Recognition' ? 'bg-purple-100 text-purple-700' :
                          'bg-red-100 text-red-700'}`}>{log.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.initiated_by === 'Agent' ? 'bg-orange-100 text-orange-700' :
                          log.initiated_by === 'Manager' ? 'bg-indigo-100 text-indigo-700' :
                          log.initiated_by === 'HR' ? 'bg-pink-100 text-pink-700' :
                          'bg-gray-100 text-gray-700'}`}>{log.initiated_by || 'Team Lead'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs"><div className="line-clamp-2">{log.discussion}</div></td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs"><div className="line-clamp-2">{log.action_items || '—'}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {nextDue ? (
                          <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                            {isOverdue ? '⚠️ ' : ''}{nextDue.toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric'})}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {!log.requires_acknowledgment ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : log.agent_acknowledged ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">✓ Acknowledged</span>
                            {log.agent_acknowledged_at && <p className="text-xs text-gray-400 mt-0.5">{new Date(log.agent_acknowledged_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</p>}
                          </div>
                        ) : userRole === 'agent' ? (
                          <button onClick={() => acknowledgeCoaching(log.id)} disabled={ackLoading === log.id}
                            className="flex items-center gap-1 bg-blue-700 hover:bg-blue-900 text-white px-3 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50">
                            {ackLoading === log.id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"/> : '✍️'} Sign & Acknowledge
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">⏳ Pending</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <button onClick={() => handleDelete(log.id)} disabled={deleting === log.id}
                            className="text-gray-400 hover:text-red-500 transition p-1 rounded">
                            {deleting === log.id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400"/> : <Trash2 className="w-3.5 h-3.5"/>}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// -- TL Compliance Report ----------------------------------------------------
function TLComplianceReport({ employees, currentUser, userRole }:
  { employees: Employee[], currentUser: string | null, userRole: string }) {

  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'monthly'|'weekly'>('monthly')
  const [selMonth, setSelMonth] = useState(new Date().toISOString().slice(0,7))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('coaching_logs').select('*').order('date', { ascending: false })
      setLogs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Group by coached_by for selected month. Team Leads only see their own
  // compliance data here; Admin/Super Admin see everyone (cross-team view).
  const isTL = userRole === 'Team Lead'
  const monthLogs = logs.filter(l => l.date.startsWith(selMonth) && (!isTL || l.coached_by === currentUser))

  // Get unique TLs (coached_by values)
  const tlMap: Record<string, { name: string, sessions: any[] }> = {}
  monthLogs.forEach(l => {
    const tl = l.coached_by || 'Unknown'
    if (!tlMap[tl]) tlMap[tl] = { name: tl, sessions: [] }
    tlMap[tl].sessions.push(l)
  })

  // Weekly breakdown for selected month
  const getWeek = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getDate()
    if (day <= 7) return 'Week 1'
    if (day <= 14) return 'Week 2'
    if (day <= 21) return 'Week 3'
    return 'Week 4'
  }

  const weeklyByTL: Record<string, Record<string, number>> = {}
  monthLogs.forEach(l => {
    const tl = l.coached_by || 'Unknown'
    const week = getWeek(l.date)
    if (!weeklyByTL[tl]) weeklyByTL[tl] = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0 }
    weeklyByTL[tl][week]++
  })

  const tlList = Object.entries(tlMap).sort((a,b) => b[1].sessions.length - a[1].sessions.length)
  const WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
  // Target: min 2 sessions per employee per month
  const activeCount = employees.filter(e => e.active).length
  const TARGET_MONTHLY = activeCount * 2

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-900" />
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['monthly','weekly'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-4 py-2 font-medium transition ${viewMode === m ? 'bg-blue-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Target: <span className="font-semibold text-blue-900">2 sessions/employee/month</span>
          {activeCount > 0 && <span className="ml-2 text-gray-400">({TARGET_MONTHLY} total for {activeCount} active employees)</span>}
          {isTL && <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">Showing your data only</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" /></div>
      ) : tlList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-medium">No coaching sessions logged for {selMonth}</p>
        </div>
      ) : viewMode === 'monthly' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Monthly Summary — {new Date(selMonth+'-01').toLocaleDateString('en-PH',{month:'long',year:'numeric'})}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Team Lead</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unique Employees Coached</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tlList.map(([tl, data]) => {
                const uniqueEmps = new Set(data.sessions.map(s => s.employee_id)).size
                const onTrack = data.sessions.length >= 2
                return (
                  <tr key={tl} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{tl.split('@')[0]}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-lg font-bold text-blue-900">{data.sessions.length}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{uniqueEmps} employee{uniqueEmps !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${onTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {onTrack ? '✓ Compliant' : '⚠ Below Target'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Weekly Breakdown — {new Date(selMonth+'-01').toLocaleDateString('en-PH',{month:'long',year:'numeric'})}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Team Lead</th>
                  {WEEKS.map(w => <th key={w} className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{w}</th>)}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(weeklyByTL).sort((a,b) => {
                  const aTotal = Object.values(a[1]).reduce((s,v) => s+v, 0)
                  const bTotal = Object.values(b[1]).reduce((s,v) => s+v, 0)
                  return bTotal - aTotal
                }).map(([tl, weeks]) => {
                  const total = Object.values(weeks).reduce((s,v) => s+v, 0)
                  return (
                    <tr key={tl} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900">{tl.split('@')[0]}</td>
                      {WEEKS.map(w => (
                        <td key={w} className="px-4 py-3 text-center">
                          {weeks[w] > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">{weeks[w]}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold text-blue-900">{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// -- HRIS: Employee Referral -------------------------------------------------
// -- Time Tracker (v2 -- paste-based, matched by Employee ID) ---------------

// Derives "June 2026" from a period label like "June 16-30, 2026"
function periodToMonthLabel(periodLabel: string): string {
  const yearMatch = periodLabel.match(/(20\d{2})/)
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear())
  const monthMatch = MONTHS.find(m => periodLabel.toLowerCase().includes(m.toLowerCase()) || periodLabel.toLowerCase().includes(m.slice(0,3).toLowerCase()))
  return monthMatch ? `${monthMatch} ${year}` : periodLabel
}

type TTPeriodRow = {
  employee_id_code: string
  employee_name: string
  employee_id: string | null // resolved uuid
  basic_hours_worked: number
  days_worked: number
  absent_days: number
  late_hours: number
  late_mins: number
  undertime_hours: number
  undertime_mins: number
  total_sd_hours: number
  holiday_days: number
  restday_days: number
  overtime_hours: number
  night_diff_days: number
  night_diff_ot_hours: number
  billable_hours: number
  non_billable_hours: number
  computed_attendance_pct: number | null // null = no data this period, excluded
}

function computePeriodAttendance(r: Omit<TTPeriodRow,'employee_id'|'employee_id_code'|'employee_name'|'billable_hours'|'non_billable_hours'|'computed_attendance_pct'>): number | null {
  // "No data yet" rows -- everything's zero, nothing to compute from.
  if (r.days_worked === 0 && r.basic_hours_worked === 0 && r.absent_days === 0) return null
  const scheduledDays = r.days_worked
  if (scheduledDays <= 0) return null
  const actualDays = Math.max(0, scheduledDays - r.absent_days)
  const basePct = (actualDays / scheduledDays) * 100
  const lateUndertimeHours = r.late_hours + r.late_mins/60 + r.undertime_hours + r.undertime_mins/60
  const deduction = (lateUndertimeHours / 8) * 100 * 0.05
  return Math.max(0, Math.min(100, basePct - deduction))
}

// Parses a pasted tab-separated block (header row + data rows) in the exact
// column order from the time tracking system's export.
function parsePastedTimeTracker(text: string, employees: Employee[]): TTPeriodRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const rows: TTPeriodRow[] = []
  // Skip the header line (line 0) -- assume fixed column order matching the
  // known export format rather than fuzzy-matching header text, since it's
  // pasted directly from the same system every time.
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim())
    if (cols.length < 16) continue
    const [, name, empIdCode, basicHours, daysWorked, absent, lateHrs, lateMins, undertimeHrs, undertimeMins, totalSd, holiday, restday, overtime, nightDiff, nightDiffOt] = cols
    const num = (v: string) => parseFloat(v) || 0
    const cleanName = name.trim()
    const match = employees.find(e => e.employee_id && e.employee_id.trim().toLowerCase() === empIdCode.trim().toLowerCase())
    const base = {
      basic_hours_worked: num(basicHours), days_worked: num(daysWorked), absent_days: num(absent),
      late_hours: num(lateHrs), late_mins: num(lateMins), undertime_hours: num(undertimeHrs), undertime_mins: num(undertimeMins),
      total_sd_hours: num(totalSd), holiday_days: num(holiday), restday_days: num(restday), overtime_hours: num(overtime),
      night_diff_days: num(nightDiff), night_diff_ot_hours: num(nightDiffOt),
    }
    const attendancePct = computePeriodAttendance(base)
    rows.push({
      employee_id_code: empIdCode.trim(), employee_name: cleanName, employee_id: match?.id || null,
      ...base,
      billable_hours: base.basic_hours_worked, non_billable_hours: 0,
      computed_attendance_pct: attendancePct,
    })
  }
  return rows
}

function TimeTrackerPanel({ employees, records, currentUser, showToast, onApplied }:
  { employees: Employee[], records: KpiRecord[], currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void, onApplied: () => void }) {
  const [pasteText, setPasteText] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [rows, setRows] = useState<TTPeriodRow[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [pastPeriods, setPastPeriods] = useState<any[]>([])
  const [loadingPast, setLoadingPast] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [clientFilter, setClientFilter] = useState('All')

  useEffect(() => { loadPastPeriods() }, [])

  async function loadPastPeriods() {
    setLoadingPast(true)
    const { data } = await supabase.from('time_tracker_periods').select('*').order('uploaded_at', { ascending: false })
    setPastPeriods(data || [])
    setLoadingPast(false)
  }

  function handleParse() {
    if (!pasteText.trim()) { showToast('Paste the time tracker table first.', 'error'); return }
    if (!periodLabel.trim()) { showToast('Give this period a label, e.g. "June 16-30, 2026".', 'error'); return }
    const parsed = parsePastedTimeTracker(pasteText, employees)
    if (parsed.length === 0) { showToast('Could not parse any rows -- check the pasted format.', 'error'); return }
    setRows(parsed)
  }

  function updateRow(empCode: string, patch: Partial<TTPeriodRow>) {
    setRows(prev => prev.map(r => r.employee_id_code === empCode ? { ...r, ...patch } : r))
  }

  const monthLabel = periodToMonthLabel(periodLabel)
  const clientOf = (r: TTPeriodRow) => employees.find(e => e.id === r.employee_id)?.client || null
  const filteredRows = rows.filter(r => {
    const q = searchQ.trim().toLowerCase()
    const matchesSearch = !q || r.employee_name.toLowerCase().includes(q) || r.employee_id_code.toLowerCase().includes(q)
    const matchesClient = clientFilter === 'All' || clientOf(r) === clientFilter
    return matchesSearch && matchesClient
  })
  const withData = filteredRows.filter(r => r.computed_attendance_pct !== null)
  const noData = filteredRows.filter(r => r.computed_attendance_pct === null)

  async function applyOne(row: TTPeriodRow) {
    if (!row.employee_id) { showToast(`No employee found with ID ${row.employee_id_code} -- check Employees records.`, 'error'); return }
    if (row.computed_attendance_pct === null) return
    setSaving(row.employee_id_code)
    try {
      await persistRow(row)
      showToast(`${row.employee_name}: attendance set to ${row.computed_attendance_pct!.toFixed(2)}% for ${monthLabel}`)
      onApplied()
      loadPastPeriods()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to apply', 'error')
    }
    setSaving(null)
  }

  async function applyAll() {
    const applicable = withData.filter(r => r.employee_id)
    if (applicable.length === 0) { showToast('Nothing to apply -- no matched employees with data.', 'error'); return }
    setBulkSaving(true)
    let ok = 0
    for (const row of applicable) {
      try { await persistRow(row); ok++ } catch { /* continue with the rest */ }
    }
    setBulkSaving(false)
    showToast(`Applied attendance for ${ok}/${applicable.length} employees for ${monthLabel}`)
    onApplied()
    loadPastPeriods()
  }

  async function persistRow(row: TTPeriodRow) {
    const attendancePct = row.computed_attendance_pct! / 100
    // 1. Persist the period summary row (upsert on employee_id_code + period_label)
    const { error: upsertErr } = await supabase.from('time_tracker_periods').upsert({
      employee_id: row.employee_id, employee_id_code: row.employee_id_code, employee_name: row.employee_name,
      period_label: periodLabel, month_label: monthLabel,
      basic_hours_worked: row.basic_hours_worked, days_worked: row.days_worked, absent_days: row.absent_days,
      late_hours: row.late_hours, late_mins: row.late_mins, undertime_hours: row.undertime_hours, undertime_mins: row.undertime_mins,
      total_sd_hours: row.total_sd_hours, holiday_days: row.holiday_days, restday_days: row.restday_days,
      overtime_hours: row.overtime_hours, night_diff_days: row.night_diff_days, night_diff_ot_hours: row.night_diff_ot_hours,
      billable_hours: row.billable_hours, non_billable_hours: row.non_billable_hours,
      computed_attendance_pct: row.computed_attendance_pct,
      uploaded_by: currentUser, applied_to_attendance: true, applied_at: new Date().toISOString(),
    }, { onConflict: 'employee_id_code,period_label' })
    if (upsertErr) throw upsertErr

    // 2. Apply to the matching KPI record for that month
    const existing = records.find(r => r.employee_id === row.employee_id && r.month_label === monthLabel)
    if (existing) {
      const overall = attendancePct*0.2 + (existing.accuracy||0)*0.3 + (existing.efficiency||0)*0.3 + (existing.feedback||0)*0.15 + (existing.compliance_score||0)*0.05
      const { error } = await supabase.from('kpi_records').update({ attendance: attendancePct, overall_score: overall, updated_at: new Date().toISOString() }).eq('id', existing.id)
      if (error) throw error
      await writeAuditLog('APPLY_TIME_TRACKER', currentUser || '', row.employee_name, monthLabel, 'Attendance', pct(existing.attendance), pct(attendancePct))
    } else {
      const emp = employees.find(e => e.id === row.employee_id)
      const { error } = await supabase.from('kpi_records').insert({
        employee_id: row.employee_id, employee_name: row.employee_name, designation: emp?.designation || '',
        month_label: monthLabel, attendance: attendancePct, overall_score: null, updated_at: new Date().toISOString(),
      })
      if (error) throw error
      await writeAuditLog('APPLY_TIME_TRACKER', currentUser || '', row.employee_name, monthLabel, 'Attendance', 'N/A', pct(attendancePct))
    }
  }

  async function generateTimeReport() {
    if (rows.length === 0) { showToast('Parse a period first.', 'error'); return }
    const XLSX = await import('xlsx')
    const reportRows = rows.map(r => ({
      'Employee ID': r.employee_id_code, 'Name': r.employee_name,
      'Billable Hours': r.billable_hours, 'Non-Billable Hours': r.non_billable_hours,
      'Total Hours': r.billable_hours + r.non_billable_hours,
      'Absent Days': r.absent_days, 'Attendance %': r.computed_attendance_pct !== null ? r.computed_attendance_pct.toFixed(2) : 'No data',
      'Period': periodLabel,
    }))
    const ws = XLSX.utils.json_to_sheet(reportRows)
    ws['!cols'] = [{wch:14},{wch:28},{wch:14},{wch:16},{wch:12},{wch:12},{wch:12},{wch:20}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Time Report')
    XLSX.writeFile(wb, `Time_Report_${periodLabel.replace(/[^a-z0-9]/gi,'_')}.xlsx`)
    showToast('Time report downloaded!')
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2"><Clock className="w-5 h-5"/>Time Tracker</h2>
        <p className="text-sm text-gray-500">Paste a period summary from the time tracking system, matched by Employee ID</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-gray-700">Period label:</label>
          <input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="e.g. June 16-30, 2026" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 flex-1 min-w-64 focus:outline-none focus:ring-2 focus:ring-blue-900" />
        </div>
        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6} placeholder="Paste the full table here, including the header row (BRANCH, NAME, EMPLOYEE ID, BASIC HOURS WORKED, ...)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-900" />
        <div className="flex gap-2">
          <button onClick={handleParse} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition">Parse</button>
          {rows.length > 0 && <button onClick={generateTimeReport} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Download Time Report (.xlsx)</button>}
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search name or ID..." className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 w-56 focus:outline-none focus:ring-2 focus:ring-blue-900" />
              </div>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900">
                <option value="All">All Clients</option>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{withData.length}</span> with data ready to apply to <span className="font-semibold text-blue-700">{monthLabel}</span>
              {noData.length > 0 && <span className="text-gray-400"> · {noData.length} with no data yet (excluded)</span>}
            </p>
            <button onClick={applyAll} disabled={bulkSaving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
              {bulkSaving ? 'Applying all...' : `Apply All to Attendance (${withData.filter(r=>r.employee_id).length})`}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  {['Employee','ID','Absent','Late/Undertime','OT','Attendance %','Billable Hrs','Non-Billable Hrs',''].map(h => (
                    <th key={h} className="px-3 py-2.5 font-medium text-gray-600 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">No rows match this filter.</td></tr>
                  )}
                  {filteredRows.map(r => (
                    <tr key={r.employee_id_code} className={`border-b border-gray-100 hover:bg-gray-50 ${r.computed_attendance_pct === null ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        {r.employee_name}
                        {clientOf(r) && <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${CLIENT_COLORS[clientOf(r)!] || 'bg-gray-100 text-gray-600'}`}>{clientOf(r)}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {r.employee_id_code}
                        {!r.employee_id && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">no match</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.absent_days > 0 ? `${r.absent_days}d` : '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{(r.late_hours||r.late_mins||r.undertime_hours||r.undertime_mins) ? `${r.late_hours}h${r.late_mins}m / ${r.undertime_hours}h${r.undertime_mins}m` : '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.overtime_hours > 0 ? `${r.overtime_hours}h` : '-'}</td>
                      <td className="px-3 py-2">
                        {r.computed_attendance_pct === null ? <span className="text-gray-400 text-xs">No data</span> : (
                          <input type="number" min="0" max="100" step="0.01" value={r.computed_attendance_pct.toFixed(2)}
                            onChange={e => updateRow(r.employee_id_code, { computed_attendance_pct: parseFloat(e.target.value) || 0 })}
                            className="w-20 border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-800" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.5" value={r.billable_hours} onChange={e => updateRow(r.employee_id_code, { billable_hours: parseFloat(e.target.value)||0 })} className="w-20 border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-800" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.5" value={r.non_billable_hours} onChange={e => updateRow(r.employee_id_code, { non_billable_hours: parseFloat(e.target.value)||0 })} className="w-20 border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-800" />
                      </td>
                      <td className="px-3 py-2">
                        {r.computed_attendance_pct !== null && (
                          <button onClick={() => applyOne(r)} disabled={!r.employee_id || saving === r.employee_id_code} className="text-blue-700 hover:underline text-xs font-medium disabled:opacity-40 disabled:no-underline">
                            {saving === r.employee_id_code ? 'Applying...' : 'Apply'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-700 text-sm">Past Periods Applied</h3></div>
        {loadingPast ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
        ) : pastPeriods.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No periods applied yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                {['Employee','ID','Period','Attendance %','Billable Hrs','Non-Billable Hrs','Applied'].map(h => <th key={h} className="px-3 py-2 font-medium text-gray-500 text-left">{h}</th>)}
              </tr></thead>
              <tbody>
                {pastPeriods.slice(0, 100).map((p:any) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-3 py-1.5 text-gray-800">{p.employee_name}</td>
                    <td className="px-3 py-1.5 text-gray-500">{p.employee_id_code}</td>
                    <td className="px-3 py-1.5 text-gray-500">{p.period_label}</td>
                    <td className="px-3 py-1.5 text-gray-600">{p.computed_attendance_pct != null ? Number(p.computed_attendance_pct).toFixed(2)+'%' : '-'}</td>
                    <td className="px-3 py-1.5 text-gray-600">{p.billable_hours}</td>
                    <td className="px-3 py-1.5 text-gray-600">{p.non_billable_hours}</td>
                    <td className="px-3 py-1.5">{p.applied_to_attendance ? <span className="text-emerald-600">✓</span> : <span className="text-gray-300">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


function HRISReferral({ userRole, currentUser, showToast }: { userRole: string, currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const canManage = userRole === 'super_admin' || userRole === 'admin'
  const canRefer = true // everyone can submit a referral
  // Agent/Team Lead see only their own submitted referrals (status visible,
  // but not other people's candidate details). Manager+ see everyone and
  // can export.
  const canSeeAll = canManage
  const [referrals, setReferrals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const emptyForm = { candidate_name: '', position_applied: '', referred_by: currentUser?.split('@')[0] || '', relationship: '', notes: '', resume_url: '', resume_name: '' }
  const [form, setForm] = useState({ ...emptyForm })

  useEffect(() => { loadReferrals() }, [])

  async function loadReferrals() {
    setLoading(true)
    let q = supabase.from('hris_referrals').select('*').order('created_at', { ascending: false })
    if (!canSeeAll && currentUser) q = q.eq('submitted_by', currentUser)
    const { data } = await q
    setReferrals(data || [])
    setLoading(false)
  }

  async function uploadResume(file: File) {
    setUploading(true)
    const path = `referrals/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploading(false); return }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path)
    setForm(f => ({ ...f, resume_url: data.publicUrl, resume_name: file.name }))
    setUploading(false)
    showToast('Resume uploaded!')
  }

  async function handleSubmit() {
    if (!form.candidate_name.trim() || !form.position_applied.trim()) {
      showToast('Please fill in candidate name and position.', 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.from('hris_referrals').insert({
      candidate_name: form.candidate_name.trim(),
      position_applied: form.position_applied.trim(),
      referred_by: form.referred_by.trim() || currentUser,
      relationship: form.relationship.trim(),
      notes: form.notes.trim(),
      resume_url: form.resume_url || null,
      resume_name: form.resume_name || null,
      status: 'Pending',
      submitted_by: currentUser,
    })
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Referral submitted!')
    setForm({ ...emptyForm })
    setShowForm(false)
    loadReferrals()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('hris_referrals').update({ status }).eq('id', id)
    showToast(`Status updated to ${status}`)
    loadReferrals()
  }

  async function deleteReferral(id: string) {
    if (!confirm('Delete this referral?')) return
    await supabase.from('hris_referrals').delete().eq('id', id)
    showToast('Deleted')
    loadReferrals()
  }

  const STATUS_COLORS: Record<string, string> = {
    'Pending': 'bg-yellow-100 text-yellow-700',
    'Under Review': 'bg-blue-100 text-blue-700',
    'Interviewed': 'bg-purple-100 text-purple-700',
    'Hired': 'bg-emerald-100 text-emerald-700',
    'Declined': 'bg-red-100 text-red-700',
  }

  async function exportReferralsToExcel() {
    const XLSX = await import('xlsx')
    const rows = referrals.map(r => ({
      'Candidate Name': r.candidate_name,
      'Position Applied': r.position_applied,
      'Referred By': r.referred_by || r.submitted_by,
      'Relationship': r.relationship || '',
      'Status': r.status,
      'Submitted': new Date(r.created_at).toLocaleDateString('en-PH'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Referrals')
    XLSX.writeFile(wb, `ABBSS_Employee_Referrals_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Export downloaded!')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Employee Referral</h2>
          <p className="text-sm text-gray-500 mt-0.5">{canSeeAll ? 'Refer a candidate for an open position at AB BSS' : 'Refer a candidate, and track the status of your own submissions'}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && <button onClick={exportReferralsToExcel} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 font-medium transition"><FileSpreadsheet className="w-3.5 h-3.5"/>Export to Excel</button>}
          {canRefer && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-900 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <PlusCircle className="w-4 h-4" /> Refer Someone
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm">
          <h3 className="font-semibold text-blue-900 text-sm">New Referral</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Candidate Full Name *</label>
              <input value={form.candidate_name} onChange={e => setForm({...form, candidate_name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Juan dela Cruz"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Position Applied For *</label>
              <input value={form.position_applied} onChange={e => setForm({...form, position_applied: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Finance Analyst"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Referred By</label>
              <input value={form.referred_by} onChange={e => setForm({...form, referred_by: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Your name"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Relationship to Candidate</label>
              <input value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Friend, Former colleague..."/></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes / Why you're referring them</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Skills, experience, why they'd be a good fit..."/></div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resume / CV</label>
            {form.resume_url ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-xs text-green-700 font-medium">✓ {form.resume_name}</span>
                <button onClick={() => setForm({...form, resume_url: '', resume_name: ''})} className="text-xs text-red-500 hover:text-red-700 ml-auto">Remove</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg py-3 text-sm text-gray-500 hover:text-blue-600 transition disabled:opacity-50">
                {uploading ? '⏳ Uploading...' : '📎 Upload Resume / CV (PDF, Word)'}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={e => e.target.files?.[0] && uploadResume(e.target.files[0])} className="hidden" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 bg-blue-900 hover:bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              <Save className="w-4 h-4" />{saving ? 'Submitting...' : 'Submit Referral'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({...emptyForm}) }} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" /></div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><div className="text-4xl mb-3">👥</div><p className="font-medium">No referrals yet</p><p className="text-sm mt-1">Be the first to refer a candidate!</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Referred By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Resume</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  {canManage && <th className="px-4 py-3 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {referrals.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.candidate_name}</p>
                      {r.relationship && <p className="text-xs text-gray-400">{r.relationship}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.position_applied}</td>
                    <td className="px-4 py-3 text-gray-600">{r.referred_by || r.submitted_by?.split('@')[0]}</td>
                    <td className="px-4 py-3">
                      {r.resume_url ? (
                        <a href={r.resume_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                          📄 {r.resume_name || 'Download'}
                        </a>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric'})}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <button onClick={() => deleteReferral(r.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// -- HRIS: Employee Records --------------------------------------------------
const REQUIRED_DOCS = ['Resume', 'NBI Clearance', 'Medical Certificate', 'Psychological Evaluation', 'SSS', 'PhilHealth', 'Pag-IBIG', 'TIN', 'Contract']
const ALL_DOC_TYPES = ['Resume', 'CV', 'NBI Clearance', 'Medical Certificate', 'Psychological Evaluation', 'SSS', 'PhilHealth', 'Pag-IBIG', 'TIN', 'Contract', 'Other']
const DOC_ICON: Record<string, string> = { 'Resume': '📄', 'CV': '📋', 'Contract': '📝', 'NBI Clearance': '🔒', 'Medical Certificate': '🏥', 'Psychological Evaluation': '🧠', 'SSS': '🏛', 'PhilHealth': '💊', 'Pag-IBIG': '🏠', 'TIN': '🪪' }

function HRISRecords({ userRole, currentUser, showToast }: { userRole: string, currentUser: string | null, showToast: (m: string, t?: 'success'|'error') => void }) {
  const canManage = userRole === 'super_admin' || userRole === 'admin'
  const isViewer = userRole === 'agent' || userRole === 'Team Lead'
  const [tab, setTab] = useState<'compliance'|'upload'|'my-docs'>('compliance')
  const [allDocs, setAllDocs] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const myFileRef = useRef<HTMLInputElement>(null)
  const [uploadForm, setUploadForm] = useState({ employee_name: '', doc_type: 'Resume', notes: '' })
  const [myUploadForm, setMyUploadForm] = useState({ doc_type: 'Resume', notes: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: docs }, { data: emps }] = await Promise.all([
      supabase.from('hris_documents').select('*').order('employee_name'),
      supabase.from('employees').select('name, employee_id').eq('active', true).order('name')
    ])
    setAllDocs(docs || [])
    setEmployees(emps || [])
    setLoading(false)
  }

  async function handleUpload(file: File, isMyDoc = false) {
    const empName = isMyDoc ? (currentUser?.split('@')[0] || '') : uploadForm.employee_name.trim()
    const docType = isMyDoc ? myUploadForm.doc_type : uploadForm.doc_type
    const notes = isMyDoc ? myUploadForm.notes : uploadForm.notes
    if (!empName) { showToast('Employee name required', 'error'); return }
    setUploading(true)
    const path = `hris/${isMyDoc ? 'private' : 'shared'}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (error) { showToast('Upload failed: ' + error.message, 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
    await supabase.from('hris_documents').insert({
      employee_name: empName,
      doc_type: docType,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      notes: notes.trim(),
      uploaded_by: currentUser,
      storage_path: path,
      is_private: isMyDoc,
      owner_email: isMyDoc ? currentUser : null,
    })
    setUploading(false)
    showToast('Document uploaded!')
    if (isMyDoc) setMyUploadForm({ doc_type: 'Resume', notes: '' })
    else setUploadForm({ employee_name: '', doc_type: 'Resume', notes: '' })
    loadData()
  }

  async function deleteDoc(id: string, path: string) {
    if (!confirm('Delete this document permanently?')) return
    await supabase.storage.from('attachments').remove([path])
    await supabase.from('hris_documents').delete().eq('id', id)
    showToast('Deleted')
    loadData()
  }

  const formatSize = (b: number) => b < 1024*1024 ? (b/1024).toFixed(0)+'KB' : (b/1024/1024).toFixed(1)+'MB'

  // Compliance: docs visible to HR (non-private only)
  const hrDocs = allDocs.filter(d => !d.is_private || canManage)
  // My docs: only mine
  const myDocs = allDocs.filter(d => d.is_private && d.owner_email === currentUser)

  // Build compliance map: employee_name → Set of doc_types
  const compMap: Record<string, Set<string>> = {}
  hrDocs.filter(d => !d.is_private).forEach(d => {
    if (!compMap[d.employee_name]) compMap[d.employee_name] = new Set()
    compMap[d.employee_name].add(d.doc_type)
  })

  // All employee names from DB employees list
  const empNames = employees.map(e => e.name)
  const filteredNames = empNames.filter(n => !searchQ || n.toLowerCase().includes(searchQ.toLowerCase()))

  // Count how many are complete
  const completeCount = empNames.filter(n => REQUIRED_DOCS.every(d => compMap[n]?.has(d))).length
  const missingCount = empNames.length - completeCount

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">Employee Records</h2>
          <p className="text-sm text-gray-500 mt-0.5">Document compliance tracker and file storage</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {([
          ['compliance', '📊 Compliance Tracker'],
          ...(canManage ? [['upload', '📁 Upload Documents']] : []),
          ['my-docs', '🔒 My Documents'],
        ] as [string,string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"/></div>
      ) : tab === 'compliance' ? (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-blue-900">{empNames.length}</div>
              <div className="text-xs text-gray-500 mt-1">Active Employees</div>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{completeCount}</div>
              <div className="text-xs text-gray-500 mt-1">Complete</div>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{missingCount}</div>
              <div className="text-xs text-gray-500 mt-1">Missing Docs</div>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search employee..." className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"/>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 min-w-40">Employee</th>
                    {REQUIRED_DOCS.map(d => (
                      <th key={d} className="text-center px-2 py-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{DOC_ICON[d] || '📄'}<br/>{d}</th>
                    ))}
                    <th className="text-center px-3 py-3 font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredNames.map(name => {
                    const has = compMap[name] || new Set()
                    const complete = REQUIRED_DOCS.every(d => has.has(d))
                    const count = REQUIRED_DOCS.filter(d => has.has(d)).length
                    return (
                      <tr key={name} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-900 sticky left-0 bg-white">{name}</td>
                        {REQUIRED_DOCS.map(d => (
                          <td key={d} className="px-2 py-2.5 text-center">
                            {has.has(d)
                              ? <span title="On file" className="text-green-500 text-base">✓</span>
                              : <span title="Missing" className="text-red-300 text-base">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${complete ? 'bg-emerald-100 text-emerald-700' : count === 0 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                            {count}/{REQUIRED_DOCS.length}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === 'upload' && canManage ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm">
            <h3 className="font-semibold text-blue-900 text-sm">Upload Employee Document</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <input list="emp-list" value={uploadForm.employee_name} onChange={e => setUploadForm({...uploadForm, employee_name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="Start typing name..."/>
                <datalist id="emp-list">{employees.map(e => <option key={e.name} value={e.name}/>)}</datalist>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Document Type</label>
                <select value={uploadForm.doc_type} onChange={e => setUploadForm({...uploadForm, doc_type: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900">
                  {ALL_DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input value={uploadForm.notes} onChange={e => setUploadForm({...uploadForm, notes: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="e.g. Valid until Dec 2026"/></div>
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading || !uploadForm.employee_name.trim()}
              className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg py-4 text-sm text-gray-500 hover:text-blue-600 transition disabled:opacity-40">
              {uploading ? '⏳ Uploading...' : '📁 Click to choose file (PDF, Word, Image)'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden"/>
          </div>

          {/* List of all non-private docs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">All Uploaded Documents ({hrDocs.filter(d => !d.is_private).length})</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100"><tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">File</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {hrDocs.filter(d => !d.is_private).map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.employee_name}</td>
                      <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{DOC_ICON[r.doc_type]||'📄'} {r.doc_type}</span></td>
                      <td className="px-4 py-2.5"><a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-medium">⬇ {r.file_name}</a>{r.file_size && <p className="text-xs text-gray-400">{formatSize(r.file_size)}</p>}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{r.notes||'—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</td>
                      <td className="px-4 py-2.5"><button onClick={() => deleteDoc(r.id, r.storage_path)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5"/></button></td>
                    </tr>
                  ))}
                  {hrDocs.filter(d => !d.is_private).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No documents uploaded yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === 'my-docs' ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
            <span>🔒</span>
            <span>Only you and HR/Managers can see the documents you upload here.</span>
          </div>
          <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4 shadow-sm">
            <h3 className="font-semibold text-blue-900 text-sm">Upload My Document</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Document Type</label>
                <select value={myUploadForm.doc_type} onChange={e => setMyUploadForm({...myUploadForm, doc_type: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900">
                  {ALL_DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input value={myUploadForm.notes} onChange={e => setMyUploadForm({...myUploadForm, notes: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900" placeholder="e.g. Updated resume"/></div>
            </div>
            <button onClick={() => myFileRef.current?.click()} disabled={uploading}
              className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg py-4 text-sm text-gray-500 hover:text-blue-600 transition disabled:opacity-40">
              {uploading ? '⏳ Uploading...' : '📁 Upload my document (PDF, Word, Image)'}
            </button>
            <input ref={myFileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], true)} className="hidden"/>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">My Documents ({myDocs.length})</p>
            </div>
            {myDocs.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><div className="text-3xl mb-2">📂</div><p>No documents uploaded yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100"><tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">File</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 w-8"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {myDocs.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{DOC_ICON[r.doc_type]||'📄'} {r.doc_type}</span></td>
                        <td className="px-4 py-2.5"><a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-medium">⬇ {r.file_name}</a>{r.file_size && <p className="text-xs text-gray-400">{formatSize(r.file_size)}</p>}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{r.notes||'—'}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</td>
                        <td className="px-4 py-2.5"><button onClick={() => deleteDoc(r.id, r.storage_path)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5"/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

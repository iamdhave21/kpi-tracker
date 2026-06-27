'use client'
import { useState, useEffect } from 'react'
import { supabase, Employee, KpiRecord } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Users, BarChart2, PlusCircle, LogOut, Search, Edit2, Trash2, Save, X, CheckCircle, AlertCircle, TrendingUp, Award, UserPlus, Menu, ChevronDown, ChevronUp, FileText, Shield, Key } from 'lucide-react'

type View = 'dashboard-month' | 'dashboard-employee' | 'entry' | 'employees' | 'teams' | 'settings'
type Toast = { msg: string; type: 'success' | 'error' }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = ['2024','2025','2026']

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

function LoginScreen({ onLogin }: { onLogin: (u: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      localStorage.setItem('kpi_user', JSON.stringify(data.user))
      onLogin(data.user.username)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Login failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4"><BarChart2 className="w-8 h-8 text-white" /></div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">AB Business Support Services</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-6">Default: admin / admin123</p>
      </div>
    </div>
  )
}

export default function KPIApp() {
  const [user, setUser] = useState<string | null>(null)
  const [view, setView] = useState<View>('dashboard-month')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<KpiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selMonth, setSelMonth] = useState('June')
  const [selYear, setSelYear] = useState('2025')
  const [selEmployee, setSelEmployee] = useState<string>('')
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('kpi_user')
    if (stored) setUser(JSON.parse(stored).username)
    else setLoading(false)
  }, [])

  useEffect(() => { if (user) loadData() }, [user])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
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

  if (!user) return <LoginScreen onLogin={u => { setUser(u); setLoading(true) }} />

  const navItems = [
    { id: 'dashboard-month' as View, label: 'Monthly', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'dashboard-employee' as View, label: 'Employee', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'entry' as View, label: 'KPI Entry', icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'employees' as View, label: 'Employees', icon: <Users className="w-4 h-4" /> },
    { id: 'teams' as View, label: 'Teams', icon: <Award className="w-4 h-4" /> },
    { id: 'settings' as View, label: 'Settings', icon: <FileText className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><BarChart2 className="w-4 h-4 text-white" /></div>
            <span className="font-semibold text-gray-900 hidden sm:block">KPI Tracker</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(n => (
              <button key={n.id} onClick={() => setView(n.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${view === n.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                {n.icon}{n.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:block">{user}</span>
            <button onClick={() => { localStorage.removeItem('kpi_user'); setUser(null) }} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"><LogOut className="w-4 h-4" /></button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-500 rounded-lg hover:bg-gray-100"><Menu className="w-4 h-4" /></button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 px-4 py-2 space-y-1">
            {navItems.map(n => (
              <button key={n.id} onClick={() => { setView(n.id); setMobileMenuOpen(false) }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${view === n.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                {n.icon}{n.label}
              </button>
            ))}
          </div>
        )}
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <>
            {view === 'dashboard-month' && <MonthlyDashboard records={records} selMonth={selMonth} selYear={selYear} setSelMonth={setSelMonth} setSelYear={setSelYear} searchQ={searchQ} setSearchQ={setSearchQ} />}
            {view === 'dashboard-employee' && <EmployeeDashboard records={records} employees={employees} selEmployee={selEmployee} setSelEmployee={setSelEmployee} />}
            {view === 'entry' && <KPIEntry employees={employees} records={records} onSaved={() => { loadData(); showToast('KPI record saved!') }} showToast={showToast} />}
            {view === 'employees' && <EmployeeManager employees={employees} onChanged={() => { loadData(); showToast('Updated!') }} showToast={showToast} />}
            {view === 'teams' && <TeamManager employees={employees} showToast={showToast} />}
            {view === 'settings' && <SettingsPanel currentUser={user} showToast={showToast} />}
          </>
        )}
      </main>
    </div>
  )
}

function MonthlyDashboard({ records, selMonth, selYear, setSelMonth, setSelYear, searchQ, setSearchQ }:
  { records: KpiRecord[], selMonth: string, selYear: string, setSelMonth: (v: string) => void, setSelYear: (v: string) => void, searchQ: string, setSearchQ: (v: string) => void }) {
  const filtered = records.filter(r => {
    const ml = (r.month_label || '').toLowerCase()
    const match = ml.includes(selMonth.toLowerCase()) && ml.includes(selYear)
    const q = searchQ.toLowerCase()
    return match && (!q || r.employee_name?.toLowerCase().includes(q) || r.designation?.toLowerCase().includes(q))
  })
  const ranked = [...filtered].filter(r => r.overall_score !== null && (r.overall_score || 0) > 0).sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
  const avgScore = ranked.length ? ranked.reduce((s, r) => s + (r.overall_score || 0), 0) / ranked.length : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-gray-900">Monthly Performance</h2><p className="text-sm text-gray-500">{filtered.length} records for {selMonth} {selYear}</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">{MONTHS.map(m => <option key={m}>{m}</option>)}</select>
          <select value={selYear} onChange={e => setSelYear(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">{YEARS.map(y => <option key={y}>{y}</option>)}</select>
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..." className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" /></div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Employees', value: filtered.length, icon: <Users className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Avg Score', value: avgScore > 0 ? (avgScore * 100).toFixed(2) + '%' : 'N/A', icon: <BarChart2 className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50' },
          { label: 'Perfect (100%)', value: ranked.filter(r => (r.overall_score || 0) >= 0.9999).length, icon: <Award className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
          { label: 'At Risk (<97%)', value: ranked.filter(r => (r.overall_score || 0) < 0.97).length, icon: <AlertCircle className="w-5 h-5 text-red-500" />, bg: 'bg-red-50' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
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
                <th key={h} className={`px-4 py-3 font-medium text-gray-600 ${['Attend. 20%','Accuracy 30%','Effic. 30%','Feedback 20%','Overall'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ranked.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No records. Use KPI Entry to add data.</td></tr>}
              {ranked.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.designation}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.attendance)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.accuracy)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.efficiency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{pct(r.feedback)}</td>
                  <td className="px-4 py-3 text-right"><span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${scoreBg(r.overall_score)}`}>{pct(r.overall_score)}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.notes ? r.notes.substring(0,60)+(r.notes.length>60?'...':'') : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function EmployeeDashboard({ records, employees, selEmployee, setSelEmployee }:
  { records: KpiRecord[], employees: Employee[], selEmployee: string, setSelEmployee: (v: string) => void }) {
  const emp = employees.find(e => e.id === selEmployee)
  const empRecords = records.filter(r => r.employee_id === selEmployee && r.overall_score !== null && (r.overall_score || 0) > 0).sort((a, b) => a.month_label.localeCompare(b.month_label))
  const chartData = empRecords.map(r => ({
    month: r.month_label.replace(' - ', "'").substring(0, 10),
    score: r.overall_score ? parseFloat((r.overall_score * 100).toFixed(2)) : 0,
    attendance: r.attendance ? parseFloat((r.attendance * 100).toFixed(2)) : 0,
    accuracy: r.accuracy ? parseFloat((r.accuracy * 100).toFixed(2)) : 0,
    efficiency: r.efficiency ? parseFloat((r.efficiency * 100).toFixed(2)) : 0,
    feedback: r.feedback ? parseFloat((r.feedback * 100).toFixed(2)) : 0,
  }))
  const avgScore = empRecords.length ? empRecords.reduce((s, r) => s + (r.overall_score || 0), 0) / empRecords.length : 0
  const latest = empRecords[empRecords.length - 1]
  const best = empRecords.reduce((b, r) => ((r.overall_score || 0) > (b?.overall_score || 0) ? r : b), empRecords[0])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-gray-900">Employee Performance</h2><p className="text-sm text-gray-500">{empRecords.length} months tracked</p></div>
        <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs">
          {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      {emp && <>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">{emp.name.split(',')[0]?.charAt(0) || '?'}</div>
          <div><h3 className="font-bold text-gray-900">{emp.name}</h3><p className="text-sm text-gray-500">{emp.designation}</p></div>
          {latest && <div className="ml-auto text-right"><p className="text-xs text-gray-400">Latest</p><span className={`text-xl font-bold ${scoreColor(latest.overall_score)}`}>{pct(latest.overall_score)}</span><p className="text-xs text-gray-400">{latest.month_label}</p></div>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Avg Score', value: avgScore > 0 ? (avgScore * 100).toFixed(2) + '%' : 'N/A' },
            { label: 'Months Tracked', value: empRecords.length },
            { label: 'Best Score', value: best ? pct(best.overall_score) : 'N/A' },
            { label: 'Perfect Months', value: empRecords.filter(r => (r.overall_score || 0) >= 0.9999).length },
          ].map(c => <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">{c.label}</p><p className="text-xl font-bold text-gray-900 mt-1">{c.value}</p></div>)}
        </div>
        {chartData.length > 1 && <>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-700 mb-4 text-sm">Overall Score Trend</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis domain={[80, 101]} tick={{ fontSize: 10 }} tickFormatter={v => v + '%'} />
                <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toFixed(2) + '%' : ''} />
                <ReferenceLine y={97} stroke="#fbbf24" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="Overall" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-700 mb-4 text-sm">KPI Breakdown Trend</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 101]} tick={{ fontSize: 10 }} tickFormatter={v => v + '%'} />
                <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toFixed(2) + '%' : ''} />
                <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={1.5} dot={false} name="Attendance" />
                <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Accuracy" />
                <Line type="monotone" dataKey="efficiency" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Efficiency" />
                <Line type="monotone" dataKey="feedback" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Feedback" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              {[['#10b981','Attendance'],['#3b82f6','Accuracy'],['#8b5cf6','Efficiency'],['#f59e0b','Feedback']].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block rounded" style={{ background: c }} />{l}</span>
              ))}
            </div>
          </div>
        </>}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h4 className="font-semibold text-gray-700 text-sm">Monthly History</h4></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                {['Month','Designation','Attendance','Accuracy','Efficiency','Feedback','Overall','Notes'].map(h => (
                  <th key={h} className={`px-4 py-2.5 font-medium text-gray-500 ${['Attendance','Accuracy','Efficiency','Feedback','Overall'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
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
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{r.notes ? r.notes.substring(0,60)+'...' : 'N/A'}</td>
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

function KPIEntry({ employees, records, onSaved, showToast }:
  { employees: Employee[], records: KpiRecord[], onSaved: () => void, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [empId, setEmpId] = useState(employees.find(e => e.active)?.id || '')
  const [monthLabel, setMonthLabel] = useState(`${MONTHS[new Date().getMonth()]} - ${new Date().getFullYear()}`)
  const [designation, setDesignation] = useState('')
  const [attendance, setAttendance] = useState('')
  const [accuracy, setAccuracy] = useState('')
  const [efficiency, setEfficiency] = useState('')
  const [feedback, setFeedback] = useState('')
  const [notes, setNotes] = useState('')
  const [coached, setCoached] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const selEmp = employees.find(e => e.id === empId)

  useEffect(() => { if (selEmp) setDesignation(selEmp.designation) }, [empId])
  useEffect(() => {
    const existing = records.find(r => r.employee_id === empId && r.month_label === monthLabel)
    if (existing) {
      setEditId(existing.id)
      setAttendance(existing.attendance !== null ? (existing.attendance * 100).toFixed(2) : '')
      setAccuracy(existing.accuracy !== null ? (existing.accuracy * 100).toFixed(2) : '')
      setEfficiency(existing.efficiency !== null ? (existing.efficiency * 100).toFixed(2) : '')
      setFeedback(existing.feedback !== null ? (existing.feedback * 100).toFixed(2) : '')
      setNotes(existing.notes || '')
      setCoached(existing.coached || false)
      setDesignation(existing.designation || selEmp?.designation || '')
    } else {
      setEditId(null)
      setAttendance(''); setAccuracy(''); setEfficiency(''); setFeedback(''); setNotes(''); setCoached(false)
    }
  }, [empId, monthLabel])

  function calcOverall() {
    const a = parseFloat(attendance)/100, b = parseFloat(accuracy)/100, c = parseFloat(efficiency)/100, d = parseFloat(feedback)/100
    if ([a,b,c,d].some(isNaN)) return null
    return a*0.2 + b*0.3 + c*0.3 + d*0.2
  }
  const overall = calcOverall()
  const allMonths = [...MONTHS.map(m => `${m} 2024`), ...MONTHS.map(m => `${m} - 2025`), ...MONTHS.map(m => `${m} - 2026`)]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        employee_id: empId, employee_name: selEmp?.name || '', designation: designation || selEmp?.designation || '',
        month_label: monthLabel,
        attendance: attendance !== '' ? parseFloat(attendance)/100 : null,
        accuracy: accuracy !== '' ? parseFloat(accuracy)/100 : null,
        efficiency: efficiency !== '' ? parseFloat(efficiency)/100 : null,
        feedback: feedback !== '' ? parseFloat(feedback)/100 : null,
        overall_score: overall, notes, coached, updated_at: new Date().toISOString()
      }
      const { error } = editId
        ? await supabase.from('kpi_records').update(payload).eq('id', editId)
        : await supabase.from('kpi_records').insert(payload)
      if (error) throw error
      onSaved()
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-gray-900">KPI Entry</h2><p className="text-sm text-gray-500">Enter or update monthly KPI scores</p></div>
      {editId && <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2"><Edit2 className="w-4 h-4" />Editing existing record for {selEmp?.name}</div>}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select value={monthLabel} onChange={e => setMonthLabel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {allMonths.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
          <input value={designation} onChange={e => setDesignation(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. FSCM, AR B2B, AP - COGS" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Attendance', weight: '20%', val: attendance, set: setAttendance },
            { label: 'Accuracy', weight: '30%', val: accuracy, set: setAccuracy },
            { label: 'Efficiency', weight: '30%', val: efficiency, set: setEfficiency },
            { label: 'Ext/Int Feedback', weight: '20%', val: feedback, set: setFeedback },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} <span className="text-gray-400 font-normal text-xs">({f.weight})</span></label>
              <div className="relative">
                <input type="number" min="0" max="100" step="0.01" value={f.val} onChange={e => f.set(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 100" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          ))}
        </div>
        {overall !== null && (
          <div className={`rounded-xl px-4 py-3 text-center ${scoreBg(overall)}`}>
            <p className="text-xs font-medium opacity-70">Calculated Overall Score</p>
            <p className="text-2xl font-bold">{pct(overall)}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Client Feedback</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Client feedback, coaching notes, highlights, lowlights..." />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="coached" checked={coached} onChange={e => setCoached(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
          <label htmlFor="coached" className="text-sm text-gray-700">Coaching session conducted this month</label>
        </div>
        <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />{saving ? 'Saving...' : editId ? 'Update Record' : 'Save Record'}
        </button>
      </form>
    </div>
  )
}

function EmployeeManager({ employees, onChanged, showToast }:
  { employees: Employee[], onChanged: () => void, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [newName, setNewName] = useState('')
  const [newDesig, setNewDesig] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesig, setEditDesig] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const filtered = employees.filter(e => !searchQ || e.name.toLowerCase().includes(searchQ.toLowerCase()) || e.designation.toLowerCase().includes(searchQ.toLowerCase()))

  async function addEmployee() {
    if (!newName.trim()) return; setAdding(true)
    const { error } = await supabase.from('employees').insert({ name: newName.trim(), designation: newDesig.trim(), active: true })
    if (error) showToast(error.message, 'error')
    else { setNewName(''); setNewDesig(''); onChanged() }
    setAdding(false)
  }

  async function saveEdit(id: string) {
    const { error } = await supabase.from('employees').update({ name: editName, designation: editDesig }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else { setEditId(null); onChanged() }
  }

  async function toggleActive(emp: Employee) {
    const { error } = await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id)
    if (error) showToast(error.message, 'error')
    else onChanged()
  }

  async function deleteEmployee(id: string) {
    if (!confirm('Delete this employee and all their KPI records?')) return
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) showToast(error.message, 'error')
    else { showToast('Employee deleted'); onChanged() }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-gray-900">Employee Management</h2><p className="text-sm text-gray-500">{employees.filter(e => e.active).length} active, {employees.filter(e => !e.active).length} inactive</p></div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500" />Add New Employee</h3>
        <div className="flex gap-3 flex-col sm:flex-row">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={newDesig} onChange={e => setNewDesig(e.target.value)} placeholder="Designation" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={addEmployee} disabled={adding || !newName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
            <PlusCircle className="w-4 h-4" />Add
          </button>
        </div>
      </div>
      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search employees..." className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.map((emp, i) => (
          <div key={emp.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50`}>
            {editId === emp.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                <input value={editDesig} onChange={e => setEditDesig(e.target.value)} className="w-40 border border-gray-300 rounded px-2 py-1 text-sm" />
                <button onClick={() => saveEdit(emp.id)} className="text-emerald-600 hover:text-emerald-700 p-1"><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${emp.active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>{emp.name.split(',')[0]?.charAt(0) || '?'}</div>
                <div className="flex-1 min-w-0"><p className={`text-sm font-medium truncate ${emp.active ? 'text-gray-900' : 'text-gray-400'}`}>{emp.name}</p><p className="text-xs text-gray-500 truncate">{emp.designation}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${emp.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{emp.active ? 'Active' : 'Inactive'}</span>
                <button onClick={() => { setEditId(emp.id); setEditName(emp.name); setEditDesig(emp.designation) }} className="text-gray-400 hover:text-blue-600 p-1 transition"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => toggleActive(emp)} className="text-gray-400 hover:text-yellow-600 p-1 transition" title={emp.active ? 'Deactivate' : 'Activate'}>{emp.active ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</button>
                <button onClick={() => deleteEmployee(emp.id)} className="text-gray-400 hover:text-red-600 p-1 transition"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No employees found.</div>}
      </div>
    </div>
  )
}


// ── Team Manager ───────────────────────────────────────────────────────────
function TeamManager({ employees, showToast }:
  { employees: Employee[], showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newLeadId, setNewLeadId] = useState('')
  const [selTeam, setSelTeam] = useState<string | null>(null)
  const [addMemberId, setAddMemberId] = useState('')

  async function loadTeams() {
    setLoading(true)
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('teams').select('*, team_lead:employees(name)').order('name'),
      supabase.from('team_members').select('*, employee:employees(name, designation)')
    ])
    setTeams(t || [])
    setMembers(m || [])
    setLoading(false)
  }

  useEffect(() => { loadTeams() }, [])

  async function createTeam() {
    if (!newTeamName.trim()) return
    const { error } = await supabase.from('teams').insert({
      name: newTeamName.trim(), department: newDept.trim(),
      team_lead_id: newLeadId || null, active: true
    })
    if (error) showToast(error.message, 'error')
    else { setNewTeamName(''); setNewDept(''); setNewLeadId(''); loadTeams(); showToast('Team created!') }
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team?')) return
    await supabase.from('teams').delete().eq('id', id)
    setSelTeam(null); loadTeams(); showToast('Team deleted')
  }

  async function addMember() {
    if (!selTeam || !addMemberId) return
    const { error } = await supabase.from('team_members').insert({ team_id: selTeam, employee_id: addMemberId })
    if (error) showToast('Member already in team', 'error')
    else { setAddMemberId(''); loadTeams(); showToast('Member added!') }
  }

  async function removeMember(id: string) {
    await supabase.from('team_members').delete().eq('id', id)
    loadTeams()
  }

  async function updateLead(teamId: string, leadId: string) {
    await supabase.from('teams').update({ team_lead_id: leadId || null }).eq('id', teamId)
    loadTeams()
  }

  const teamMembers = members.filter(m => m.team_id === selTeam)
  const teamMemberIds = teamMembers.map(m => m.employee_id)
  const availableToAdd = employees.filter(e => e.active && !teamMemberIds.includes(e.id))
  const selectedTeam = teams.find(t => t.id === selTeam)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-gray-900">Team Management</h2>
        <p className="text-sm text-gray-500">{teams.length} teams configured</p></div>

      {/* Create team */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-blue-500" />Create New Team
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
            placeholder="Team name (e.g. AR Team)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={newDept} onChange={e => setNewDept(e.target.value)}
            placeholder="Department (e.g. AR, AP, APAC)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={newLeadId} onChange={e => setNewLeadId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select team lead...</option>
            {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button onClick={createTeam} disabled={!newTeamName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2">
            <PlusCircle className="w-4 h-4" />Create
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Teams list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">All Teams</h3>
          </div>
          {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> :
            teams.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">No teams yet. Create one above.</div> :
            teams.map((team, i) => (
              <div key={team.id} onClick={() => setSelTeam(team.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${i > 0 ? 'border-t border-gray-100' : ''} ${selTeam === team.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{team.name}</p>
                  <p className="text-xs text-gray-500">{team.department} {team.team_lead?.name ? `· Lead: ${team.team_lead.name.split(',')[0]}` : '· No lead assigned'}</p>
                  <p className="text-xs text-gray-400">{members.filter(m => m.team_id === team.id).length} members</p>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteTeam(team.id) }}
                  className="text-gray-400 hover:text-red-600 p-1 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))
          }
        </div>

        {/* Team detail */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {!selTeam ? (
            <div className="p-8 text-center text-gray-400 text-sm">Select a team to manage members</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700 text-sm">{selectedTeam?.name} — Members</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Team Lead:</span>
                  <select value={selectedTeam?.team_lead_id || ''} onChange={e => updateLead(selTeam, e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs text-gray-900">
                    <option value="">No lead assigned</option>
                    {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name.split(',')[0]}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-4 border-b border-gray-100">
                <div className="flex gap-2">
                  <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Add member...</option>
                    {availableToAdd.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <button onClick={addMember} disabled={!addMemberId}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                    Add
                  </button>
                </div>
              </div>
              <div>
                {teamMembers.length === 0 ? <div className="p-6 text-center text-gray-400 text-sm">No members yet</div> :
                  teamMembers.map((m, i) => (
                    <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                      <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {m.employee?.name?.split(',')[0]?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.employee?.name}</p>
                        <p className="text-xs text-gray-500">{m.employee?.designation}</p>
                      </div>
                      <button onClick={() => removeMember(m.id)} className="text-gray-400 hover:text-red-600 p-1 transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                }
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Settings Panel ─────────────────────────────────────────────────────────
function SettingsPanel({ currentUser, showToast }: { currentUser: string | null, showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'password'>('users')
  const [users, setUsers] = useState<string[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)

  // Get current users from APP_USERS env (displayed as list)
  const knownUsers = ['admin', 'dhave', 'teamlead1']

  async function loadActivityLog() {
    setLoadingLog(true)
    // We'll use kpi_records updated_at as proxy for activity
    const { data } = await supabase.from('kpi_records').select('employee_name, month_label, updated_at').order('updated_at', { ascending: false }).limit(50)
    setActivityLog(data || [])
    setLoadingLog(false)
  }

  useEffect(() => { if (activeTab === 'activity') loadActivityLog() }, [activeTab])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirmPass) { showToast('Passwords do not match', 'error'); return }
    if (newPass.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, oldPassword, newPassword: newPass })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('Password changed! Please log in again.')
      setOldPassword(''); setNewPass(''); setConfirmPass('')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500">Manage app users, activity, and security</p></div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['users','App Users'],['activity','Activity Log'],['password','Change Password']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />App Users
            </h3>
            <p className="text-sm text-gray-500 mb-4">Users are managed via the <code className="bg-gray-100 px-1 rounded text-xs">APP_USERS</code> environment variable in Vercel. Format: <code className="bg-gray-100 px-1 rounded text-xs">username:password,user2:pass2</code></p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">To add or remove users:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Go to <strong>vercel.com</strong> → your kpi-tracker project</li>
                <li>Click <strong>Settings</strong> → <strong>Environment Variables</strong></li>
                <li>Edit <strong>APP_USERS</strong> and add <code>username:password</code></li>
                <li>Click <strong>Save</strong> then redeploy</li>
              </ol>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Current configured users (from your Vercel env):</p>
              <div className="space-y-2">
                {['admin (Manager)', 'dhave (Manager)', 'teamlead1 (Team Lead)'].map(u => (
                  <div key={u} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{u.charAt(0).toUpperCase()}</div>
                    <span className="text-sm text-gray-700">{u}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">Recent KPI Activity</h3>
            <button onClick={loadActivityLog} className="text-xs text-blue-600 hover:text-blue-700">Refresh</button>
          </div>
          {loadingLog ? <div className="p-8 text-center text-gray-400">Loading...</div> :
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Employee</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Month</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Last Updated</th>
                </tr></thead>
                <tbody>
                  {activityLog.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-900 font-medium">{r.employee_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.month_label}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(r.updated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activityLog.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-400">No activity yet</td></tr>}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}

      {activeTab === 'password' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
          <h3 className="font-semibold text-gray-700 text-sm mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-500" />Change Your Password
          </h3>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required minLength={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <p className="text-xs text-gray-500">Note: Password changes update your Vercel environment variable. Contact admin if you lose access.</p>
            <button type="submit" disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

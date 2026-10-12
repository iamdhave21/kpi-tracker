'use client'
import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { HistRow, historyStats, tone } from '@/lib/agentHistory'

// One person's whole scorecard history, from the Dashboard's "Check one agent" dropdown.
// Rules and tests: lib/agentHistory.ts. Months with an unfinished entry (overall 25% or less) are shown as
// "unfinished" and left out of every average.

const TONE: Record<string, string> = { none: 'bg-gray-50 text-gray-400 border-gray-200', good: 'bg-emerald-50 text-emerald-700 border-emerald-200', watch: 'bg-amber-50 text-amber-700 border-amber-200', bad: 'bg-red-50 text-red-700 border-red-200' }
const f = (v: number | null) => v === null ? '—' : v.toFixed(2) + '%'
const short = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })

export default function AgentHistoryCard({ name, designation, client, hire, history, year, onClose }: {
  name: string, designation?: string | null, client?: string | null, hire?: string | null, history: HistRow[], year: number, onClose: () => void,
}) {
  const stats = useMemo(() => historyStats(history, year), [history, year])
  const chart = useMemo(() => history.map(h => ({ month: short(h.month), Overall: h.overall, Attendance: h.attendance })), [history])
  const lows = chart.flatMap(c => [c.Overall, c.Attendance]).filter((v): v is number => v !== null)
  const floor = lows.length ? Math.max(0, Math.floor(Math.min(...lows, 90) / 5) * 5) : 80
  const tiles = [
    { l: stats.latest ? `Latest (${stats.latest.label})` : 'Latest', v: f(stats.latest?.overall ?? null), t: tone(stats.latest?.overall ?? null), sub: stats.change === null ? '' : `${stats.change > 0 ? '▲ +' : stats.change < 0 ? '▼ ' : '▬ '}${stats.change.toFixed(2)} vs previous` },
    { l: `Average ${year}`, v: f(stats.avgYear), t: tone(stats.avgYear), sub: '' },
    { l: 'Last 3 scored months', v: f(stats.avgLast3), t: tone(stats.avgLast3), sub: '' },
    { l: 'Average attendance', v: f(stats.avgAttendance), t: tone(stats.avgAttendance), sub: '' },
    { l: 'Months under 97%', v: String(stats.belowBar), t: stats.belowBar === 0 ? 'good' : 'watch', sub: stats.lowest ? `Lowest: ${stats.lowest.label} (${f(stats.lowest.overall)})` : '' },
  ]
  return (
    <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-blue-900">{name}</h3>
          <p className="text-xs text-gray-500">{[designation, client, hire ? `Hired ${new Date(hire.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}` : ''].filter(Boolean).join(' · ')}{history.length ? ` · ${history.length} months on record` : ''}</p>
        </div>
        <button onClick={onClose} className="text-xs text-blue-600 hover:underline">Close</button>
      </div>

      {history.length === 0 ? <p className="text-sm text-gray-400">No scorecard records for this person yet.</p> : (<>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {tiles.map(t => (
            <div key={t.l} className="border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500">{t.l}</p>
              <p className={`inline-block mt-1 text-lg font-bold px-2 py-0.5 rounded-lg border ${TONE[t.t]}`}>{t.v}</p>
              {t.sub && <p className="text-[11px] text-gray-400 mt-1">{t.sub}</p>}
            </div>))}
        </div>

        <div className="h-56" role="img" aria-label={`Overall and attendance by month for ${name}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[floor, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toFixed(2) + '%' : '—')} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={97} stroke="#fca5a5" strokeDasharray="4 4" label={{ value: '97%', fontSize: 10, fill: '#ef4444', position: 'insideTopRight' }} />
              <Line type="monotone" dataKey="Overall" stroke="#1e3a8a" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
              <Line type="monotone" dataKey="Attendance" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left"><tr><th className="px-2 py-2">Month</th><th className="px-2 py-2 text-right">Attendance</th><th className="px-2 py-2 text-right">Accuracy</th><th className="px-2 py-2 text-right">Efficiency</th><th className="px-2 py-2 text-right">Feedback</th><th className="px-2 py-2 text-right">Overall</th><th className="px-2 py-2">Notes</th></tr></thead>
            <tbody>
              {[...history].reverse().map(h => (
                <tr key={h.month} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-medium text-gray-800 whitespace-nowrap">{h.label}</td>
                  <td className="px-2 py-1.5 text-right">{f(h.attendance)}</td><td className="px-2 py-1.5 text-right">{f(h.accuracy)}</td><td className="px-2 py-1.5 text-right">{f(h.efficiency)}</td><td className="px-2 py-1.5 text-right">{f(h.feedback)}</td>
                  <td className="px-2 py-1.5 text-right"><span className={`px-1.5 py-0.5 rounded border font-semibold ${TONE[tone(h.overall)]}`}>{h.overall === null ? '—' : f(h.overall)}</span></td>
                  <td className="px-2 py-1.5 text-gray-500">{[h.incomplete ? 'Unfinished entry: accuracy, efficiency and feedback not entered' : '', h.rows > 1 ? `${h.rows} records averaged` : ''].filter(Boolean).join('. ')}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400">Green is 97% or above, amber 94 to 97, red below 94. Months with an unfinished entry are left out of the averages.</p>
      </>)}
    </div>
  )
}

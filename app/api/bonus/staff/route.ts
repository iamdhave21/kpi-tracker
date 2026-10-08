import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/clientPortalAuth'
import { verifyStaff } from '@/lib/staffAuth'
import { aggregateMonths, Person } from '@/lib/bonus'

// Bonus Review API. SUPER ADMIN ONLY: every call needs the verified Google sign-in (verifyStaff)
// AND the super_admin role. It returns pay-related data, so there is no other way in. The tables
// it saves to have RLS on with no policies.

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
const likeEsc = (s: string) => s.replace(/[\\%_]/g, '\\$&')
const isYmd = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime())
const nameKey = (n: string) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ')

// The portal returns at most 1000 rows per request, so page through.
async function fetchAll(make: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await make(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function POST(req: NextRequest) {
  const staff = await verifyStaff(req)
  if (!staff) return fail('Please sign in with Google again to use this.', 401)
  if (staff.role !== 'super_admin') return fail('Only the Super Admin can use the Bonus Review.', 403)
  const supabase = getServiceSupabase()
  const body = await req.json().catch(() => ({}))
  try {
    switch (body.action) {
      case 'people': {
        let hireColumn = true
        let empRes: any = await supabase.from('employees').select('id, name, email, client, hire_date, active').eq('active', true)
        if (empRes.error && /hire_date/.test(empRes.error.message)) {
          hireColumn = false
          empRes = await supabase.from('employees').select('id, name, email, client, active').eq('active', true)
        }
        if (empRes.error) throw new Error(empRes.error.message)
        // The same person can have one employee row per client; count them once.
        const groups = new Map<string, { ids: string[], name: string, team: string | null, hire: string | null }>()
        for (const e of empRes.data || []) {
          const k = nameKey(e.name)
          const g: { ids: string[], name: string, team: string | null, hire: string | null } = groups.get(k) || { ids: [], name: e.name, team: null, hire: null }
          g.ids.push(e.id)
          if (!g.team && e.client) g.team = e.client
          if (e.hire_date && (!g.hire || e.hire_date < g.hire)) g.hire = e.hire_date
          groups.set(k, g)
        }
        const allIds = Array.from(groups.values()).flatMap(g => g.ids)
        const idToKey = new Map<string, string>()
        groups.forEach((g, k) => g.ids.forEach(id => idToKey.set(id, k)))

        const kpi = allIds.length ? await fetchAll((a, b) => supabase.from('kpi_records').select('employee_id, month_label, overall_score, attendance').in('employee_id', allIds).range(a, b)) : []
        const nteRows = await fetchAll((a, b) => supabase.from('nte_records').select('employee_id, date_issued').range(a, b))

        let escSource: 'ok' | 'unavailable' = 'ok'
        let obs: any[] = []
        try {
          obs = await fetchAll((a, b) => supabase.from('client_observations').select('event_date, tone, staff_involved').in('tone', ['concern', 'risk']).range(a, b))
        } catch { escSource = 'unavailable' }

        const rowsByKey = new Map<string, any[]>(), nteByKey = new Map<string, string[]>()
        for (const r of kpi) { const k = idToKey.get(r.employee_id); if (k) rowsByKey.set(k, [...(rowsByKey.get(k) || []), { label: r.month_label, overall: r.overall_score, attendance: r.attendance }]) }
        for (const r of nteRows) { const k = idToKey.get(r.employee_id); if (k && r.date_issued) nteByKey.set(k, [...(nteByKey.get(k) || []), String(r.date_issued).slice(0, 10)]) }

        const people: Person[] = []
        groups.forEach((g, k) => {
          // "Latimer, Azeliza" -> must find BOTH names in the observation text.
          const [last, rest] = g.name.includes(',') ? g.name.split(',') : [g.name.split(' ').slice(-1)[0], g.name.split(' ')[0]]
          const l = nameKey(last), f = nameKey(rest || '').split(' ')[0]
          const escDates = escSource === 'ok' && l && f
            ? obs.filter(o => { const t = nameKey(o.staff_involved || ''); return t.includes(l) && t.includes(f) && o.event_date }).map(o => String(o.event_date).slice(0, 10))
            : []
          people.push({ key: k, name: g.name, team: g.team, hire: g.hire, months: aggregateMonths(rowsByKey.get(k) || []), nteDates: nteByKey.get(k) || [], escDates, ids: g.ids })
        })
        people.sort((a, b) => a.name.localeCompare(b.name))
        return NextResponse.json({ people, meta: { hireColumn, escSource, escObservations: obs.length, people: people.length } })
      }

      case 'set_hire': {
        const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string').slice(0, 10) : []
        if (!ids.length || !isYmd(body.hire_date)) return fail('Choose a valid date.')
        const { error } = await supabase.from('employees').update({ hire_date: body.hire_date }).in('id', ids)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }

      case 'presets_list': {
        const { data, error } = await supabase.from('bonus_presets').select('id, name, config').order('name')
        if (error) throw new Error(`bonus_presets: ${error.message}`)
        return NextResponse.json({ presets: data || [] })
      }
      case 'preset_save': {
        const name = String(body.name || '').trim().slice(0, 80)
        if (!name || typeof body.config !== 'object' || !body.config) return fail('Give the preset a name.')
        const { data: ex } = await supabase.from('bonus_presets').select('id').ilike('name', likeEsc(name)).maybeSingle()
        const row = { name, config: { ...body.config, name }, updated_at: new Date().toISOString() }
        const res = ex ? await supabase.from('bonus_presets').update(row).eq('id', ex.id) : await supabase.from('bonus_presets').insert({ ...row, created_by: staff.email })
        if (res.error) throw new Error(res.error.message)
        return NextResponse.json({ ok: true })
      }
      case 'preset_delete': {
        const { error } = await supabase.from('bonus_presets').delete().eq('id', body.id)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }

      case 'run_save': {
        const title = String(body.title || '').trim().slice(0, 120)
        if (!title) return fail('Give the run a title.')
        const status = body.status === 'final' ? 'final' : 'draft'
        const json = JSON.stringify([body.config, body.overrides, body.results, body.totals])
        if (json.length > 900000) return fail('That run is too large to save.')
        const { data, error } = await supabase.from('bonus_runs').insert({
          title, status, config: body.config, overrides: body.overrides || {}, results: body.results || [], totals: body.totals || {},
          created_by: staff.email, created_by_name: staff.name,
        }).select('id').single()
        if (error) throw new Error(`bonus_runs: ${error.message}`)
        return NextResponse.json({ id: data.id })
      }
      case 'runs_list': {
        const { data, error } = await supabase.from('bonus_runs').select('id, title, status, totals, created_by_name, created_at').order('created_at', { ascending: false }).limit(50)
        if (error) throw new Error(`bonus_runs: ${error.message}`)
        return NextResponse.json({ runs: data || [] })
      }
      case 'run_get': {
        const { data, error } = await supabase.from('bonus_runs').select('*').eq('id', body.id).maybeSingle()
        if (error || !data) return fail('Not found', 404)
        return NextResponse.json({ run: data })
      }
      case 'run_delete': {
        const { error } = await supabase.from('bonus_runs').delete().eq('id', body.id)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }
      default:
        return fail('Unknown action')
    }
  } catch (e: any) {
    console.error('bonus route error:', body.action, e)
    return fail(String(e?.message || 'Something went wrong.'), 500)
  }
}

export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vgqbyzcchvhvjbvoodxe.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Employee = {
  id: string
  name: string
  designation: string
  email: string | null
  employee_id: string | null
  departments: string[] | null
  employment_type: string | null
  contract_type: string | null
  client: string | null
  clients_supported: string[] | null
  active: boolean
  created_at: string
}

export type NteRecord = {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string | null
  position: string | null
  department: string | null
  client: string | null
  immediate_supervisor: string | null
  offense_category: string | null
  date_issued: string
  date_of_incident: string
  warning_level: 'Verbal Warning' | 'Written Warning' | 'Final Written Warning' | 'Dismissal'
  incident_statement: string
  policy_violated: string
  attachments: { name: string, url: string, type: string }[] | null
  employee_action_plan: string | null
  party_term: string | null
  status: 'Issued' | 'Explanation Submitted' | 'Resolved'
  created_by: string
  created_at: string
}

// Antivirus scan compliance -- quick scan weekly, full scan monthly.
// Screenshots live in the PRIVATE `av-scans` storage bucket (not the
// app's usual public `attachments` bucket) and are deleted after 90 days
// by app/api/cron/av-scan-cleanup -- this row survives that deletion so a
// year of compliance history is never lost, it just stops being able to
// show the picture itself.
// `period_key` is what uniqueness and lookups actually key on -- a Monday
// date string for `quick` (weekly), a `YYYY-MM` string for `full`
// (monthly), same convention as this app's existing Operating Cadence
// period keys. `week_start` is kept only as descriptive "which calendar
// week did this happen in" context and is no longer load-bearing.
export type AvScanSubmission = {
  id: string
  employee_id: string
  employee_name: string | null
  employee_email: string
  week_start: string
  period_key: string
  scan_type: 'quick' | 'full'
  storage_path: string
  submitted_at: string
  screenshot_deleted_at: string | null
}

export type KpiRecord = {
  id: string
  employee_id: string
  employee_name: string
  designation: string
  month_label: string
  attendance: number | null
  accuracy: number | null
  efficiency: number | null
  feedback: number | null
  overall_score: number | null
  compliance_score: number | null
  ranking: number | null
  notes: string | null
  coached: boolean
  created_at: string
  updated_at: string
}

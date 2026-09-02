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
  date_issued: string
  date_of_incident: string
  warning_level: 'Verbal Warning' | 'Written Warning' | 'Final Written Warning' | 'Dismissal'
  incident_statement: string
  policy_violated: string
  findings_evaluation: string | null
  disciplinary_action_imposed: string | null
  effective_date: string | null
  coaching_action_plan: string | null
  target_followup_date: string | null
  responsible_manager: string | null
  hr_representative: string | null
  status: 'Issued' | 'Explanation Submitted' | 'Resolved'
  created_by: string
  created_at: string
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

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vgqbyzcchvhvjbvoodxe.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Employee = {
  id: string
  name: string
  designation: string
  active: boolean
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
  ranking: number | null
  notes: string | null
  coached: boolean
  created_at: string
  updated_at: string
}

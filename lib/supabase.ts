import { createClient } from '@supabase/supabase-js'

// Hardcoded fallback to ensure connection works
const supabaseUrl = 'https://vgqbyzcchvhjbvoodxe.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncWJ5emNjaHZodmpidm9vZHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTcyMzIsImV4cCI6MjA5ODEzMzIzMn0.lzPqxszcneUKdpWS35Rl5JLgJXyqsV6zPLmqAfzQpcQ'

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

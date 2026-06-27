
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugPage() {
  const [result, setResult] = useState<any>(null)
  
  useEffect(() => {
    async function test() {
      try {
        const { data, error, count } = await supabase
          .from('employees')
          .select('id, name', { count: 'exact' })
          .limit(5)
        setResult({ success: !error, error: error?.message, count, data })
      } catch(e: any) {
        setResult({ success: false, error: e.message })
      }
    }
    test()
  }, [])
  
  return (
    <div style={{padding: '2rem', fontFamily: 'monospace'}}>
      <h1>Supabase Connection Test</h1>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  )
}

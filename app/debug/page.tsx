'use client'
import { useEffect, useState } from 'react'

export default function DebugPage() {
  const [result, setResult] = useState<any>('loading...')
  
  useEffect(() => {
    const SUPABASE_URL = 'https://vgqbyzcchvhjbvoodxe.supabase.co'
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncWJ5emNjaHZodmpidm9vZHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTcyMzIsImV4cCI6MjA5ODEzMzIzMn0.lzPqxszcneUKdpWS35Rl5JLgJXyqsV6zPLmqAfzQpcQ'
    
    // Test 1: raw fetch
    fetch(`${SUPABASE_URL}/rest/v1/employees?select=id,name&limit=3`, {
      method: 'GET',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    .then(r => {
      setResult({ status: r.status, ok: r.ok, statusText: r.statusText })
      return r.json()
    })
    .then(data => setResult(prev => ({ ...prev, data })))
    .catch(err => setResult({ error: err.message, type: err.name }))
  }, [])
  
  return (
    <div style={{padding: '2rem', fontFamily: 'monospace', background: '#111', color: '#0f0', minHeight: '100vh'}}>
      <h2>Raw Supabase Fetch Test</h2>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  )
}

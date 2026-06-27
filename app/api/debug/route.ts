import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    return NextResponse.json({ 
      error: 'Missing env vars',
      hasUrl: !!url,
      hasKey: !!key,
      urlPreview: url ? url.substring(0, 30) + '...' : 'MISSING',
      keyPreview: key ? key.substring(0, 20) + '...' : 'MISSING'
    })
  }
  
  try {
    const supabase = createClient(url, key)
    const { data, error, count } = await supabase
      .from('employees')
      .select('id, name', { count: 'exact' })
      .limit(3)
    
    return NextResponse.json({
      success: !error,
      error: error?.message,
      employeeCount: count,
      sample: data,
      urlPreview: url.substring(0, 40),
      keyPreview: key.substring(0, 20) + '...'
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) })
  }
}

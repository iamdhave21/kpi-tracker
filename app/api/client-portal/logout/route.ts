import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, SESSION_COOKIE } from '@/lib/clientPortalAuth'

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value
  if (sessionToken) {
    const supabase = getServiceSupabase()
    await supabase.from('client_sessions').delete().eq('session_token', sessionToken)
  }
  const res = NextResponse.json({ success: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}

import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getServiceSupabase, SESSION_COOKIE } from '@/lib/clientPortalAuth'
import { allowedPaths, signedUrl } from '@/lib/requestsServer'

// A short-lived link to ONE attachment on one of the caller's own requests.
// The path must be listed on that request (or on a message the client can see),
// so a path can't be guessed or swapped to reach another client's file.
export async function GET(req: NextRequest) {
  const contact = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!contact) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('request_id'), path = req.nextUrl.searchParams.get('path')
  if (!id || !path) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const supabase = getServiceSupabase()
  const { data: r } = await supabase.from('client_requests').select('id, attachments').eq('id', id).eq('client', contact.client).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: msgs } = await supabase.from('client_request_messages').select('attachments, visible_to_client').eq('request_id', id)
  if (!allowedPaths(r as any, (msgs || []) as any, true).has(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const url = await signedUrl(supabase, path)
  return url ? NextResponse.json({ url }) : NextResponse.json({ error: 'Could not open the file' }, { status: 500 })
}

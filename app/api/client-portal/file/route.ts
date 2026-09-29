import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getServiceSupabase, SESSION_COOKIE } from '@/lib/clientPortalAuth'

// Signed URL good for 5 minutes -- long enough to open/download once,
// short enough that it's useless if it ever leaks out of that window.
export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value
  const contact = await verifySession(sessionToken)
  if (!contact) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const submissionId = req.nextUrl.searchParams.get('submission_id')
  if (!submissionId) return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 })

  const supabase = getServiceSupabase()

  // Re-derive the caller's own pack and only ever allow generating a
  // signed URL for a file that belongs to THAT pack -- never trust the
  // submission_id alone, since it's just an opaque id a client could
  // otherwise try guessing/incrementing.
  const { data: pack } = await supabase.from('handover_pack_records').select('id').eq('client', contact.client).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!pack) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: submission } = await supabase.from('handover_pack_submissions').select('file_path, pack_record_id').eq('id', submissionId).single()
  if (!submission || submission.pack_record_id !== pack.id || !submission.file_path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: signed, error } = await supabase.storage.from('client-uploads').createSignedUrl(submission.file_path, 300)
  if (error || !signed) return NextResponse.json({ error: 'Could not generate link' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}

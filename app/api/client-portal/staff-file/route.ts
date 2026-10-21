import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/clientPortalAuth'
import { requireStaff, ADMIN_ROLES } from '@/lib/staffAuth'

// Issues a 5-minute signed link to a file a client uploaded in the portal.
// Caller identity comes from the real Google session token (verified by
// Supabase Auth in lib/staffAuth.ts), NOT from an email typed into the request.
// Client Onboarding is an Admin / Super Admin screen, so only those roles may
// open client uploads.
export async function POST(req: NextRequest) {
  const gate = await requireStaff(req, ADMIN_ROLES)
  if ('error' in gate) return gate.error

  const { submission_id } = await req.json().catch(() => ({}))
  if (!submission_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = getServiceSupabase()
  const { data: submission } = await supabase.from('handover_pack_submissions').select('file_path').eq('id', submission_id).single()
  if (!submission || !submission.file_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: signed, error } = await supabase.storage.from('client-uploads').createSignedUrl(submission.file_path, 300)
  if (error || !signed) return NextResponse.json({ error: 'Could not generate link' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}

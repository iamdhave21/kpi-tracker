import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/clientPortalAuth'

// Honest note on this route's security level: this app's internal staff
// auth has no server-verifiable session at all (checked directly --
// login state lives client-side only, same as every other internal API
// route in this codebase; see AUDIT.md C2). Rather than silently
// inheriting that same gap here, this route requires the caller's
// claimed staff email and checks it's a real, active app_users account
// before issuing a signed URL -- stricter than most existing routes in
// this app, though still not a full server session. A genuine fix would
// mean adding real server-verifiable staff sessions app-wide, which is
// the existing RLS-hardening pending item, not something to bolt on
// ad hoc for just this one feature.
export async function POST(req: NextRequest) {
  const { submission_id, staff_email } = await req.json()
  if (!submission_id || !staff_email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = getServiceSupabase()

  const { data: staffUser } = await supabase.from('app_users').select('id, active').ilike('email', staff_email).eq('active', true).maybeSingle()
  if (!staffUser) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { data: submission } = await supabase.from('handover_pack_submissions').select('file_path').eq('id', submission_id).single()
  if (!submission || !submission.file_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: signed, error } = await supabase.storage.from('client-uploads').createSignedUrl(submission.file_path, 300)
  if (error || !signed) return NextResponse.json({ error: 'Could not generate link' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}

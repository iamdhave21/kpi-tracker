import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getServiceSupabase, SESSION_COOKIE } from '@/lib/clientPortalAuth'

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20MB
const ALLOWED_EXT = ['pdf','doc','docx','xls','xlsx','ppt','pptx','png','jpg','jpeg','csv','txt']

function looksLikeUrl(v: string) {
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value
  const contact = await verifySession(sessionToken)
  if (!contact) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const supabase = getServiceSupabase()

  // The pack this item belongs to is re-derived from the caller's own
  // session-resolved client, not trusted from the form -- so a client
  // can never submit against another client's pack even if they somehow
  // guessed a pack_record_id or item_id.
  const { data: pack } = await supabase
    .from('handover_pack_records')
    .select('id, client')
    .eq('client', contact.client)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!pack) return NextResponse.json({ error: 'No onboarding checklist has been set up for your account yet. Please contact your AB BSS Operations contact.' }, { status: 404 })

  const form = await req.formData()
  const itemId = form.get('item_id')?.toString()
  const notes = form.get('notes')?.toString() || null
  const driveLink = form.get('drive_link')?.toString() || null
  const file = form.get('file') as File | null
  const markNotApplicable = form.get('not_applicable') === 'true'

  if (!itemId) return NextResponse.json({ error: 'Missing item' }, { status: 400 })
  const { data: itemRow } = await supabase.from('handover_pack_items').select('id').eq('id', itemId).is('retired_at', null).single()
  if (!itemRow) return NextResponse.json({ error: 'Unknown or retired checklist item' }, { status: 400 })

  // Marking something N/A is its own path -- no file/link required, just
  // the item and an optional short reason.
  if (markNotApplicable) {
    const { error: naError } = await supabase.from('handover_pack_submissions').upsert({
      pack_record_id: pack.id, item_id: itemId, received: false, not_applicable: true,
      na_reason: notes, na_by: contact.email, na_at: new Date().toISOString(),
    }, { onConflict: 'pack_record_id,item_id' })
    if (naError) return NextResponse.json({ error: naError.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (driveLink && !looksLikeUrl(driveLink)) {
    return NextResponse.json({ error: 'That doesn\'t look like a valid link' }, { status: 400 })
  }
  if (!file && !driveLink) {
    return NextResponse.json({ error: 'Attach a file or a link before submitting' }, { status: 400 })
  }

  let filePath: string | null = null
  let fileName: string | null = null

  if (file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: `That file type isn't allowed. Accepted: ${ALLOWED_EXT.join(', ')}` }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File is too large (20MB max)' }, { status: 400 })
    }
    const clientSlug = contact.client.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const path = `${clientSlug}/${pack.id}/${itemId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage.from('client-uploads').upload(path, buffer, {
      contentType: file.type || 'application/octet-stream', upsert: false,
    })
    if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    filePath = path
    fileName = file.name
  }

  const { error: upsertError } = await supabase.from('handover_pack_submissions').upsert({
    pack_record_id: pack.id, item_id: itemId, received: true, not_applicable: false,
    file_path: filePath, file_name: fileName, drive_link: driveLink, notes,
    submitted_by: contact.email, submitted_at: new Date().toISOString(),
  }, { onConflict: 'pack_record_id,item_id' })
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  // Best-effort Ops notification -- a failure here shouldn't fail the
  // submission itself, which is the part that actually matters.
  try {
    const { data: itemDetail } = await supabase.from('handover_pack_items').select('label').eq('id', itemId).single()
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://abbss-ops-portal.vercel.app'}/api/notify/client-portal-submission`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: contact.client, contactName: contact.name, itemLabel: itemDetail?.label || itemId, fileName, driveLink }),
    })
  } catch {}

  return NextResponse.json({ success: true })
}

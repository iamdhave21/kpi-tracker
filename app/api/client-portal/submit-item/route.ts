import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getServiceSupabase, SESSION_COOKIE } from '@/lib/clientPortalAuth'
import { esc, emailShell, sendMail, FALLBACK_ALERT_EMAIL } from '@/lib/serverMail'
import { safeHttpUrl } from '@/lib/mailRules'

// Vercel rejects request bodies over roughly 4.5 MB before this code ever runs,
// so a higher limit here could never be reached and the client would just see
// an opaque platform error. Cap below that and say why.
const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4MB
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
      return NextResponse.json({ error: 'File is too large (4 MB max). For a larger file, paste a link to it instead.' }, { status: 400 })
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

  // Best-effort Ops notification, sent straight from the server (not through a
  // public endpoint). A failure here must not fail the submission itself.
  try {
    const { data: itemDetail } = await supabase.from('handover_pack_items').select('label').eq('id', itemId).single()
    const link = safeHttpUrl(driveLink)
    const body = `
      <p style="margin:0 0 10px;"><strong>${esc(contact.name)}</strong> at <strong>${esc(contact.client)}</strong> just submitted an item on their onboarding checklist.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Item</td><td style="padding:6px 0;color:#111827;font-weight:600;">${esc(itemDetail?.label || itemId)}</td></tr>
        ${fileName ? `<tr><td style="padding:6px 0;color:#6b7280;">File</td><td style="padding:6px 0;color:#111827;">${esc(fileName)}</td></tr>` : ''}
        ${driveLink ? `<tr><td style="padding:6px 0;color:#6b7280;">Link</td><td style="padding:6px 0;color:#111827;">${link ? `<a href="${esc(link)}">${esc(link)}</a>` : esc(driveLink)}</td></tr>` : ''}
      </table>
      <p style="font-size:13px;color:#6b7280;">Open the Client Portal management screen in the Ops Portal to review it.</p>`
    await sendMail([FALLBACK_ALERT_EMAIL], `Client Portal: ${contact.client} submitted "${itemDetail?.label || itemId}"`, emailShell('Client Portal Update', body))
  } catch {}

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getServiceSupabase, SESSION_COOKIE } from '@/lib/clientPortalAuth'
import { REQUEST_TYPES, REQUEST_LEVELS, REQUEST_PRIORITIES, requiresApproval, parseNaDate, refLabel, typeLabel, levelLabel } from '@/lib/clientRequests'
import { uploadAttachments, slug, alertRecipients } from '@/lib/requestsServer'
import { sendMail, emailShell, esc, PORTAL_URL } from '@/lib/serverMail'

// Everything here is scoped to the caller's OWN client, resolved server-side
// from the verified portal session -- never from anything sent in the request.
// Internal fields (assignee, approvals, internal notes) are never returned.

const CLIENT_FIELDS = 'id, ref_no, type, subject, details, priority, send_to_level, needed_by, target_date, effective_date, status, client_unread, contact_name, attachments, created_at, updated_at'
const MAX_PER_HOUR = 10

export async function GET(req: NextRequest) {
  const contact = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!contact) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const supabase = getServiceSupabase()
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    const { data } = await supabase.from('client_requests').select(CLIENT_FIELDS.replace('details, ', '').replace('attachments, ', ''))
      .eq('client', contact.client).order('created_at', { ascending: false })
    return NextResponse.json({ requests: data || [] })
  }
  const { data: request } = await supabase.from('client_requests').select(CLIENT_FIELDS).eq('id', id).eq('client', contact.client).maybeSingle()
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: messages } = await supabase.from('client_request_messages')
    .select('id, author_type, author_name, body, attachments, created_at').eq('request_id', id).eq('visible_to_client', true).order('created_at')
  return NextResponse.json({ request, messages: messages || [] })
}

export async function POST(req: NextRequest) {
  const contact = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!contact) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const supabase = getServiceSupabase()
  const form = await req.formData()
  const action = form.get('action')?.toString()
  const files = form.getAll('files') as File[]

  // ---- mark a request as read by the client ----
  if (action === 'read') {
    const id = form.get('request_id')?.toString()
    if (id) await supabase.from('client_requests').update({ client_unread: false }).eq('id', id).eq('client', contact.client)
    return NextResponse.json({ success: true })
  }

  // ---- new request ----
  if (action === 'create') {
    const type = form.get('type')?.toString() || ''
    const level = form.get('send_to_level')?.toString() || ''
    const priority = form.get('priority')?.toString() || 'normal'
    const subject = (form.get('subject')?.toString() || '').trim()
    const details = (form.get('details')?.toString() || '').trim()
    if (!REQUEST_TYPES.some(t => t.value === type)) return NextResponse.json({ error: 'Choose what kind of request this is.' }, { status: 400 })
    if (!REQUEST_LEVELS.some(l => l.value === level)) return NextResponse.json({ error: 'Choose who this should go to.' }, { status: 400 })
    if (!(REQUEST_PRIORITIES as readonly string[]).includes(priority)) return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 })
    if (!subject || subject.length > 200) return NextResponse.json({ error: 'Add a short subject (up to 200 characters).' }, { status: 400 })
    if (!details || details.length > 8000) return NextResponse.json({ error: 'Add the details (up to 8,000 characters).' }, { status: 400 })
    const needed = parseNaDate(form.get('needed_by')?.toString())
    const target = parseNaDate(form.get('target_date')?.toString())
    if (!needed.ok) return NextResponse.json({ error: 'Pick a "needed by" date, or choose N/A.' }, { status: 400 })
    if (!target.ok) return NextResponse.json({ error: 'Pick a target date, or choose N/A.' }, { status: 400 })

    // basic spam / runaway guard
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase.from('client_requests').select('id', { count: 'exact', head: true }).eq('contact_id', contact.id).gte('created_at', since)
    if ((count || 0) >= MAX_PER_HOUR) return NextResponse.json({ error: 'You\'ve sent a lot of requests in the last hour. Please wait a bit, or contact us directly.' }, { status: 429 })

    const { data: created, error } = await supabase.from('client_requests').insert({
      client: contact.client, contact_id: contact.id, contact_name: contact.name, contact_email: contact.email,
      type, subject, details, priority, send_to_level: level, needed_by: needed.value, target_date: target.value,
      requires_approval: requiresApproval(type),
    }).select('id, ref_no').single()
    if (error || !created) return NextResponse.json({ error: 'Could not save your request. Please try again.' }, { status: 500 })

    try {
      const attachments = await uploadAttachments(supabase, files, `requests/${slug(contact.client)}/${created.id}`)
      if (attachments.length) await supabase.from('client_requests').update({ attachments }).eq('id', created.id)
    } catch (e) {
      // the request is saved; tell them the files didn't make it rather than losing the whole request
      const msg = e instanceof Error ? e.message : 'Attachments could not be saved.'
      await notifyNew(supabase, created.ref_no, contact, { type, level, priority, subject, needed: needed.value, target: target.value })
      return NextResponse.json({ success: true, id: created.id, warning: `Your request was sent, but the attachments weren't saved: ${msg}` })
    }
    await notifyNew(supabase, created.ref_no, contact, { type, level, priority, subject, needed: needed.value, target: target.value })
    return NextResponse.json({ success: true, id: created.id })
  }

  // ---- client message on an existing request ----
  if (action === 'message') {
    const id = form.get('request_id')?.toString()
    const body = (form.get('body')?.toString() || '').trim()
    if (!id) return NextResponse.json({ error: 'Missing request.' }, { status: 400 })
    if (body.length > 8000) return NextResponse.json({ error: 'That message is too long (8,000 characters max).' }, { status: 400 })
    const { data: r } = await supabase.from('client_requests').select('id, ref_no, client, subject, status, send_to_level, assigned_to').eq('id', id).eq('client', contact.client).maybeSingle()
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (r.status === 'closed') return NextResponse.json({ error: 'This request is closed. Please start a new request.' }, { status: 400 })
    let attachments: any[] = []
    try { attachments = await uploadAttachments(supabase, files, `requests/${slug(contact.client)}/${r.id}`) }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Attachments could not be saved.' }, { status: 400 }) }
    if (!body && attachments.length === 0) return NextResponse.json({ error: 'Write a message or attach a file.' }, { status: 400 })
    await supabase.from('client_request_messages').insert({ request_id: r.id, author_type: 'client', author_name: contact.name, author_email: contact.email, body, attachments, visible_to_client: true })
    await supabase.from('client_requests').update({ staff_attention: true, updated_at: new Date().toISOString() }).eq('id', r.id)
    const to = await alertRecipients(supabase, r.client, r.send_to_level)
    if (r.assigned_to && r.assigned_to.includes('@')) to.push(r.assigned_to)
    await sendMail(to, `New message on ${refLabel(r.ref_no)} — ${r.client}`,
      emailShell('New client message', `<p><strong>${esc(contact.name)}</strong> (${esc(r.client)}) replied on <strong>${esc(refLabel(r.ref_no))}</strong>: ${esc(r.subject)}</p>`, { label: 'Open in the Ops Portal', url: `${PORTAL_URL}/?view=client-requests` }))
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function notifyNew(supabase: any, refNo: number, contact: { name: string, client: string }, r: { type: string, level: string, priority: string, subject: string, needed: string | null, target: string | null }) {
  const to = await alertRecipients(supabase, contact.client, r.level)
  const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">${esc(k)}</td><td style="padding:4px 0;color:#111827;">${esc(v)}</td></tr>`
  await sendMail(to, `[${r.priority === 'urgent' ? 'URGENT ' : ''}Client request] ${refLabel(refNo)} — ${contact.client}: ${typeLabel(r.type)}`,
    emailShell('New client request',
      `<p><strong>${esc(contact.name)}</strong> from <strong>${esc(contact.client)}</strong> sent a request to the <strong>${esc(levelLabel(r.level))}</strong> level.</p>
       <table style="font-size:13px;border-collapse:collapse;margin-top:6px;">${row('Reference', refLabel(refNo))}${row('Type', typeLabel(r.type))}${row('Subject', r.subject)}${row('Priority', r.priority)}${row('Needed by', r.needed || 'NA')}${row('Target date', r.target || 'NA')}</table>`,
      { label: 'Open in the Ops Portal', url: `${PORTAL_URL}/?view=client-requests` }))
}

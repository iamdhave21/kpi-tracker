import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/clientPortalAuth'
import { verifyStaff, Staff } from '@/lib/staffAuth'
import {
  canSeeRequest, allowedManualStatuses, decisionOutcome, sameStaff, statusLabel, refLabel, typeLabel,
  REQUEST_LEVELS, REQUEST_PRIORITIES, Decision, levelLabel,
} from '@/lib/clientRequests'
import { uploadAttachments, signedUrl, allowedPaths, slug, alertRecipients } from '@/lib/requestsServer'
import { sendMail, emailShell, esc, PORTAL_URL } from '@/lib/serverMail'

// One endpoint for the staff inbox. Every call is authenticated with the
// caller's verified Google sign-in (lib/staffAuth.ts), then limited by role:
//   admin / super_admin -> everything
//   Team Lead           -> only requests for clients they support
//   anyone else         -> refused
// JSON body for most actions; multipart for "message" (which carries files).

const now = () => new Date().toISOString()
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
const isAdmin = (s: Staff) => s.role === 'admin' || s.role === 'super_admin'
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
const fmtDate = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
const INBOX_URL = `${PORTAL_URL}/?view=client-requests`

export async function POST(req: NextRequest) {
  const staff = await verifyStaff(req)
  if (!staff) return fail('Please sign in with Google again to use this.', 401)
  if (!isAdmin(staff) && staff.role !== 'Team Lead') return fail('You don\'t have access to client requests.', 403)

  const supabase = getServiceSupabase()
  const isMultipart = (req.headers.get('content-type') || '').includes('multipart/form-data')
  let body: any = {}, files: File[] = []
  if (isMultipart) {
    const form = await req.formData()
    form.forEach((v, k) => { if (k === 'files') files.push(v as File); else body[k] = v.toString() })
  } else {
    body = await req.json().catch(() => ({}))
  }
  const action: string = body.action

  // Loads a request only if this staff member may see it.
  async function load(id: string) {
    if (!id) return null
    const { data } = await supabase.from('client_requests').select('*').eq('id', id).maybeSingle()
    return data && canSeeRequest(staff!.role, staff!.clients, data.client) ? data : null
  }
  const staffLabel = staff.name
  async function emailClient(r: any, line: string) {
    if (!r.contact_email) return
    await sendMail([r.contact_email], `Update on your request ${refLabel(r.ref_no)}`,
      emailShell('Update on your request', `<p>${esc(line)}</p><p style="color:#6b7280;font-size:13px;">${esc(refLabel(r.ref_no))} — ${esc(r.subject)}</p>`, { label: 'Open your Client Portal', url: `${PORTAL_URL}/client-portal` }))
  }
  async function systemNote(requestId: string, text: string) {
    await supabase.from('client_request_messages').insert({ request_id: requestId, author_type: 'system', author_name: 'AB BSS', body: text, visible_to_client: true })
  }

  switch (action) {
    // ---------------- reading ----------------
    case 'list': {
      const { data, error: listErr } = await supabase.from('client_requests').select('*').order('created_at', { ascending: false })
      if (listErr) return fail(listErr.message, 500)
      const visible = (data || []).filter(r => canSeeRequest(staff.role, staff.clients, r.client))
      const ids = visible.map(r => r.id)
      const summary: Record<string, { pending: number, approved: number, declined: number, total: number }> = {}
      if (ids.length) {
        const { data: ap } = await supabase.from('client_request_approvals').select('request_id, status').in('request_id', ids)
        ;(ap || []).forEach((a: any) => {
          const s = summary[a.request_id] ||= { pending: 0, approved: 0, declined: 0, total: 0 }
          s[a.status as Decision] += 1; s.total += 1
        })
      }
      return NextResponse.json({ requests: visible.map(r => ({ ...r, approvals_summary: summary[r.id] || { pending: 0, approved: 0, declined: 0, total: 0 } })), me: { email: staff.email, role: staff.role, name: staff.name } })
    }
    case 'unseen_count': {
      const { data } = await supabase.from('client_requests').select('client, staff_attention, status').eq('staff_attention', true).neq('status', 'closed')
      return NextResponse.json({ count: (data || []).filter(r => canSeeRequest(staff.role, staff.clients, r.client)).length })
    }
    case 'get': {
      const r = await load(body.id)
      if (!r) return fail('Not found', 404)
      const [{ data: messages }, { data: approvals }, { data: receivers }] = await Promise.all([
        supabase.from('client_request_messages').select('*').eq('request_id', r.id).order('created_at'),
        supabase.from('client_request_approvals').select('*').eq('request_id', r.id).order('created_at'),
        supabase.from('client_request_receivers').select('*').eq('request_id', r.id).order('created_at'),
      ])
      return NextResponse.json({ request: r, messages: messages || [], approvals: approvals || [], receivers: receivers || [] })
    }
    case 'file_url': {
      const r = await load(body.id)
      if (!r || !body.path) return fail('Not found', 404)
      const { data: msgs } = await supabase.from('client_request_messages').select('attachments').eq('request_id', r.id)
      if (!allowedPaths(r, (msgs || []) as any, false).has(body.path)) return fail('Not found', 404)
      const url = await signedUrl(supabase, body.path)
      return url ? NextResponse.json({ url }) : fail('Could not open the file', 500)
    }

    // ---------------- replying ----------------
    case 'message': {
      const r = await load(body.id)
      if (!r) return fail('Not found', 404)
      const text = (body.body || '').trim()
      const internal = body.internal === 'true'
      if (text.length > 8000) return fail('That message is too long (8,000 characters max).')
      let attachments: any[] = []
      try { attachments = await uploadAttachments(supabase, files, `requests/${slug(r.client)}/${r.id}`) }
      catch (e) { return fail(e instanceof Error ? e.message : 'Attachments could not be saved.') }
      if (!text && attachments.length === 0) return fail('Write a message or attach a file.')
      await supabase.from('client_request_messages').insert({
        request_id: r.id, author_type: 'staff', author_name: staffLabel, author_email: staff.email, body: text, attachments, visible_to_client: !internal,
      })
      if (!internal) {
        await supabase.from('client_requests').update({ client_unread: true, staff_attention: false, updated_at: now() }).eq('id', r.id)
        await emailClient(r, 'You have a new reply from AB BSS.')
      }
      return NextResponse.json({ success: true })
    }

    // ---------------- status, owner, dates ----------------
    case 'update': {
      const r = await load(body.id)
      if (!r) return fail('Not found', 404)
      const patch: any = { updated_at: now() }
      const notes: string[] = []
      if (body.status !== undefined && body.status !== r.status) {
        if (!allowedManualStatuses(r).includes(body.status)) {
          return fail(r.requires_approval
            ? 'For this type of request, Approved and Declined come from the approvers\' decisions, and it can\'t be marked Completed until it\'s approved.'
            : 'That status can\'t be set for this type of request.')
        }
        patch.status = body.status
        patch.closed_at = body.status === 'closed' ? now() : null
        patch.staff_attention = false
        patch.client_unread = true
        notes.push(`Status changed to ${statusLabel(body.status)}.`)
      }
      if (body.effective_date !== undefined) {
        const v = body.effective_date ? String(body.effective_date) : null
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail('Invalid effectivity date.')
        if (v !== r.effective_date) {
          patch.effective_date = v; patch.client_unread = true
          notes.push(v ? `Effectivity date set to ${fmtDate(v)}.` : 'Effectivity date cleared.')
        }
      }
      if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to ? String(body.assigned_to).slice(0, 200) : null
      if (body.send_to_level !== undefined) {
        if (!REQUEST_LEVELS.some(l => l.value === body.send_to_level)) return fail('Invalid level.')
        patch.send_to_level = body.send_to_level
      }
      if (body.priority !== undefined) {
        if (!(REQUEST_PRIORITIES as readonly string[]).includes(body.priority)) return fail('Invalid priority.')
        patch.priority = body.priority
      }
      await supabase.from('client_requests').update(patch).eq('id', r.id)
      if (patch.send_to_level && patch.send_to_level !== r.send_to_level) {
        const to = await alertRecipients(supabase, r.client, patch.send_to_level)
        await sendMail(to, `Client request moved to your level: ${refLabel(r.ref_no)} — ${r.client}`,
          emailShell('A client request was moved to you', `<p>${esc(staff.name)} moved a <strong>${esc(typeLabel(r.type))}</strong> from <strong>${esc(r.client)}</strong> to the <strong>${esc(levelLabel(patch.send_to_level))}</strong> level: ${esc(r.subject)}</p>`, { label: 'Open in the Ops Portal', url: INBOX_URL }))
      }
      for (const n of notes) await systemNote(r.id, n)
      if (notes.length) await emailClient(r, notes.join(' '))
      return NextResponse.json({ success: true })
    }

    // ---------------- approvals ----------------
    case 'add_approver': {
      if (!isAdmin(staff)) return fail('Only an admin can choose approvers.', 403)
      const r = await load(body.id)
      if (!r) return fail('Not found', 404)
      if (!r.requires_approval) return fail('This type of request only needs acknowledgment, not approval.')
      if (['approved', 'declined', 'completed', 'closed'].includes(r.status)) return fail('This request has already been decided.')
      const email = String(body.email || '').trim().toLowerCase(), name = String(body.name || '').trim()
      if (!name || !isEmail(email)) return fail('Pick a person with an email address.')
      const { data: existing } = await supabase.from('client_request_approvals').select('approver_email').eq('request_id', r.id)
      if ((existing || []).some((a: any) => sameStaff(a.approver_email, email))) return fail('They\'re already an approver on this request.')
      await supabase.from('client_request_approvals').insert({ request_id: r.id, approver_name: name, approver_email: email })
      if (r.status === 'new' || r.status === 'acknowledged') await supabase.from('client_requests').update({ status: 'in_review', updated_at: now() }).eq('id', r.id)
      await sendMail([email], `Your approval is needed: ${refLabel(r.ref_no)} — ${r.client}`,
        emailShell('Approval needed', `<p>You've been asked to approve a <strong>${esc(typeLabel(r.type))}</strong> from <strong>${esc(r.client)}</strong>: ${esc(r.subject)}</p>`, { label: 'Review and decide', url: INBOX_URL }))
      return NextResponse.json({ success: true })
    }
    case 'remove_approver': {
      if (!isAdmin(staff)) return fail('Only an admin can change approvers.', 403)
      const { data: ap } = await supabase.from('client_request_approvals').select('*').eq('id', body.approval_id).maybeSingle()
      if (!ap) return fail('Not found', 404)
      const r = await load(ap.request_id)
      if (!r) return fail('Not found', 404)
      if (ap.status !== 'pending') return fail('A decision has already been made, so this approver can\'t be removed.')
      await supabase.from('client_request_approvals').delete().eq('id', ap.id)
      await applyOutcome(r)
      return NextResponse.json({ success: true })
    }
    case 'decide': {
      const { data: ap } = await supabase.from('client_request_approvals').select('*').eq('id', body.approval_id).maybeSingle()
      if (!ap) return fail('Not found', 404)
      const r = await load(ap.request_id)
      if (!r) return fail('Not found', 404)
      if (!sameStaff(ap.approver_email, staff.email) && staff.role !== 'super_admin') return fail('Only the named approver can decide this.', 403)
      if (ap.status !== 'pending') return fail('A decision has already been recorded.')
      if (['completed', 'closed'].includes(r.status)) return fail('This request is already finished.')
      if (body.decision !== 'approved' && body.decision !== 'declined') return fail('Invalid decision.')
      await supabase.from('client_request_approvals').update({ status: body.decision, comment: String(body.comment || '').slice(0, 1000) || null, decided_at: now() }).eq('id', ap.id)
      await applyOutcome(r)
      return NextResponse.json({ success: true })
    }

    // ---------------- receivers ----------------
    case 'add_receiver': {
      const r = await load(body.id)
      if (!r) return fail('Not found', 404)
      const email = String(body.email || '').trim().toLowerCase(), name = String(body.name || '').trim()
      if (!name || !isEmail(email)) return fail('Pick a person with an email address.')
      const { data: existing } = await supabase.from('client_request_receivers').select('receiver_email').eq('request_id', r.id)
      if ((existing || []).some((x: any) => sameStaff(x.receiver_email, email))) return fail('They\'re already a receiver on this request.')
      await supabase.from('client_request_receivers').insert({ request_id: r.id, receiver_name: name, receiver_email: email })
      await sendMail([email], `For your information: ${refLabel(r.ref_no)} — ${r.client}`,
        emailShell('You\'ve been added as a receiver', `<p>A <strong>${esc(typeLabel(r.type))}</strong> from <strong>${esc(r.client)}</strong> affects you: ${esc(r.subject)}. Please open it and acknowledge.</p>`, { label: 'Open the request', url: INBOX_URL }))
      return NextResponse.json({ success: true })
    }
    case 'remove_receiver': {
      if (!isAdmin(staff)) return fail('Only an admin can remove a receiver.', 403)
      const { data: rc } = await supabase.from('client_request_receivers').select('request_id').eq('id', body.receiver_id).maybeSingle()
      if (!rc || !(await load(rc.request_id))) return fail('Not found', 404)
      await supabase.from('client_request_receivers').delete().eq('id', body.receiver_id)
      return NextResponse.json({ success: true })
    }
    case 'ack_receiver': {
      const { data: rc } = await supabase.from('client_request_receivers').select('*').eq('id', body.receiver_id).maybeSingle()
      if (!rc || !(await load(rc.request_id))) return fail('Not found', 404)
      if (!sameStaff(rc.receiver_email, staff.email)) return fail('Only the named receiver can acknowledge this.', 403)
      await supabase.from('client_request_receivers').update({ acknowledged_at: now() }).eq('id', rc.id)
      return NextResponse.json({ success: true })
    }

    // ---------------- alert routing (admin only) ----------------
    case 'routing_list': {
      if (!isAdmin(staff)) return fail('Admins only.', 403)
      const { data } = await supabase.from('client_comm_routing').select('*').order('level').order('client')
      return NextResponse.json({ routing: data || [] })
    }
    case 'routing_set': {
      if (!isAdmin(staff)) return fail('Admins only.', 403)
      if (!REQUEST_LEVELS.some(l => l.value === body.level)) return fail('Invalid level.')
      const recipients = String(body.recipients || '').split(/[,;\s]+/).map((x: string) => x.trim().toLowerCase()).filter(isEmail)
      if (recipients.length === 0) return fail('Enter at least one valid email address.')
      const client = body.client ? String(body.client).trim() : null
      const { data: rows } = await supabase.from('client_comm_routing').select('id, client').eq('level', body.level)
      const existing = (rows || []).find((x: any) => (x.client || '').toLowerCase() === (client || '').toLowerCase())
      const payload = { recipients: recipients.join(', '), updated_by: staff.email, updated_at: now() }
      const { error } = existing
        ? await supabase.from('client_comm_routing').update(payload).eq('id', existing.id)
        : await supabase.from('client_comm_routing').insert({ client, level: body.level, ...payload })
      return error ? fail(error.message, 500) : NextResponse.json({ success: true })
    }
    case 'routing_delete': {
      if (!isAdmin(staff)) return fail('Admins only.', 403)
      await supabase.from('client_comm_routing').delete().eq('id', body.id)
      return NextResponse.json({ success: true })
    }
  }
  return fail('Unknown action')

  // After any approval change: all approved -> Approved; any declined -> Declined.
  async function applyOutcome(r: any) {
    const { data: aps } = await supabase.from('client_request_approvals').select('status').eq('request_id', r.id)
    const outcome = decisionOutcome((aps || []).map((a: any) => a.status as Decision))
    if (outcome === 'approved' && r.status !== 'approved') {
      await supabase.from('client_requests').update({ status: 'approved', approved_at: now(), staff_attention: false, client_unread: true, updated_at: now() }).eq('id', r.id)
      await systemNote(r.id, 'Your request has been approved.')
      await emailClient(r, 'Your request has been approved.')
    } else if (outcome === 'declined' && r.status !== 'declined') {
      await supabase.from('client_requests').update({ status: 'declined', staff_attention: false, client_unread: true, updated_at: now() }).eq('id', r.id)
      await systemNote(r.id, 'Your request was not approved.')
      await emailClient(r, 'Your request was not approved. We\'ll follow up with you shortly.')
    }
  }
}

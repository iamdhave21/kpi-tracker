import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/clientPortalAuth'
import { verifyStaff, Staff } from '@/lib/staffAuth'
import {
  sameStaff, canAuthor, canManageDoc, canSeeDoc, canSeeAllVersions, isReceiver, ackStats, approvalOutcome,
  approverProblem, nextVersionNo, validCode, sanitizeCards, cardPaths, SOP_TYPES, Card, Attachment, Decision,
  canRetireDoc, proofProblem, cardsChanged, cardHasContent, publicProof, proofMissing, isAdminRole, PROOF_METHODS,
} from '@/lib/sop'
import { uploadAttachments, signedUrl, BUCKET } from '@/lib/requestsServer'
import { sendMail, emailShell, esc, PORTAL_URL } from '@/lib/serverMail'

// One endpoint for the SOP and LWI Repository. Every call is authenticated
// with the caller's verified Google sign-in (verifyStaff). Any signed-in staff
// member may call it (agents need it to read and acknowledge), and each action
// then applies the real rules in lib/sop.ts:
//   author/manager -> admin, super_admin, or the Team Lead who created it
//   approver       -> someone named on that version
//   everyone else  -> read the CURRENT approved version if they are a receiver
// The tables have RLS on with no policies: this route is the only way in.

class UserError extends Error { status: number; constructor(m: string, status = 400) { super(m); this.status = status } }
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
const likeEsc = (s: string) => s.replace(/[\\%_]/g, '\\$&')
const lc = (s: string | null | undefined) => (s || '').trim().toLowerCase()
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
const isYmd = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime())
// Today's date in the Philippines (the server runs in UTC).
const phToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
const LINK = `${PORTAL_URL}/?view=sop-repository`
const VERSION_LIST_COLS = 'id, sop_id, version_no, status, approval_source, summary, receiver_mode, effectivity_date, next_review_date, approval_date, created_at, submitted_at, approved_at'

export async function POST(req: NextRequest) {
  const staff = await verifyStaff(req)
  if (!staff) return fail('Please sign in with Google again to use this.', 401)

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

  try {
    return await handle(action, body, files, staff, supabase)
  } catch (e: any) {
    if (e instanceof UserError) return fail(e.message, e.status)
    console.error('sop route error:', action, e)
    return fail('Something went wrong. Please try again.', 500)
  }
}

async function handle(action: string, body: any, files: File[], staff: Staff, supabase: any) {
  const me = staff.email
  const role = staff.role

  // ---------- small data helpers ----------
  // Admins are told the real database reason (for example a table or column that the SQL
  // has not created yet); everyone else gets the plain message. Staff-only tool, admin-only detail.
  const ok = <T,>(res: { data: T, error: any }, msg = 'Database error'): T => {
    if (res.error) {
      console.error(msg, res.error)
      throw new UserError(isAdminRole(role) && res.error.message ? `${msg}: ${res.error.message}` : msg, 500)
    }
    return res.data
  }

  let empCache: { email: string, name: string }[] | null = null
  async function activeEmployees() {
    if (!empCache) {
      const { data } = await supabase.from('employees').select('name, email').eq('active', true)
      empCache = (data || []).filter((e: any) => e.email).map((e: any) => ({ email: lc(e.email), name: e.name || e.email }))
    }
    return empCache!
  }
  async function nameFor(email: string): Promise<string> {
    if (sameStaff(email, me)) return staff.name
    const emps = await activeEmployees()
    return emps.find(e => sameStaff(e.email, email))?.name || email
  }
  // Role of an app_users account by email (local part), or null if none / inactive.
  async function roleOf(email: string): Promise<string | null> {
    const local = lc(email).split('@')[0]
    if (!local) return null
    const { data } = await supabase.from('app_users').select('email, role, active').ilike('email', `${likeEsc(local)}@%`).eq('active', true)
    return (data || []).find((u: any) => lc(u.email).split('@')[0] === local)?.role || null
  }

  async function loadDoc(id: string) {
    if (!id) throw new UserError('Not found', 404)
    const { data } = await supabase.from('sop_documents').select('*').eq('id', id).maybeSingle()
    if (!data) throw new UserError('Not found', 404)
    return data
  }
  async function loadVersion(id: string) {
    if (!id) throw new UserError('Not found', 404)
    const { data } = await supabase.from('sop_versions').select('*').eq('id', id).maybeSingle()
    if (!data) throw new UserError('Not found', 404)
    return data
  }
  async function approvalsOf(versionId: string) {
    return ok(await supabase.from('sop_approvals').select('*').eq('version_id', versionId).order('created_at')) as any[]
  }
  async function receiversOf(versionId: string): Promise<string[]> {
    return (ok(await supabase.from('sop_receivers').select('email').eq('version_id', versionId)) as any[]).map(r => r.email)
  }
  async function acksOf(versionId: string): Promise<string[]> {
    return (ok(await supabase.from('sop_acks').select('email').eq('version_id', versionId)) as any[]).map(r => r.email)
  }

  // Everything needed to decide what this caller may do with a document.
  async function contextFor(doc: any) {
    const versions = ok(await supabase.from('sop_versions').select('id, status, receiver_mode').eq('sop_id', doc.id)) as any[]
    // Approver only counts once the version has left draft, so picking someone as an approver doesn't leak a draft early.
    const submitted = versions.filter(v => v.status !== 'draft').map(v => v.id)
    const appr = submitted.length ? ok(await supabase.from('sop_approvals').select('approver_email, version_id').in('version_id', submitted)) as any[] : []
    const isApprover = appr.some(a => sameStaff(a.approver_email, me))
    const current = versions.find(v => v.id === doc.current_version_id) || null
    const selected = current && current.receiver_mode === 'selected' ? await receiversOf(current.id) : []
    return {
      isApprover, current, selected,
      vctx: { role, email: me, clients: staff.clients, isApprover, isReceiver: current ? isReceiver(current.receiver_mode, selected, me) : false, hasCurrentVersion: !!current },
    }
  }
  async function seeDoc(id: string) {
    const doc = await loadDoc(id)
    const c = await contextFor(doc)
    if (!canSeeDoc(doc, c.vctx)) throw new UserError('Not found', 404)
    return { doc, c }
  }
  async function manageDoc(id: string) {
    const doc = await loadDoc(id)
    if (!canManageDoc(doc, role, me, staff.clients)) throw new UserError('You don\'t have permission to change this document.', 403)
    return doc
  }

  async function removeFiles(paths: string[]) { if (paths.length) await supabase.storage.from(BUCKET).remove(paths) }

  const newCardId = () => 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  async function logEdit(sopId: string, versionId: string | null, note: string, before: Card[]) {
    ok(await supabase.from('sop_edits').insert({ sop_id: sopId, version_id: versionId, note, cards_before: before, edited_by: me, edited_by_name: staff.name }))
  }

  // Makes a version the live one: the previous live version is superseded,
  // receivers are asked to acknowledge, and the author is told.
  async function makeCurrent(doc: any, v: any, proof: any | null) {
    if (doc.current_version_id && doc.current_version_id !== v.id) {
      await supabase.from('sop_versions').update({ status: 'superseded' }).eq('id', doc.current_version_id)
    }
    ok(await supabase.from('sop_versions').update({ status: 'approved', approval_date: phToday(), approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', v.id))
    ok(await supabase.from('sop_documents').update({ status: 'active', current_version_id: v.id, updated_at: new Date().toISOString() }).eq('id', doc.id))
    const emps = await activeEmployees()
    const recipients = v.receiver_mode === 'all' ? emps.map(e => e.email) : await receiversOf(v.id)
    const effective = v.effectivity_date ? ` Effective ${esc(v.effectivity_date)}.` : ''
    const by = proof ? `<p style="color:#6b7280;">Approved by ${esc(proof.approved_by_name)}${proof.approved_by_role ? ' (' + esc(proof.approved_by_role) + ')' : ''}, ${esc(proof.approved_on)}.</p>` : ''
    await sendMail(recipients.slice(0, 300), `Please acknowledge: ${doc.code} v${v.version_no}`,
      emailShell('New or updated document to acknowledge', `<p><b>${esc(doc.code)} — ${esc(doc.title)}</b> (version ${v.version_no}) is approved.${effective}</p>${v.summary ? `<p style="color:#6b7280;">What changed: ${esc(v.summary)}</p>` : ''}${by}<p>Please read it and acknowledge in the portal.</p>`, { label: 'Open the SOP Repository', url: LINK }))
    if (v.created_by && !sameStaff(v.created_by, me)) {
      await sendMail([v.created_by], `Approved: ${doc.code} v${v.version_no}`,
        emailShell('Your document was approved', `<p><b>${esc(doc.code)} — ${esc(doc.title)}</b> (v${v.version_no}) is now active and receivers have been asked to acknowledge it.</p>`, { label: 'Open the SOP Repository', url: LINK }))
    }
  }

  // Starts the next draft version as a copy of the live one. Files are COPIED
  // so deleting a file in the new draft can never remove it from the live version.
  async function createNextVersion(doc: any, opts: { summary?: string, effectivity_date?: string | null }): Promise<string> {
    if (doc.status !== 'active' || !doc.current_version_id) throw new UserError('Only an active document can get a new version.')
    const all = ok(await supabase.from('sop_versions').select('id, version_no, status').eq('sop_id', doc.id)) as any[]
    if (all.some(v => ['draft', 'pending_approval', 'declined'].includes(v.status))) throw new UserError('There is already a version in progress. Finish or reopen it first.')
    const cur = await loadVersion(doc.current_version_id)
    const newNo = nextVersionNo(all.map(v => v.version_no))
    const { data: created, error } = await supabase.from('sop_versions').insert({
      sop_id: doc.id, version_no: newNo, created_by: me, receiver_mode: cur.receiver_mode, supersedes: `${doc.code} v${cur.version_no}`,
      summary: opts.summary || null, next_review_date: null, effectivity_date: opts.effectivity_date || null,
    }).select('id').single()
    if (error || !created) throw new UserError('Could not start a new version.', 500)
    const copied: string[] = []
    const cards: Card[] = []
    for (const c of (cur.cards || []) as Card[]) {
      const atts: Attachment[] = []
      for (const a of c.attachments || []) {
        const dest: string = `sop/${doc.id}/${created.id}/${Date.now()}-${atts.length}-${a.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: cErr } = await supabase.storage.from(BUCKET).copy(a.path, dest)
        if (cErr) { await removeFiles(copied); await supabase.from('sop_versions').delete().eq('id', created.id); throw new UserError('Could not copy a file to the new version.', 500) }
        copied.push(dest); atts.push({ ...a, path: dest })
      }
      cards.push({ ...c, attachments: atts })
    }
    ok(await supabase.from('sop_versions').update({ cards }).eq('id', created.id))
    const sel = cur.receiver_mode === 'selected' ? await receiversOf(cur.id) : []
    if (sel.length) { const emps = await activeEmployees(); ok(await supabase.from('sop_receivers').insert(sel.map(e => ({ version_id: created.id, email: e, name: emps.find(x => sameStaff(x.email, e))?.name || e })))) }
    const prev = await approvalsOf(cur.id)
    if (prev.length) ok(await supabase.from('sop_approvals').insert(prev.map(a => ({ version_id: created.id, approver_email: a.approver_email, approver_name: a.approver_name }))))
    return created.id
  }

  // Validates and inserts a new document row (shared by "create" and "quick_add").
  async function newDocRow(b: any) {
    if (!canAuthor(role)) throw new UserError('Only Admins and Team Leads can create documents.', 403)
    const code = String(b.code || '').trim()
    const title = String(b.title || '').trim()
    if (!validCode(code)) throw new UserError('Use a document number of 2 to 40 characters: letters, numbers, dots, dashes (for example OPS-SOP-001).')
    if (!title) throw new UserError('Please enter a title.')
    if (!(SOP_TYPES as readonly string[]).includes(b.doc_type)) throw new UserError('Choose SOP or LWI.')
    const ownerEmail = b.owner_email && isEmail(String(b.owner_email)) ? lc(b.owner_email) : me
    const { data: dupe } = await supabase.from('sop_documents').select('id').ilike('code', likeEsc(code)).maybeSingle()
    if (dupe) throw new UserError(`The document number ${code} is already used.`)
    const { data: doc, error } = await supabase.from('sop_documents').insert({
      code, title, doc_type: b.doc_type, department: b.department || null, client: b.client || null,
      owner_email: ownerEmail, owner_name: await nameFor(ownerEmail), created_by: me, created_by_name: staff.name,
    }).select('*').single()
    if (error || !doc) { console.error(error); throw new UserError('Could not create the document.', 500) }
    return doc
  }

  async function proofRows(versionIds: string[]) {
    if (versionIds.length === 0) return [] as any[]
    return ok(await supabase.from('sop_approval_proofs').select('*').in('version_id', versionIds).order('created_at')) as any[]
  }

  switch (action) {
    // ---------------- reading ----------------
    case 'list': {
      const docs = ok(await supabase.from('sop_documents').select('*').order('code')) as any[]
      const vers = ok(await supabase.from('sop_versions').select(VERSION_LIST_COLS).order('version_no')) as any[]
      const appr = ok(await supabase.from('sop_approvals').select('version_id, approver_email, approver_name, decision')) as any[]
      const proofsAll = ok(await supabase.from('sop_approval_proofs').select('version_id, approved_by_name, attachments')) as any[]
      const recv = ok(await supabase.from('sop_receivers').select('version_id, email')) as any[]
      const acks = ok(await supabase.from('sop_acks').select('version_id, email')) as any[]
      const emps = await activeEmployees()
      const vById = new Map(vers.map(v => [v.id, v]))
      const out: any[] = []
      for (const d of docs) {
        const dv = vers.filter(v => v.sop_id === d.id)
        const dvIds = new Set(dv.map(v => v.id))
        const submittedIds = new Set(dv.filter(v => v.status !== 'draft').map(v => v.id))
        const isApprover = appr.some(a => submittedIds.has(a.version_id) && sameStaff(a.approver_email, me))
        const cur = d.current_version_id ? vById.get(d.current_version_id) : null
        const selected = cur && cur.receiver_mode === 'selected' ? recv.filter(r => r.version_id === cur.id).map(r => r.email) : []
        const vctx = { role, email: me, clients: staff.clients, isApprover, isReceiver: cur ? isReceiver(cur.receiver_mode, selected, me) : false, hasCurrentVersion: !!cur }
        if (!canSeeDoc(d, vctx)) continue
        const manager = canSeeAllVersions(d, vctx)
        const curAcked = cur ? acks.filter(a => a.version_id === cur.id).map(a => a.email) : []
        const latest = dv.length ? dv[dv.length - 1] : null
        const awaitingMe = appr.some(a => dvIds.has(a.version_id) && vById.get(a.version_id)?.status === 'pending_approval' && a.decision === 'pending' && sameStaff(a.approver_email, me))
        out.push({
          id: d.id, code: d.code, title: d.title, doc_type: d.doc_type, department: d.department, client: d.client,
          owner_name: d.owner_name, status: d.status, created_by: d.created_by, added_by_name: d.created_by_name, updated_at: d.updated_at,
          approved_by: cur ? (cur.approval_source === 'external'
            ? Array.from(new Set(proofsAll.filter(p => p.version_id === cur.id).map(p => p.approved_by_name))).join(', ') || null
            : appr.filter(a => a.version_id === cur.id && a.decision === 'approved').map(a => a.approver_name || a.approver_email).join(', ') || null) : null,
          approval_source: cur ? cur.approval_source : null,
          proof_missing: manager && cur ? proofMissing(cur, proofsAll.filter(p => p.version_id === cur.id)) : false,
          current: cur ? { id: cur.id, version_no: cur.version_no, effectivity_date: cur.effectivity_date, next_review_date: cur.next_review_date, approval_date: cur.approval_date, receiver_mode: cur.receiver_mode } : null,
          needs_my_ack: !!cur && d.status === 'active' && vctx.isReceiver && !curAcked.some(a => sameStaff(a, me)),
          awaiting_my_approval: awaitingMe,
          can_manage: canManageDoc(d, role, me, staff.clients),
          // Drafts, in-flight versions and acknowledgment totals are for managers only.
          latest: manager && latest ? { id: latest.id, version_no: latest.version_no, status: latest.status } : null,
          acks: manager && cur ? (({ expected, acked }) => ({ expected, acked }))(ackStats(cur.receiver_mode, emps.map(e => e.email), selected, curAcked)) : null,
        })
      }
      return NextResponse.json({ docs: out, me: { email: me, role, can_author: canAuthor(role) } })
    }

    case 'get': {
      const { doc, c } = await seeDoc(body.id)
      const manager = canSeeAllVersions(doc, c.vctx)
      let versions = ok(await supabase.from('sop_versions').select('*').eq('sop_id', doc.id).order('version_no', { ascending: false })) as any[]
      if (!manager) versions = versions.filter(v => v.id === doc.current_version_id)
      const outVersions: any[] = []
      for (const v of versions) {
        const item: any = { ...v }
        if (manager) {
          item.approvals = (await approvalsOf(v.id)).map(a => ({ approver_email: a.approver_email, approver_name: a.approver_name, decision: a.decision, comment: a.comment, decided_at: a.decided_at }))
          item.receivers = v.receiver_mode === 'selected' ? (await receiversOf(v.id)) : []
        }
        outVersions.push(item)
      }
      let acks: any = null
      const cur = versions.find(v => v.id === doc.current_version_id)
      if (cur) {
        const acked = await acksOf(cur.id)
        const selected = cur.receiver_mode === 'selected' ? await receiversOf(cur.id) : []
        const emps = await activeEmployees()
        const stats = ackStats(cur.receiver_mode, emps.map(e => e.email), selected, acked)
        acks = {
          my_acked: acked.some(a => sameStaff(a, me)), i_am_receiver: isReceiver(cur.receiver_mode, selected, me),
          ...(manager ? { expected: stats.expected, acked: stats.acked, pending: stats.pending.map(e => ({ email: e, name: emps.find(x => sameStaff(x.email, e))?.name || e })) } : {}),
        }
      }
      // Approval proof: managers get everything; readers only who / when / how.
      const proofs = await proofRows(outVersions.map(v => v.id))
      for (const v of outVersions) {
        const mine = proofs.filter(p => p.version_id === v.id)
        v.proofs = manager ? mine : mine.map(publicProof)
      }
      const curOut = outVersions.find(v => v.id === doc.current_version_id)
      const changesAll = ok(await supabase.from('sop_changes').select('*').eq('sop_id', doc.id).order('created_at', { ascending: false })) as any[]
      const liveStatuses = new Set(['approved', 'superseded'])
      const verById = new Map((ok(await supabase.from('sop_versions').select('id, version_no, status').eq('sop_id', doc.id)) as any[]).map(v => [v.id, v]))
      const allProofs = manager ? proofs : await proofRows(Array.from(verById.keys()) as string[])
      const timeline = changesAll
        .filter(c => manager || liveStatuses.has(verById.get(c.version_id)?.status))
        .map(c => {
          const base: any = {
            ...c, version_no: verById.get(c.version_id)?.version_no, version_status: verById.get(c.version_id)?.status,
            approved: allProofs.filter(p => p.version_id === c.version_id).map(publicProof),
          }
          if (!manager) { delete base.previous_text; delete base.request_ref }   // readers: what, why, who approved, when
          return base
        })
      const edits = manager ? ok(await supabase.from('sop_edits').select('id, version_id, note, edited_by_name, created_at').eq('sop_id', doc.id).order('created_at', { ascending: false }).limit(100)) as any[] : []
      return NextResponse.json({
        proof_missing: manager && curOut ? proofMissing(curOut, curOut.proofs || []) : false,
        changes: timeline, edits,
        doc: { ...doc }, versions: outVersions, acks, can_manage: canManageDoc(doc, role, me, staff.clients), is_manager_view: manager,
      })
    }

    // People pickers for authors: who can approve, who can be a receiver.
    case 'people': {
      if (!canAuthor(role)) throw new UserError('Not allowed', 403)
      const users = ok(await supabase.from('app_users').select('email, role, display_name, username').eq('active', true).in('role', ['admin', 'super_admin', 'Team Lead'])) as any[]
      const emps = await activeEmployees()
      const approvers = users.filter(u => u.email).map(u => ({
        email: lc(u.email), role: u.role, name: emps.find(e => sameStaff(e.email, u.email))?.name || u.display_name || u.username || u.email,
      })).sort((a, b) => a.name.localeCompare(b.name))
      return NextResponse.json({ approvers, receivers: emps.slice().sort((a, b) => a.name.localeCompare(b.name)) })
    }

    case 'file_url': {
      const { doc, c } = await seeDoc(body.id)
      const v = await loadVersion(body.version_id)
      if (v.sop_id !== doc.id || !body.path) throw new UserError('Not found', 404)
      // Non-managers may only open files of the current approved version.
      if (!canSeeAllVersions(doc, c.vctx) && v.id !== doc.current_version_id) throw new UserError('Not found', 404)
      if (!cardPaths((v.cards || []) as Card[]).includes(body.path)) throw new UserError('Not found', 404)
      const url = await signedUrl(supabase, body.path)
      return url ? NextResponse.json({ url }) : fail('Could not open the file', 500)
    }

    // ---------------- creating and editing ----------------
    case 'create': {
      const doc = await newDocRow(body)
      const { data: ver, error: vErr } = await supabase.from('sop_versions').insert({ sop_id: doc.id, version_no: 1, created_by: me }).select('id').single()
      if (vErr || !ver) { await supabase.from('sop_documents').delete().eq('id', doc.id); throw new UserError('Could not create the document.', 500) }
      return NextResponse.json({ id: doc.id, version_id: ver.id })
    }

    case 'update_meta': {
      const doc = await manageDoc(body.id)
      if (doc.status === 'retired') throw new UserError('A retired document can\'t be edited.')
      const patch: any = { updated_at: new Date().toISOString() }
      if (body.title !== undefined) { const t = String(body.title).trim(); if (!t) throw new UserError('Please enter a title.'); patch.title = t }
      if (body.doc_type !== undefined) { if (!(SOP_TYPES as readonly string[]).includes(body.doc_type)) throw new UserError('Choose SOP or LWI.'); patch.doc_type = body.doc_type }
      if (body.department !== undefined) patch.department = body.department || null
      if (body.client !== undefined) patch.client = body.client || null
      if (body.owner_email !== undefined && isEmail(String(body.owner_email))) { patch.owner_email = lc(body.owner_email); patch.owner_name = await nameFor(body.owner_email) }
      ok(await supabase.from('sop_documents').update(patch).eq('id', doc.id))
      return NextResponse.json({ ok: true })
    }

    case 'save_version': {
      const v = await loadVersion(body.version_id)
      const doc = await manageDoc(v.sop_id)
      if (v.status !== 'draft') throw new UserError('Only a draft can be edited. Reopen it first.')
      const patch: any = { updated_at: new Date().toISOString() }
      if (body.summary !== undefined) patch.summary = String(body.summary).slice(0, 4000) || null
      if (body.supersedes !== undefined) patch.supersedes = String(body.supersedes).slice(0, 300) || null
      for (const f of ['effectivity_date', 'next_review_date'] as const) {
        if (body[f] !== undefined) { if (body[f] && !isYmd(body[f])) throw new UserError('Use a valid date.'); patch[f] = body[f] || null }
      }
      if (body.receiver_mode !== undefined) { if (!['all', 'selected'].includes(body.receiver_mode)) throw new UserError('Invalid receiver option.'); patch.receiver_mode = body.receiver_mode }
      if (body.cards !== undefined) {
        const before = (v.cards || []) as Card[]
        const next = sanitizeCards(body.cards, before)
        patch.cards = next
        const keep = new Set(cardPaths(next))
        await removeFiles(cardPaths(before).filter(p => !keep.has(p)))   // files of deleted cards
      }
      ok(await supabase.from('sop_versions').update(patch).eq('id', v.id))

      const mode = patch.receiver_mode || v.receiver_mode
      if (body.receivers !== undefined || body.receiver_mode !== undefined) {
        await supabase.from('sop_receivers').delete().eq('version_id', v.id)
        if (mode === 'selected') {
          const emps = await activeEmployees()
          const list = (Array.isArray(body.receivers) ? body.receivers : []).map((e: any) => lc(String(e))).filter(isEmail)
          const rows = list.filter((e: string, i: number) => list.findIndex((x: string) => sameStaff(x, e)) === i && emps.some(x => sameStaff(x.email, e)))
            .map((e: string) => ({ version_id: v.id, email: e, name: emps.find(x => sameStaff(x.email, e))?.name || e }))
          if (rows.length) ok(await supabase.from('sop_receivers').insert(rows))
        }
      }
      if (body.approvers !== undefined) {
        const list = (Array.isArray(body.approvers) ? body.approvers : []).map((e: any) => lc(String(e))).filter(isEmail)
        const uniq = list.filter((e: string, i: number) => list.findIndex((x: string) => sameStaff(x, e)) === i)
        await supabase.from('sop_approvals').delete().eq('version_id', v.id)
        const rows = []
        for (const e of uniq) rows.push({ version_id: v.id, approver_email: e, approver_name: await nameFor(e) })
        if (rows.length) ok(await supabase.from('sop_approvals').insert(rows))
      }
      await supabase.from('sop_documents').update({ updated_at: new Date().toISOString() }).eq('id', doc.id)
      return NextResponse.json({ ok: true })
    }

    // ---------------- files (private bucket) ----------------
    case 'add_file': {
      const v = await loadVersion(body.version_id)
      const doc = await manageDoc(v.sop_id)
      const minor = body.minor === 'true' || body.minor === true
      const live = minor && doc.status === 'active' && doc.current_version_id === v.id && v.status === 'approved'
      if (v.status !== 'draft' && !live) throw new UserError('Only a draft can be edited. Reopen it first.')
      const cards = (v.cards || []) as Card[]
      const before: Card[] = JSON.parse(JSON.stringify(cards))
      const card = cards.find(c => c.id === body.card_id)
      if (!card || card.type !== 'file') throw new UserError('Save the page first, then attach files to the file card.')
      if (card.attachments.length + files.length > 10) throw new UserError('A card can hold up to 10 files.')
      let uploaded
      try { uploaded = await uploadAttachments(supabase, files, `sop/${doc.id}/${v.id}`) } catch (e: any) { throw new UserError(e.message) }
      if (uploaded.length === 0) throw new UserError('Choose a file to attach.')
      card.attachments = [...card.attachments, ...uploaded]
      ok(await supabase.from('sop_versions').update({ cards, updated_at: new Date().toISOString() }).eq('id', v.id))
      if (live) await logEdit(doc.id, v.id, `Attached: ${uploaded.map(u => u.name).join(', ')}`.slice(0, 500), before)
      return NextResponse.json({ attachments: card.attachments })
    }

    case 'remove_file': {
      const v = await loadVersion(body.version_id)
      const doc = await manageDoc(v.sop_id)
      const minor = body.minor === 'true' || body.minor === true
      const live = minor && doc.status === 'active' && doc.current_version_id === v.id && v.status === 'approved'
      if (v.status !== 'draft' && !live) throw new UserError('Only a draft can be edited. Reopen it first.')
      const cards = (v.cards || []) as Card[]
      const before: Card[] = JSON.parse(JSON.stringify(cards))
      const card = cards.find(c => c.id === body.card_id)
      if (!card || !card.attachments.some(a => a.path === body.path)) throw new UserError('Not found', 404)
      const name = card.attachments.find(a => a.path === body.path)?.name || 'a file'
      card.attachments = card.attachments.filter(a => a.path !== body.path)
      ok(await supabase.from('sop_versions').update({ cards, updated_at: new Date().toISOString() }).eq('id', v.id))
      // On a live page the file stays in storage: the edit log's "before" copy still points at it.
      if (live) await logEdit(doc.id, v.id, `Removed file: ${name}`.slice(0, 500), before)
      else await removeFiles([body.path])
      return NextResponse.json({ attachments: card.attachments })
    }

    // ---------------- approval flow ----------------
    case 'submit': {
      const v = await loadVersion(body.version_id)
      const doc = await manageDoc(v.sop_id)
      if (doc.status === 'retired') throw new UserError('A retired document can\'t be submitted.')
      if (v.status !== 'draft') throw new UserError('This version has already been submitted.')
      const cards = (v.cards || []) as Card[]
      if (cards.length === 0) throw new UserError('Add at least one content card before submitting.')
      if (cards.some(c => c.type === 'file' && c.attachments.length === 0)) throw new UserError('A file card has no file attached. Attach one or remove the card.')
      if (cards.some(c => c.type === 'link' && !c.url)) throw new UserError('A link card needs a valid web address (starting with http:// or https://).')
      if (!v.effectivity_date) throw new UserError('Set the effectivity date before submitting.')
      if (v.version_no > 1 && !(v.summary || '').trim()) throw new UserError('Add a change summary describing what changed in this version.')
      if (v.receiver_mode === 'selected' && (await receiversOf(v.id)).length === 0) throw new UserError('Choose who must acknowledge it, or switch to Everyone.')
      const approvals = await approvalsOf(v.id)
      const withRoles = []
      for (const a of approvals) withRoles.push({ email: a.approver_email, role: (await roleOf(a.approver_email)) || '' })
      const problem = approverProblem(withRoles, me, role)
      if (problem) throw new UserError(problem)
      ok(await supabase.from('sop_approvals').update({ decision: 'pending', comment: null, decided_at: null }).eq('version_id', v.id))
      ok(await supabase.from('sop_versions').update({ status: 'pending_approval', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', v.id))
      await sendMail(approvals.map(a => a.approver_email), `Approval needed: ${doc.code} v${v.version_no}`,
        emailShell('Approval needed', `<p><b>${esc(staff.name)}</b> asked you to review and approve <b>${esc(doc.code)} — ${esc(doc.title)}</b> (version ${v.version_no}).</p>${v.summary ? `<p style="color:#6b7280;">What changed: ${esc(v.summary)}</p>` : ''}`, { label: 'Open the SOP Repository', url: LINK }))
      return NextResponse.json({ ok: true })
    }

    case 'decide': {
      const v = await loadVersion(body.version_id)
      const doc = await loadDoc(v.sop_id)
      if (v.status !== 'pending_approval') throw new UserError('This version is not waiting for approval.')
      const decision: Decision = body.decision === 'approved' ? 'approved' : body.decision === 'declined' ? 'declined' : 'pending'
      if (decision === 'pending') throw new UserError('Choose approve or decline.')
      const comment = String(body.comment || '').trim().slice(0, 2000)
      if (decision === 'declined' && !comment) throw new UserError('Please say why you are declining, so the author knows what to fix.')
      const approvals = await approvalsOf(v.id)
      const mine = approvals.find(a => sameStaff(a.approver_email, me))
      if (!mine) throw new UserError('You are not an approver on this version.', 403)
      if (mine.decision !== 'pending') throw new UserError('You have already decided on this version.')
      ok(await supabase.from('sop_approvals').update({ decision, comment: comment || null, decided_at: new Date().toISOString() }).eq('id', mine.id))
      const outcome = approvalOutcome(approvals.map(a => (a.id === mine.id ? decision : a.decision) as Decision))

      if (outcome === 'declined') {
        ok(await supabase.from('sop_versions').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', v.id))
        await sendMail([v.created_by], `Declined: ${doc.code} v${v.version_no}`,
          emailShell('Your document was declined', `<p><b>${esc(staff.name)}</b> declined <b>${esc(doc.code)} — ${esc(doc.title)}</b> (v${v.version_no}).</p><p style="color:#6b7280;">Reason: ${esc(comment)}</p><p>Reopen it, fix what was raised, and submit again.</p>`, { label: 'Open the SOP Repository', url: LINK }))
        return NextResponse.json({ outcome })
      }
      if (outcome === 'approved') await makeCurrent(doc, v, null)
      return NextResponse.json({ outcome })
    }

    // Withdraw a submitted version, or reopen a declined one, back to draft.
    case 'reopen': {
      const v = await loadVersion(body.version_id)
      await manageDoc(v.sop_id)
      if (v.status !== 'pending_approval' && v.status !== 'declined') throw new UserError('Only a submitted or declined version can be reopened.')
      ok(await supabase.from('sop_approvals').update({ decision: 'pending', comment: null, decided_at: null }).eq('version_id', v.id))
      ok(await supabase.from('sop_versions').update({ status: 'draft', submitted_at: null, updated_at: new Date().toISOString() }).eq('id', v.id))
      return NextResponse.json({ ok: true })
    }

    // Start the next version from the current one. Files are COPIED so deleting
    // a file in the new draft can never remove it from the approved version.
    case 'new_version': {
      const doc = await manageDoc(body.id)
      return NextResponse.json({ version_id: await createNextVersion(doc, {}) })
    }

    // ---------------- quick add (document already approved elsewhere) ----------------
    // Step 1 of 3 for the browser: creates the document and its draft v1 with the
    // approval details. The browser then uploads the document file and the proof
    // screenshots (separate requests, each under the 4 MB platform limit) and
    // calls publish_external.
    case 'quick_add': {
      const issue = proofProblem(body)
      if (issue) throw new UserError(issue)
      if (!canAuthor(role)) throw new UserError('Only Admins and Team Leads can add documents.', 403)
      const eff = body.effectivity_date && isYmd(body.effectivity_date) ? body.effectivity_date : phToday()
      const review = body.next_review_date && isYmd(body.next_review_date) ? body.next_review_date : null
      const doc = await newDocRow(body)
      const fileCardId = newCardId()
      const cards: Card[] = []
      const desc = String(body.description || '').trim().slice(0, 20000)
      if (desc) cards.push({ id: newCardId(), type: 'text', title: 'Summary', body: desc, url: '', attachments: [] })
      const link = String(body.link || '').trim()
      if (/^https?:\/\//i.test(link)) cards.push({ id: newCardId(), type: 'link', title: 'Document link', body: '', url: link.slice(0, 1000), attachments: [] })
      cards.push({ id: fileCardId, type: 'file', title: 'Document', body: '', url: '', attachments: [] })
      const { data: ver, error: vErr } = await supabase.from('sop_versions').insert({
        sop_id: doc.id, version_no: 1, created_by: me, approval_source: 'external', cards, effectivity_date: eff, next_review_date: review, receiver_mode: 'all',
      }).select('id').single()
      if (vErr || !ver) { await supabase.from('sop_documents').delete().eq('id', doc.id); throw new UserError('Could not add the document.', 500) }
      const { data: proof, error: pErr } = await supabase.from('sop_approval_proofs').insert({
        sop_id: doc.id, version_id: ver.id, approved_by_name: String(body.approved_by_name).trim().slice(0, 200), approved_by_role: String(body.approved_by_role || '').trim().slice(0, 200) || null,
        approved_on: body.approved_on, method: body.method, note: String(body.note || '').trim().slice(0, 2000) || null, added_by: me, added_by_name: staff.name,
      }).select('id').single()
      if (pErr || !proof) { await supabase.from('sop_documents').delete().eq('id', doc.id); throw new UserError('Could not save the approval details.', 500) }
      return NextResponse.json({ id: doc.id, version_id: ver.id, file_card_id: fileCardId, proof_id: proof.id })
    }

    // Approval details for a version that was approved outside the system.
    case 'add_proof': {
      const v = await loadVersion(body.version_id)
      await manageDoc(v.sop_id)
      const issue = proofProblem(body)
      if (issue) throw new UserError(issue)
      const { data: proof, error } = await supabase.from('sop_approval_proofs').insert({
        sop_id: v.sop_id, version_id: v.id, approved_by_name: String(body.approved_by_name).trim().slice(0, 200), approved_by_role: String(body.approved_by_role || '').trim().slice(0, 200) || null,
        approved_on: body.approved_on, method: body.method, note: String(body.note || '').trim().slice(0, 2000) || null, added_by: me, added_by_name: staff.name,
      }).select('id').single()
      if (error || !proof) throw new UserError('Could not save the approval details.', 500)
      return NextResponse.json({ id: proof.id })
    }

    // Screenshots / PDFs of the approval. Append-only: files can be added later,
    // never replaced; only an Admin can delete the whole entry.
    case 'add_proof_files': {
      const { data: proof } = await supabase.from('sop_approval_proofs').select('*').eq('id', body.proof_id).maybeSingle()
      if (!proof) throw new UserError('Not found', 404)
      const doc = await manageDoc(proof.sop_id)
      const existing = (proof.attachments || []) as any[]
      if (existing.length + files.length > 10) throw new UserError('An approval entry can hold up to 10 files.')
      let uploaded
      try { uploaded = await uploadAttachments(supabase, files, `sop/${doc.id}/proof/${proof.id}`) } catch (e: any) { throw new UserError(e.message) }
      if (uploaded.length === 0) throw new UserError('Choose a file to attach.')
      const stamped = uploaded.map(u => ({ ...u, added_by: me, added_by_name: staff.name, added_at: new Date().toISOString() }))
      ok(await supabase.from('sop_approval_proofs').update({ attachments: [...existing, ...stamped] }).eq('id', proof.id))
      return NextResponse.json({ attachments: [...existing, ...stamped] })
    }

    case 'proof_file_url': {
      const { doc, c } = await seeDoc(body.id)
      if (!canSeeAllVersions(doc, c.vctx)) throw new UserError('Not found', 404)   // managers only
      const { data: proof } = await supabase.from('sop_approval_proofs').select('sop_id, attachments').eq('id', body.proof_id).maybeSingle()
      if (!proof || proof.sop_id !== doc.id || !((proof.attachments || []) as any[]).some(a => a.path === body.path)) throw new UserError('Not found', 404)
      const url = await signedUrl(supabase, body.path)
      return url ? NextResponse.json({ url }) : fail('Could not open the file', 500)
    }

    // Publish a draft that is ALREADY approved (by the client or an outside
    // approver). Needs the approval details; screenshots may follow later.
    case 'publish_external': {
      const v = await loadVersion(body.version_id)
      const doc = await manageDoc(v.sop_id)
      if (doc.status === 'retired') throw new UserError('A retired document can\'t be published.')
      if (v.status !== 'draft') throw new UserError('This version is not a draft.')
      const proofs = await proofRows([v.id])
      if (proofs.length === 0) throw new UserError('Add who approved it (name, date and how) before publishing.')
      const cards = ((v.cards || []) as Card[]).filter(cardHasContent)
      if (cards.length === 0) throw new UserError('Add the document (a file, a link or some text) before publishing.')
      if (cards.some(c => c.type === 'link' && !c.url)) throw new UserError('A link card needs a valid web address (starting with http:// or https://).')
      if (cards.some(c => c.type === 'file' && c.attachments.length === 0)) throw new UserError('A file card has no file attached. Attach one or remove the card.')
      if (v.version_no > 1 && !(v.summary || '').trim()) throw new UserError('Add a change summary describing what changed in this version.')
      const eff = v.effectivity_date || phToday()
      ok(await supabase.from('sop_versions').update({ cards, approval_source: 'external', effectivity_date: eff }).eq('id', v.id))
      await makeCurrent(doc, { ...v, cards, effectivity_date: eff }, proofs[0])
      return NextResponse.json({ ok: true })
    }

    // Record a process change: starts a draft of the next version carrying the
    // change entry. If the approval already happened outside, the proof is
    // saved with it and the draft can be published directly once edited.
    case 'record_change': {
      const doc = await manageDoc(body.id)
      const summary = String(body.summary || '').trim().slice(0, 4000)
      if (!summary) throw new UserError('Describe what changed.')
      const path = body.approval_path === 'already_approved' ? 'already_approved' : 'needs_approval'
      if (path === 'already_approved') { const issue = proofProblem(body); if (issue) throw new UserError(issue) }
      for (const f of ['requested_on', 'effective_date']) if (body[f] && !isYmd(body[f])) throw new UserError('Use valid dates.')
      const versionId = await createNextVersion(doc, { summary, effectivity_date: body.effective_date || null })
      const { error } = await supabase.from('sop_changes').insert({
        sop_id: doc.id, version_id: versionId, summary, previous_text: String(body.previous_text || '').trim().slice(0, 4000) || null,
        reason: String(body.reason || '').trim().slice(0, 2000) || null, requested_by: String(body.requested_by || '').trim().slice(0, 200) || null,
        requested_by_role: String(body.requested_by_role || '').trim().slice(0, 200) || null, requested_on: body.requested_on || null,
        effective_date: body.effective_date || null, approval_path: path, request_ref: String(body.request_ref || '').trim().slice(0, 40) || null,
        added_by: me, added_by_name: staff.name,
      })
      if (error) { await supabase.from('sop_versions').delete().eq('id', versionId); throw new UserError('Could not record the change.', 500) }
      let proofId: string | null = null
      if (path === 'already_approved') {
        const { data: proof, error: pErr } = await supabase.from('sop_approval_proofs').insert({
          sop_id: doc.id, version_id: versionId, approved_by_name: String(body.approved_by_name).trim().slice(0, 200), approved_by_role: String(body.approved_by_role || '').trim().slice(0, 200) || null,
          approved_on: body.approved_on, method: body.method, note: String(body.note || '').trim().slice(0, 2000) || null, added_by: me, added_by_name: staff.name,
        }).select('id').single()
        if (pErr || !proof) { await supabase.from('sop_versions').delete().eq('id', versionId); throw new UserError('Could not save the approval details.', 500) }
        proofId = proof.id
      }
      return NextResponse.json({ version_id: versionId, proof_id: proofId })
    }

    // A small fix to the LIVE page (typo, wording, extra step, new screenshot).
    // No re-approval, no re-acknowledgment, but always logged with a note and the
    // content as it was before. A real process change is record_change instead.
    case 'minor_edit': {
      const v = await loadVersion(body.version_id)
      const doc = await manageDoc(v.sop_id)
      if (doc.status !== 'active' || doc.current_version_id !== v.id || v.status !== 'approved') throw new UserError('Small edits apply to the live version of an active document. For a process change, record a change instead.')
      const note = String(body.note || '').trim().slice(0, 500)
      if (!note) throw new UserError('Add a one-line note saying what you changed.')
      const before = (v.cards || []) as Card[]
      const next = sanitizeCards(body.cards, before)
      const patch: any = { cards: next, updated_at: new Date().toISOString() }
      let reviewChanged = false
      if (body.next_review_date !== undefined) {
        if (body.next_review_date && !isYmd(body.next_review_date)) throw new UserError('Use a valid date.')
        const nr = body.next_review_date || null
        if (nr !== (v.next_review_date || null)) { patch.next_review_date = nr; reviewChanged = true }
      }
      if (!cardsChanged(before, next) && !reviewChanged) return NextResponse.json({ unchanged: true })
      await logEdit(doc.id, v.id, note, before)
      ok(await supabase.from('sop_versions').update(patch).eq('id', v.id))
      await supabase.from('sop_documents').update({ updated_at: new Date().toISOString() }).eq('id', doc.id)
      return NextResponse.json({ ok: true })
    }

    // Admin only. Evidence is never edited; removal is rare and is logged.
    case 'delete_entry': {
      if (!isAdminRole(role)) throw new UserError('Only an Admin can remove an entry.', 403)
      if (body.kind === 'proof') {
        const { data: p } = await supabase.from('sop_approval_proofs').select('*').eq('id', body.entry_id).maybeSingle()
        if (!p) throw new UserError('Not found', 404)
        await removeFiles(((p.attachments || []) as any[]).map(a => a.path))
        ok(await supabase.from('sop_approval_proofs').delete().eq('id', p.id))
        await logEdit(p.sop_id, p.version_id, `Admin removed an approval entry: ${p.approved_by_name}, ${p.approved_on}`.slice(0, 500), [])
      } else if (body.kind === 'change') {
        const { data: c } = await supabase.from('sop_changes').select('*').eq('id', body.entry_id).maybeSingle()
        if (!c) throw new UserError('Not found', 404)
        ok(await supabase.from('sop_changes').delete().eq('id', c.id))
        await logEdit(c.sop_id, c.version_id, `Admin removed a change entry: ${c.summary}`.slice(0, 500), [])
      } else throw new UserError('Unknown entry', 400)
      return NextResponse.json({ ok: true })
    }

    case 'retire': {
      const doc = await manageDoc(body.id)
      if (!canRetireDoc(doc, role, me)) throw new UserError('Only an Admin or the person who created this can retire it.', 403)
      if (doc.status === 'retired') return NextResponse.json({ ok: true })
      ok(await supabase.from('sop_documents').update({ status: 'retired', retired_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', doc.id))
      return NextResponse.json({ ok: true })
    }

    // ---------------- acknowledgment ----------------
    case 'acknowledge': {
      const { doc, c } = await seeDoc(body.id)
      if (doc.status !== 'active' || !c.current || c.current.id !== body.version_id) throw new UserError('That version is no longer current. Refresh and read the latest one.')
      if (!c.vctx.isReceiver) throw new UserError('This document is not assigned to you.', 403)
      const acked = await acksOf(c.current.id)
      if (acked.some(a => sameStaff(a, me))) return NextResponse.json({ ok: true })
      ok(await supabase.from('sop_acks').insert({ version_id: c.current.id, email: me, name: staff.name }))
      return NextResponse.json({ ok: true })
    }

    case 'remind': {
      const doc = await manageDoc(body.id)
      if (doc.status !== 'active' || !doc.current_version_id) throw new UserError('Only an active document can have reminders sent.')
      const cur = await loadVersion(doc.current_version_id)
      const emps = await activeEmployees()
      const selected = cur.receiver_mode === 'selected' ? await receiversOf(cur.id) : []
      const stats = ackStats(cur.receiver_mode, emps.map(e => e.email), selected, await acksOf(cur.id))
      if (stats.pending.length === 0) return NextResponse.json({ sent: 0 })
      const sent = await sendMail(stats.pending.slice(0, 300), `Reminder: please acknowledge ${doc.code} v${cur.version_no}`,
        emailShell('Reminder: acknowledgment needed', `<p>Please read and acknowledge <b>${esc(doc.code)} — ${esc(doc.title)}</b> (version ${cur.version_no}) in the portal.</p>`, { label: 'Open the SOP Repository', url: LINK }))
      return NextResponse.json({ sent: sent ? Math.min(stats.pending.length, 300) : 0 })
    }

    default:
      return fail('Unknown action', 400)
  }
}

export const dynamic = 'force-dynamic'

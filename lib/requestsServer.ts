import { SupabaseClient } from '@supabase/supabase-js'
import { resolveRecipients } from '@/lib/clientRequests'
import { FALLBACK_ALERT_EMAIL } from '@/lib/serverMail'

export const BUCKET = 'client-uploads'
export const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'csv', 'txt']
// Vercel rejects request bodies over roughly 4.5 MB, so the whole message
// (all files together) is capped just under that, with a clear message,
// rather than letting a bigger upload fail with an opaque platform error.
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024
export const MAX_FILES = 5

export type Attachment = { name: string, path: string, size: number }

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Validates and uploads files to the private bucket. Throws Error(message) with
// a user-readable reason if anything is wrong, before uploading anything.
export async function uploadAttachments(supabase: SupabaseClient, files: File[], folder: string): Promise<Attachment[]> {
  const real = files.filter(f => f && typeof f.arrayBuffer === 'function' && f.size > 0)
  if (real.length === 0) return []
  if (real.length > MAX_FILES) throw new Error(`Attach up to ${MAX_FILES} files per message.`)
  const total = real.reduce((s, f) => s + f.size, 0)
  if (total > MAX_TOTAL_BYTES) throw new Error('Attachments are limited to 4 MB per message in total. Send the rest in another message, or paste a link to a larger file.')
  for (const f of real) {
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) throw new Error(`"${f.name}": that file type isn't allowed. Accepted: ${ALLOWED_EXT.join(', ')}.`)
  }
  const out: Attachment[] = []
  for (let i = 0; i < real.length; i++) {
    const f = real[i]
    const path = `${folder}/${Date.now()}-${i}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type || 'application/octet-stream', upsert: false })
    if (error) throw new Error('Upload failed: ' + error.message)
    out.push({ name: f.name, path, size: f.size })
  }
  return out
}

export async function signedUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
  return error || !data ? null : data.signedUrl
}

// Every attachment path that legitimately belongs to a request (the request's
// own plus those on its messages). A file URL is only ever issued for a path in
// this set, so a path can't be guessed or swapped to reach another client's file.
export function allowedPaths(request: { attachments: Attachment[] | null }, messages: { attachments: Attachment[] | null, visible_to_client?: boolean }[], clientView: boolean): Set<string> {
  const s = new Set<string>()
  ;(request.attachments || []).forEach(a => s.add(a.path))
  messages.forEach(m => { if (!clientView || m.visible_to_client) (m.attachments || []).forEach(a => s.add(a.path)) })
  return s
}

// Who should be alerted for a request sent to this level.
export async function alertRecipients(supabase: SupabaseClient, client: string, level: string): Promise<string[]> {
  const local = (e: string | null) => (e || '').toLowerCase().split('@')[0]
  let derived: string[] = []
  if (level === 'team_lead') {
    const { data: tls } = await supabase.from('app_users').select('email').eq('role', 'Team Lead').eq('active', true)
    const tlLocals = new Set((tls || []).map((u: any) => local(u.email)))
    const { data: emps } = await supabase.from('employees').select('email, client, clients_supported').eq('active', true)
    derived = (emps || []).filter((e: any) => {
      const cs: string[] = e.clients_supported?.length ? e.clients_supported : (e.client ? [e.client] : [])
      return e.email && tlLocals.has(local(e.email)) && cs.some(c => c.trim().toLowerCase() === client.trim().toLowerCase())
    }).map((e: any) => e.email as string)
  }
  const { data: routing } = await supabase.from('client_comm_routing').select('client, level, recipients')
  return resolveRecipients({ level, client, derivedTeamLeads: derived, routing: routing || [], fallback: FALLBACK_ALERT_EMAIL })
}

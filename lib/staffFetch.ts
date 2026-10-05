import { supabase } from '@/lib/supabase'

// Calls the staff Client Requests endpoint with the signed-in person's real
// Google session token, which the server verifies (lib/staffAuth.ts). If the
// person has no live Google session (e.g. an admin on the password fallback),
// the server answers 401 and the caller shows a "sign in with Google" message.
export async function staffApi(body: Record<string, any> | FormData): Promise<{ ok: boolean, status: number, data: any }> {
  let token: string | undefined
  try { token = (await supabase.auth.getSession()).data.session?.access_token } catch {}
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch('/api/client-requests/staff', {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
    body: isForm ? (body as FormData) : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

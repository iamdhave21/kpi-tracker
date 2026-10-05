// Who may see / change a Client Observations entry. Kept as plain functions
// (no React, no database) so the access rule can be tested on its own.
//
//   admin, super_admin  -> every entry
//   Team Lead           -> their own entries + entries for clients they support
//   anyone else (agent) -> only their own entries
//
// A Team Lead with no clients set sees only their own entries -- unlike the
// employee pickers, where "no clients set" means unrestricted, an empty list
// must NOT open up every client's entries.

export type ObsLike = { client: string, created_by: string }

const lc = (s: string | null | undefined) => (s || '').trim().toLowerCase()

export function canSeeEntry(e: ObsLike, role: string, meEmail: string, myClients: string[]): boolean {
  if (role === 'admin' || role === 'super_admin') return true
  if (lc(e.created_by) === lc(meEmail) && lc(meEmail) !== '') return true
  if (role === 'Team Lead') return myClients.map(lc).includes(lc(e.client))
  return false
}

export function canEditEntry(e: ObsLike, role: string, meEmail: string): boolean {
  if (role === 'admin' || role === 'super_admin') return true
  return lc(meEmail) !== '' && lc(e.created_by) === lc(meEmail)
}

export const OBS_CATEGORIES = ['Event / meeting', 'Process', 'Behavioral', 'Performance gap', 'Communication', 'Request / ask', 'Positive feedback', 'Risk', 'Personnel change', 'Commercial / contract', 'Other']
export const OBS_TONES = [
  { value: 'positive', label: 'Positive', dot: 'bg-emerald-500' },
  { value: 'neutral', label: 'Neutral', dot: 'bg-gray-400' },
  { value: 'concern', label: 'Concern', dot: 'bg-amber-500' },
  { value: 'risk', label: 'Risk', dot: 'bg-red-500' },
]
export const OBS_SIGNIFICANCE = ['low', 'medium', 'high']
export const OBS_PERSON_ROLES = ['Client POC', 'Client manager', 'Client executive', 'Other']

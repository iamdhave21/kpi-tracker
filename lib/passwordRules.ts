// Pure decision rules for /api/auth/change-password. Standalone (no imports)
// so the unit test can load it directly.
//
// Inputs describe who is calling (a verified Google session, or nobody), who
// the target account is, and whether the caller supplied the target's CURRENT
// password and whether it was correct.

export const ADMIN_ROLES = ['admin', 'super_admin']

export type PasswordDecision = 'allow' | 'wrong-password' | 'need-proof' | 'forbidden'

export function passwordChangeDecision(i: {
  staffRole: string | null       // null = no verified Google session
  isSelf: boolean                // verified session belongs to the target account
  targetRole: string
  oldPasswordProvided: boolean
  oldPasswordOk: boolean
}): PasswordDecision {
  const targetIsAdmin = ADMIN_ROLES.includes(i.targetRole)
  if (i.staffRole) {
    if (i.isSelf) return i.oldPasswordProvided && !i.oldPasswordOk ? 'wrong-password' : 'allow'
    if (ADMIN_ROLES.includes(i.staffRole) && (!targetIsAdmin || i.staffRole === 'super_admin')) return 'allow'
    return i.oldPasswordProvided && i.oldPasswordOk ? 'allow' : 'forbidden'
  }
  if (!i.oldPasswordProvided) return 'need-proof'
  return i.oldPasswordOk ? 'allow' : 'wrong-password'
}

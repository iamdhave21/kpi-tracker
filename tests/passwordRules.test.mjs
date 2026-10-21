import { passwordChangeDecision as d } from '../lib/passwordRules.ts'
let fail = 0
const eq = (n, got, want) => { const ok = got === want; if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${got} want ${want}`) }
const base = { staffRole: null, isSelf: false, targetRole: 'super_admin', oldPasswordProvided: false, oldPasswordOk: false }

// The original hole: nobody signed in, no password, target is the Super Admin.
eq('anonymous reset of Super Admin (the old adminReset hole) is refused', d({ ...base }), 'need-proof')
eq('anonymous reset of an agent is refused', d({ ...base, targetRole: 'agent' }), 'need-proof')
eq('anonymous with wrong current password is refused', d({ ...base, oldPasswordProvided: true, oldPasswordOk: false }), 'wrong-password')
eq('anonymous with the right current password is allowed (password-only admin)', d({ ...base, oldPasswordProvided: true, oldPasswordOk: true }), 'allow')

// Google-verified self
eq('Google user changes their own password', d({ ...base, staffRole: 'agent', isSelf: true, targetRole: 'agent' }), 'allow')
eq('Google user self-change with a WRONG current password is refused', d({ ...base, staffRole: 'agent', isSelf: true, targetRole: 'agent', oldPasswordProvided: true }), 'wrong-password')
eq('Google user self-change with the right current password', d({ ...base, staffRole: 'admin', isSelf: true, targetRole: 'admin', oldPasswordProvided: true, oldPasswordOk: true }), 'allow')

// Admin resets
eq('Admin resets an agent', d({ ...base, staffRole: 'admin', targetRole: 'agent' }), 'allow')
eq('Admin resets a Team Lead', d({ ...base, staffRole: 'admin', targetRole: 'Team Lead' }), 'allow')
eq('Admin may NOT reset another admin', d({ ...base, staffRole: 'admin', targetRole: 'admin' }), 'forbidden')
eq('Admin may NOT reset the Super Admin', d({ ...base, staffRole: 'admin', targetRole: 'super_admin' }), 'forbidden')
eq('Super Admin resets an admin', d({ ...base, staffRole: 'super_admin', targetRole: 'admin' }), 'allow')
eq('Super Admin resets an agent', d({ ...base, staffRole: 'super_admin', targetRole: 'agent' }), 'allow')

// Non-admins with a Google session
eq('Team Lead cannot reset someone else', d({ ...base, staffRole: 'Team Lead', targetRole: 'agent' }), 'forbidden')
eq('agent cannot reset the Super Admin', d({ ...base, staffRole: 'agent', targetRole: 'super_admin' }), 'forbidden')
eq('agent who knows the target\'s password may change it', d({ ...base, staffRole: 'agent', targetRole: 'agent', oldPasswordProvided: true, oldPasswordOk: true }), 'allow')
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)

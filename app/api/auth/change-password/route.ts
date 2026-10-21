import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { verifyStaff } from '@/lib/staffAuth'
import { passwordChangeDecision } from '@/lib/passwordRules'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const likeEsc = (s: string) => s.replace(/[\\%_]/g, '\\$&')
const localPart = (s: string | null | undefined) => (s || '').toLowerCase().split('@')[0]

async function passwordMatches(stored: string | null, given: string): Promise<boolean> {
  if (!stored || !given) return false
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) return bcrypt.compare(given, stored)
  return stored === given   // legacy plain-text rows
}

// Who may change a password:
//   1. Someone with a live Google session (verified server-side) changing THEIR OWN password.
//   2. An Admin / Super Admin with a live Google session resetting someone else's
//      (only a Super Admin may reset another Admin or Super Admin).
//   3. Anyone else must prove they know the CURRENT password (oldPassword).
// Previously a request with { adminReset: true } skipped every check, so anyone who
// knew a username could reset that account's password. The adminReset flag is now ignored.
export async function POST(req: NextRequest) {
  try {
    const { username, oldPassword, newPassword } = await req.json()
    if (!username || !newPassword) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (typeof username !== 'string' || typeof newPassword !== 'string') return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const staff = await verifyStaff(req)
    if (!staff && !oldPassword) {
      return NextResponse.json({ error: 'Please sign in with Google, or enter your current password.' }, { status: 401 })
    }

    const supabase = getSupabase()
    const key = likeEsc(username.trim())
    let { data: target } = await supabase.from('app_users').select('id, username, email, role, password_hash').ilike('username', key).maybeSingle()
    if (!target) ({ data: target } = await supabase.from('app_users').select('id, username, email, role, password_hash').ilike('email', key).maybeSingle())

    if (!target) {
      return staff
        ? NextResponse.json({ error: 'User not found' }, { status: 404 })
        : NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const oldPasswordProvided = typeof oldPassword === 'string' && oldPassword.length > 0
    const oldPasswordOk = oldPasswordProvided ? await passwordMatches(target.password_hash as string, oldPassword) : false
    const decision = passwordChangeDecision({
      staffRole: staff ? staff.role : null,
      isSelf: !!staff && localPart(target.email || target.username) === localPart(staff.email),
      targetRole: target.role,
      oldPasswordProvided, oldPasswordOk,
    })
    if (decision === 'wrong-password') return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    if (decision === 'need-proof') return NextResponse.json({ error: 'Please sign in with Google, or enter your current password.' }, { status: 401 })
    if (decision === 'forbidden') return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const hash = await bcrypt.hash(newPassword, 12)
    const { error } = await supabase.from('app_users').update({
      password_hash: hash,
      must_change_password: false,
      updated_at: new Date().toISOString()
    }).eq('id', target.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}

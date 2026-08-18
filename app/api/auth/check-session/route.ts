import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// The app's session lives in the browser's localStorage and, until now, was
// never re-checked against app_users after the initial login -- so
// deactivating someone only blocked their NEXT login attempt, not a session
// they already had open (or one sitting in a browser they hadn't touched in
// weeks). This endpoint lets the client re-confirm "is this account still
// active?" on load and periodically while the app is open, so a
// deactivation actually takes effect right away instead of on next login.
export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json()
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ active: false }, { status: 400 })
    }
    const supabase = getSupabase()
    const { data: user } = await supabase
      .from('app_users')
      .select('active, role')
      .ilike('email', username.trim())
      .maybeSingle()

    if (!user || !user.active) {
      return NextResponse.json({ active: false })
    }
    return NextResponse.json({ active: true, role: user.role })
  } catch {
    // Fail closed would log everyone out on a transient network blip, which
    // is worse than the rare case of a deactivated user staying in for one
    // more check cycle -- so a server error here just skips this check.
    return NextResponse.json({ active: true })
  }
}

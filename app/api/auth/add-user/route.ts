import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    // Note: Adding users requires updating APP_USERS env var in Vercel and redeploying
    // This endpoint validates the request and returns instructions
    return NextResponse.json({ success: true, message: `User "${username}" queued. Update APP_USERS in Vercel to: existing_users,${username}:${password}` })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

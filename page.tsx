import { NextRequest, NextResponse } from 'next/server'

function getUsers(): Record<string, string> {
  const raw = process.env.APP_USERS || 'admin:admin123'
  const users: Record<string, string> = {}
  raw.split(',').forEach(pair => {
    const [u, p] = pair.trim().split(':')
    if (u && p) users[u] = p
  })
  return users
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }
    const users = getUsers()
    const validPassword = users[username.toLowerCase()]
    if (!validPassword || validPassword !== password) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }
    return NextResponse.json({
      user: { username: username.toLowerCase(), role: username.toLowerCase() === 'admin' ? 'manager' : 'team_lead' }
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/clientPortalAuth'

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value
  const contact = await verifySession(sessionToken)
  if (!contact) return NextResponse.json({ contact: null })
  return NextResponse.json({ contact })
}

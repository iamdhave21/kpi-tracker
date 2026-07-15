import { NextRequest, NextResponse } from 'next/server'

// Google Sign-In has been removed from this app -- it was auto-logging
// people in under whichever Google Workspace account happened to be
// active in their browser (which could be a different company domain
// entirely, unrelated to their actual employee record). Anyone hitting
// this old callback URL (e.g. a stale bookmark) just gets sent to the
// normal login page.
export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url)
  return NextResponse.redirect(`${origin}/`)
}

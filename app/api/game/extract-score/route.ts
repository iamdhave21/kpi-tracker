import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'Manual review mode - upload via portal' }, { status: 400 })
}

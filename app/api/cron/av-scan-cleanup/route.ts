import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const RETENTION_DAYS = 90

// Runs once daily via Vercel Cron (see vercel.json). Deletes the storage
// object for any av_scan_submissions row older than RETENTION_DAYS,
// but keeps the row itself -- who submitted, when, which week, quick or
// full -- so a year of compliance history survives even after the
// picture is gone (see AUDIT.md N33: every other upload path in this app
// has no retention plan at all; this one is built with one from day one).
// screenshot_deleted_at is what the UI checks before attempting to show
// a screenshot, rather than trying (and failing) to load a deleted file.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: expired, error: selectErr } = await supabase
    .from('av_scan_submissions')
    .select('id, storage_path')
    .lt('submitted_at', cutoff)
    .is('screenshot_deleted_at', null)

  if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 })
  if (!expired || expired.length === 0) return NextResponse.json({ success: true, deleted: 0 })

  let deleted = 0
  const errors: string[] = []
  for (const row of expired) {
    const { error: removeErr } = await supabase.storage.from('av-scans').remove([row.storage_path])
    if (removeErr) { errors.push(`${row.id}: ${removeErr.message}`); continue }
    const { error: updateErr } = await supabase
      .from('av_scan_submissions')
      .update({ screenshot_deleted_at: new Date().toISOString() })
      .eq('id', row.id)
    if (updateErr) { errors.push(`${row.id}: ${updateErr.message}`); continue }
    deleted++
  }

  return NextResponse.json({ success: errors.length === 0, deleted, total: expired.length, errors: errors.length ? errors : undefined })
}

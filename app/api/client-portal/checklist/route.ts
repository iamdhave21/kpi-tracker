import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getServiceSupabase, SESSION_COOKIE } from '@/lib/clientPortalAuth'

// Every row returned here is scoped to the caller's OWN client, resolved
// server-side from their verified session -- never from anything the
// client sent in the request. This is the entire cross-client isolation
// boundary for this feature; get this wrong and Client A can see Client
// B's data.
export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value
  const contact = await verifySession(sessionToken)
  if (!contact) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const supabase = getServiceSupabase()

  const { data: pack } = await supabase
    .from('handover_pack_records')
    .select('*')
    .eq('client', contact.client)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: items } = await supabase
    .from('handover_pack_items')
    .select('*')
    .is('retired_at', null)
    .order('sort_order')

  let submissions: any[] = []
  let gaps: any[] = []
  if (pack) {
    const { data: subData } = await supabase
      .from('handover_pack_submissions')
      .select('id, item_id, received, file_name, drive_link, notes, submitted_at, received, received_at')
      .eq('pack_record_id', pack.id)
    submissions = subData || []

    const { data: gapsData } = await supabase
      .from('handover_gaps_log')
      .select('*')
      .eq('pack_record_id', pack.id)
      .order('created_at', { ascending: false })
    gaps = gapsData || []
  }

  return NextResponse.json({ contact, pack: pack || null, items: items || [], submissions, gaps })
}

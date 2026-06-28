import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const userEmail = formData.get('userEmail') as string
    const userName = formData.get('userName') as string
    const monthYear = formData.get('monthYear') as string

    if (!file || !userEmail) return NextResponse.json({ error: 'Missing file or user' }, { status: 400 })

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

    // Use Claude to extract score and verify timestamp
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `This is a game screenshot. Please:
1. Extract the highest score or final score visible in the image
2. Check if there is a visible date and time (clock, timestamp, taskbar, status bar) in the screenshot
3. If you can see a date/time, extract it

Respond ONLY with JSON (no markdown):
{
  "score": <number or null>,
  "hasTimestamp": <true or false>,
  "timestampText": "<the date/time text you see or null>",
  "confidence": "<high/medium/low>",
  "notes": "<brief note about what you see>"
}` }
        ]
      }]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    let parsed: { score: number|null, hasTimestamp: boolean, timestampText: string|null, confidence: string, notes: string }
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      return NextResponse.json({ error: 'Could not parse score from screenshot' }, { status: 400 })
    }

    if (!parsed.score || parsed.score <= 0) {
      return NextResponse.json({ error: 'No valid score found in screenshot', notes: parsed.notes }, { status: 400 })
    }

    if (!parsed.hasTimestamp) {
      return NextResponse.json({ 
        error: 'No date/time visible in screenshot. Please include your device clock or taskbar with date and time showing.',
        notes: parsed.notes
      }, { status: 400 })
    }

    // Upload screenshot to Supabase Storage
    const supabase = getSupabase()
    const fileName = `game-scores/${userEmail}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(fileName, bytes, { contentType: file.type, upsert: false })

    let screenshotUrl: string | null = null
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName)
      screenshotUrl = urlData.publicUrl
    }

    // Save score - only if better than today's best
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase.from('game_scores').select('score').eq('user_email', userEmail).eq('game_key', 'game_of_month').gte('played_at', today).order('score', { ascending: false }).limit(1)
    const currentBest = existing?.[0]?.score || 0

    if (parsed.score > currentBest) {
      await supabase.from('game_scores').insert({
        user_email: userEmail,
        user_name: userName,
        game_key: 'game_of_month',
        score: parsed.score,
        month_year: monthYear,
        screenshot_url: screenshotUrl,
        verified: true
      })
    }

    return NextResponse.json({
      success: true,
      score: parsed.score,
      isNewBest: parsed.score > currentBest,
      timestampText: parsed.timestampText,
      confidence: parsed.confidence,
      notes: parsed.notes
    })
  } catch (err) {
    console.error('Score extract error:', err)
    return NextResponse.json({ error: 'Failed to process screenshot' }, { status: 500 })
  }
}

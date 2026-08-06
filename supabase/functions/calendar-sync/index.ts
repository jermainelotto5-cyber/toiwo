// Supabase Edge Function: calendar-sync
// Deploy with `supabase functions deploy calendar-sync` from your project directory.
// This function expects environment variables:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'std/server'
import ical from 'node-ical'
import fetch from 'node-fetch'

serve(async (req) => {
  try {
    const body = await req.json()
    // body should contain { icals: [{url, sourceName}], action: 'import' }
    const { icals } = body
    if (!Array.isArray(icals)) return new Response('Missing icals', { status: 400 })

    // Use Supabase service role key to upsert blocked_dates
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SUPABASE_KEY) return new Response('Missing Supabase env', { status: 500 })

    for (const entry of icals) {
      const url = entry.url
      const sourceName = entry.sourceName || url
      const res = await fetch(url)
      const text = await res.text()
      const data = ical.parseICS(text)
      for (const k of Object.keys(data)) {
        const ev = data[k]
        if (ev.type === 'VEVENT') {
          const start = ev.start.toISOString().substring(0,10)
          const endDate = ev.end
          // store as closed interval: end - 1 day for single-night systems if needed
          const end = endDate.toISOString().substring(0,10)
          // Upsert into Supabase via REST
          await fetch(`${SUPABASE_URL}/rest/v1/blocked_dates`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ start_date: start, end_date: end, source: sourceName, metadata: { raw: ev } })
          })
        }
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('error', { status: 500 })
  }
})

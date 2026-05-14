// scripts/test-market-context.mjs
// Mirrors lib/queries/marketContext.ts logic for direct Node.js testing.
// Run: node scripts/test-market-context.mjs

import { GoogleGenerativeAI } from '@google/generative-ai'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY   = process.env.GEMINI_API_KEY
if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY env vars'); process.exit(1) }

const SECTOR    = 'Fintech'
const GEOGRAPHY = 'India'

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates',
}

// Check cache
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const params = new URLSearchParams({
  select: 'result,fetched_at',
  sector: `eq.${SECTOR}`,
  geography: `eq.${GEOGRAPHY}`,
  fetched_at: `gte.${cutoff}`,
  limit: '1',
})

console.log(`── Market Context Test: ${SECTOR} × ${GEOGRAPHY} ──`)
console.log()

const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/market_context_cache?${params}`, { headers })
const cacheRows = await cacheRes.json()

if (cacheRows.length > 0) {
  console.log('✓ Cache HIT')
  console.log(JSON.stringify(cacheRows[0].result, null, 2))
  process.exit(0)
}

console.log('Cache MISS — calling Gemini 2.0 Flash with Google Search grounding...')
console.log()

const genai = new GoogleGenerativeAI(GEMINI_KEY)
// gemini-2.0-flash requires billing; use gemini-2.5-flash-lite which has a free tier
// and supports googleSearch grounding
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

const prompt = `You are a market research analyst supporting M&A advisors and fund managers.

A user is researching the "${SECTOR}" sector in "${GEOGRAPHY}".

Using Google Search, find real, cited figures for this sector and geography. Return ONLY a JSON object — no markdown, no explanation, no text outside the JSON.

For every number you return, you MUST provide the source_name and source_url. If you cannot find a credible source for a specific field, return null for that field and its source fields. Never estimate, interpolate, or invent figures.

Prioritise sources in this order:
1. Industry research firms: Mordor Intelligence, MarketsandMarkets, Grand View Research, IMARC, Statista, Allied Market Research, Fortune Business Insights
2. Financial press: Financial Times, Bloomberg, Reuters, Economic Times, Wall Street Journal, Mint
3. Investment bank research or equity research reports
4. Credible financial news

Return this exact JSON structure:

{
  "cagr": {
    "value": number or null,
    "period": "e.g. 2024–2029" or null,
    "source_name": string or null,
    "source_url": string or null
  },
  "market_size": {
    "value_usd_bn": number or null,
    "year": number or null,
    "source_name": string or null,
    "source_url": string or null
  },
  "ev_revenue": {
    "value": number or null,
    "context": "one short phrase on what this is based on, e.g. median of listed peers" or null,
    "source_name": string or null,
    "source_url": string or null
  },
  "ev_ebitda": {
    "value": number or null,
    "context": string or null,
    "source_name": string or null,
    "source_url": string or null
  },
  "key_insight": "one sentence — the single most important market dynamic a deal professional should know about this sector and geography right now" or null
}`

try {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // no tools — testing if model responds at all
  })

  const candidates = result.response.candidates ?? []
  console.log('── Candidates:', candidates.length)
  if (candidates[0]) {
    console.log('  finishReason:', candidates[0].finishReason)
    console.log('  full candidate:', JSON.stringify(candidates[0], null, 2).slice(0, 600))
  }
  let text = result.response.text().trim()
  console.log('── Raw Gemini response ──')
  console.log(text.slice(0, 400) || '(empty)')
  console.log()

  if (text.includes('```')) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) text = match[1].trim()
  }

  const parsed = JSON.parse(text)
  console.log('── Parsed result ──')
  console.log(JSON.stringify(parsed, null, 2))
  console.log()

  // Upsert to cache
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/market_context_cache`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      sector: SECTOR,
      geography: GEOGRAPHY,
      result: parsed,
      fetched_at: new Date().toISOString(),
    }),
  })
  console.log(`Cache upsert: ${upsertRes.ok ? '✓ written' : `✗ ${upsertRes.status} ${await upsertRes.text()}`}`)

} catch (err) {
  console.error('Error:', err)
  process.exit(1)
}

// scripts/test-market-context-v2.mjs
// End-to-end test: Tavily → Gemini synthesis → Supabase cache
// Run: node scripts/test-market-context-v2.mjs

import { GoogleGenerativeAI } from '@google/generative-ai'
import { tavily } from '@tavily/core'

const ENV = Object.fromEntries(
  (await import('fs')).readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const SECTOR    = process.argv[2] ?? 'Fintech'
const GEOGRAPHY = process.argv[3] ?? 'India'

const SUPABASE_URL = ENV.SUPABASE_URL
const SUPABASE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY   = ENV.GEMINI_API_KEY
const TAVILY_KEY   = ENV.TAVILY_API_KEY

console.log(`── End-to-end Market Context: ${SECTOR} × ${GEOGRAPHY} ──`)
console.log()

// 1. Check cache first
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const cacheParams = new URLSearchParams({
  select: 'result,fetched_at', sector: `eq.${SECTOR}`,
  geography: `eq.${GEOGRAPHY}`, fetched_at: `gte.${cutoff}`, limit: '1',
})
const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/market_context_cache?${cacheParams}`, {
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
})
const cacheRows = await cacheRes.json()

if (cacheRows.length > 0) {
  console.log('✓ Cache HIT — skipping Tavily + Gemini calls')
  console.log(JSON.stringify(cacheRows[0].result, null, 2))
  process.exit(0)
}

// 2. Tavily retrieval
console.log('Step 1: Tavily retrieval...')
const t0 = Date.now()
const client = tavily({ apiKey: TAVILY_KEY })

const BLOCKED = new Set(['prnewswire.com','businesswire.com','globenewswire.com','openpr.com',
  'digitaljournal.com','dataintelo.com','factmr.com','futuremarketinsights.com'])
const domain = url => { try { return new URL(url).hostname.replace('www.','') } catch { return '' } }

const searches = await Promise.all([
  client.search(`${GEOGRAPHY} ${SECTOR} market CAGR compound annual growth rate`, { maxResults: 3, searchDepth: 'advanced', includeAnswer: false }),
  client.search(`${GEOGRAPHY} ${SECTOR} market size billion USD revenue`, { maxResults: 3, searchDepth: 'advanced', includeAnswer: false }),
  client.search(`${SECTOR} ${GEOGRAPHY} EV revenue multiple EV EBITDA valuation`, { maxResults: 3, searchDepth: 'advanced', includeAnswer: false }),
  client.search(`${GEOGRAPHY} ${SECTOR} startup funding investment venture capital 2024`, { maxResults: 3, searchDepth: 'advanced', includeAnswer: false }),
  client.search(`${GEOGRAPHY} ${SECTOR} competitive landscape key players market`, { maxResults: 3, searchDepth: 'advanced', includeAnswer: false }),
  client.search(`${GEOGRAPHY} ${SECTOR} market trends emerging opportunities 2024`, { maxResults: 3, searchDepth: 'advanced', includeAnswer: false }),
])

const seen = new Set(); const allResults = []
for (const batch of searches) {
  for (const r of (batch.results ?? [])) {
    if (!seen.has(r.url) && !BLOCKED.has(domain(r.url))) { seen.add(r.url); allResults.push(r) }
  }
}
console.log(`  ${allResults.length} unique results in ${((Date.now()-t0)/1000).toFixed(1)}s`)

const raw_snippets = allResults
  .sort((a,b) => b.score - a.score)
  .slice(0, 8)
  .map(r => `[${r.title}] ${r.content.slice(0,400)}`)

// Simple extraction for display
const extractCAGR = text => {
  for (const re of [/CAGR\s+(?:of\s+)?(\d+\.?\d*)\s*%/i, /(\d+\.?\d*)\s*%\s+CAGR/i]) {
    const m = text.match(re); if (m) { const v = parseFloat(m[1]); if (v>0.5&&v<60) return v }
  }; return null
}
const extractSize = text => {
  const m = text.match(/(?:USD|US\$|\$)\s*(\d[\d,]*\.?\d*)\s*(billion|bn)\b/i)
  if (m) { const v = parseFloat(m[1].replace(/,/g,'')); if (v>0&&v<100000) return v }; return null
}

const cagrs = [], sizes = []
for (const r of allResults) {
  const text = r.title + ' ' + r.content
  const cagr = extractCAGR(text); if (cagr) cagrs.push({ value: cagr, source: domain(r.url) })
  const size = extractSize(text); if (size) sizes.push({ value: size, source: domain(r.url) })
}

console.log(`  CAGR estimates: ${cagrs.map(c => `${c.value}% (${c.source})`).join(', ') || 'none'}`)
console.log(`  Market size estimates: ${sizes.map(s => `$${s.value}bn (${s.source})`).join(', ') || 'none'}`)
console.log()

// 3. Gemini synthesis
console.log('Step 2: Gemini synthesis...')
const t1 = Date.now()
const genai = new GoogleGenerativeAI(GEMINI_KEY)
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

const prompt = `You are a market research analyst. Synthesise the following retrieved market data about "${SECTOR}" in "${GEOGRAPHY}" into a clean JSON object. Pick the single most credible figure for each metric.

RAW SNIPPETS:
${raw_snippets.join('\n\n')}

Rules: Only use figures from the data above. Return null for any field you cannot source reliably.

Return ONLY this JSON:
{
  "cagr": { "value": number|null, "period": string|null, "source_name": string|null, "source_url": string|null },
  "market_size": { "value_usd_bn": number|null, "year": number|null, "source_name": string|null, "source_url": string|null },
  "ev_revenue": { "value": number|null, "context": string|null, "source_name": string|null, "source_url": string|null },
  "ev_ebitda": { "value": number|null, "context": string|null, "source_name": string|null, "source_url": string|null },
  "key_insight": string|null
}`

const geminiResult = await model.generateContent(prompt)
let text = geminiResult.response.text().trim()
if (text.includes('```')) { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) text = m[1].trim() }
const parsed = JSON.parse(text)
console.log(`  Gemini synthesis in ${((Date.now()-t1)/1000).toFixed(1)}s`)
console.log()
console.log('── Final result ──')
console.log(JSON.stringify(parsed, null, 2))

// 4. Write to cache
const upsert = await fetch(`${SUPABASE_URL}/rest/v1/market_context_cache`, {
  method: 'POST',
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ sector: SECTOR, geography: GEOGRAPHY, result: parsed, fetched_at: new Date().toISOString() }),
})
console.log(`\nCache write: ${upsert.ok ? '✓ written' : `✗ ${upsert.status}`}`)

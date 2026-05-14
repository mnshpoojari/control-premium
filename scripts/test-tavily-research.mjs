// scripts/test-tavily-research.mjs
// Run: TAVILY_API_KEY=tvly-xxx node scripts/test-tavily-research.mjs
// Or add TAVILY_API_KEY to .env.local and run with dotenv:
//   node -r dotenv/config scripts/test-tavily-research.mjs

import { tavily } from '@tavily/core'

const TAVILY_KEY = process.env.TAVILY_API_KEY
if (!TAVILY_KEY) {
  console.error('TAVILY_API_KEY not set. Add it to .env.local or pass as env var.')
  process.exit(1)
}

const SECTOR    = process.argv[2] ?? 'Fintech'
const GEOGRAPHY = process.argv[3] ?? 'India'

console.log(`── Tavily Market Research: ${SECTOR} × ${GEOGRAPHY} ──`)
console.log()

const client = tavily({ apiKey: TAVILY_KEY })

const queries = [
  `${GEOGRAPHY} ${SECTOR} market CAGR compound annual growth rate`,
  `${GEOGRAPHY} ${SECTOR} market size billion USD revenue`,
  `${SECTOR} ${GEOGRAPHY} EV revenue multiple EV EBITDA valuation`,
  `${GEOGRAPHY} ${SECTOR} startup funding investment venture capital 2024`,
  `${GEOGRAPHY} ${SECTOR} competitive landscape key players market`,
  `${GEOGRAPHY} ${SECTOR} market trends emerging opportunities 2024`,
]

const BLOCKED = new Set([
  'prnewswire.com','businesswire.com','globenewswire.com','digitaljournal.com',
  'dataintelo.com','factmr.com','futuremarketinsights.com','custommarketinsights.com',
])

function domain(url) {
  try { return new URL(url).hostname.replace('www.','') } catch { return '' }
}

console.log(`Running ${queries.length} parallel Tavily searches...`)
const start = Date.now()

const batches = await Promise.all(
  queries.map(async (q, i) => {
    try {
      const res = await client.search(q, { maxResults: 3, searchDepth: 'advanced', includeAnswer: false })
      const results = (res.results ?? []).filter(r => !BLOCKED.has(domain(r.url)))
      console.log(`  [${i+1}] "${q.slice(0,50)}..." → ${results.length} results`)
      return results
    } catch (e) {
      console.log(`  [${i+1}] failed: ${e.message}`)
      return []
    }
  })
)

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`\nCompleted in ${elapsed}s`)
console.log()

// Deduplicate
const seen = new Set()
const all = []
for (const batch of batches) {
  for (const r of batch) {
    if (!seen.has(r.url)) { seen.add(r.url); all.push(r) }
  }
}

console.log(`── Top results (${all.length} unique, by score) ──`)
all.sort((a,b) => b.score - a.score).slice(0, 5).forEach((r, i) => {
  console.log(`\n[${i+1}] ${r.title}`)
  console.log(`    ${r.url}`)
  console.log(`    Score: ${r.score.toFixed(3)}`)
  console.log(`    ${r.content.slice(0, 200)}...`)
})

// CAGR extraction
function extractCAGR(text) {
  const patterns = [
    /CAGR\s+(?:of\s+)?(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s+CAGR/i,
    /grow(?:ing|s|th)?\s+at\s+(?:a\s+)?(\d+\.?\d*)\s*%/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const v = parseFloat(m[1])
      if (v > 0.5 && v < 60) {
        const period = text.match(/20\d\d\s*[-–]\s*20\d\d/)?.[0] ?? null
        return { value: v, period }
      }
    }
  }
  return null
}

// Market size extraction
function extractSize(text) {
  const patterns = [
    /(?:USD|US\$|\$)\s*(\d[\d,]*\.?\d*)\s*(billion|bn)\b/i,
    /(\d[\d,]*\.?\d*)\s*(billion|bn)\s+(?:USD|US\$|\$)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const v = parseFloat(m[1].replace(/,/g,''))
      if (v > 0 && v < 100000) return { value_usd_bn: v }
    }
  }
  return null
}

console.log('\n── Extracted signals ──')
const cagrs = [], sizes = []
for (const r of all) {
  const text = r.title + ' ' + r.content
  const cagr = extractCAGR(text)
  const size = extractSize(text)
  if (cagr) cagrs.push({ ...cagr, source: domain(r.url) })
  if (size) sizes.push({ ...size, source: domain(r.url) })
}

console.log(`CAGR estimates (${cagrs.length}):`, cagrs.length ? JSON.stringify(cagrs, null, 2) : 'none found')
console.log(`Market size estimates (${sizes.length}):`, sizes.length ? JSON.stringify(sizes, null, 2) : 'none found')

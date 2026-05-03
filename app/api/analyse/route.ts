import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Parser from 'rss-parser'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const gemini = genai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> {
  const clean = text.trim()
  if (clean.includes('```')) {
    for (const block of clean.split('```')) {
      const stripped = block.replace(/^json\s*/, '').trim()
      try { return JSON.parse(stripped) } catch {}
    }
  }
  return JSON.parse(clean)
}

function nDaysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── Step 1: Parse thesis ───────────────────────────────────────────────────────

async function parseThesis(thesis: string) {
  const prompt = `Parse this investment thesis into structured components.
Return ONLY JSON, no explanation.

Thesis: "${thesis}"

{
  "sector": "match to one of: Healthcare IT, Climate Infrastructure, B2B SaaS, Fintech, Consumer Tech, Industrial Tech, Real Estate, Energy, Financial Services, Media & Entertainment, Retail & Consumer, Logistics & Supply Chain, Education Tech, Defence & Aerospace, Agriculture Tech, Other",
  "geography": "match to one of: United States, India, United Kingdom, Germany, France, Southeast Asia, Middle East, Australia, China, Other",
  "raw_query": "a clean 3-5 word description for Google News search"
}`

  const result = await gemini.generateContent(prompt)
  return extractJSON(result.response.text()) as {
    sector: string
    geography: string
    raw_query: string
  }
}

// ── Step 1b: Sector maturity classification ────────────────────────────────────

type Maturity = 'MATURE' | 'EMERGING' | 'NASCENT'

async function classifyMaturity(thesis: string, sector: string, geography: string): Promise<{ maturity: Maturity; reason: string }> {
  const prompt = `You are a senior investment analyst. Classify the maturity of this investment thesis based on your knowledge of how long this sector has been active in this geography, the depth of existing capital deployed, and how consolidated the market is.

Thesis: "${thesis}"
Sector: ${sector}
Geography: ${geography}

Return ONLY JSON:
{
  "maturity": "MATURE" | "EMERGING" | "NASCENT",
  "reason": "one sentence explaining the classification"
}

Guidelines:
- MATURE: sector has decades of established deal flow in this geography, large incumbents, well-understood by LPs and strategics (e.g. Oil in Saudi Arabia, US Healthcare M&A, European Financial Services)
- EMERGING: sector is active and growing but still developing its deal ecosystem in this geography, meaningful but not saturated (e.g. India SaaS, Southeast Asia Fintech, Africa Agritech)
- NASCENT: genuinely new theme, limited precedent transactions, buyer universe still forming (e.g. AI Infrastructure in MENA, Carbon Credits in LatAm)`

  try {
    const result = await gemini.generateContent(prompt)
    const parsed = extractJSON(result.response.text()) as { maturity: Maturity; reason: string }
    if (['MATURE', 'EMERGING', 'NASCENT'].includes(parsed.maturity)) return parsed
    return { maturity: 'EMERGING', reason: 'Could not classify' }
  } catch {
    return { maturity: 'EMERGING', reason: 'Could not classify' }
  }
}

// ── Step 2: Deal data from Google News RSS ────────────────────────────────────

interface NewsItem {
  title: string
  url: string
  published_date: string
  source: string
  pub: Date
}

async function fetchNewsItems(query: string): Promise<NewsItem[]> {
  try {
    const parser = new Parser({ timeout: 6000 })
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
    const feed = await parser.parseURL(url)
    return feed.items
      .filter(item => item.title && item.link)
      .map(item => {
        const pub = item.pubDate ? new Date(item.pubDate) : new Date()
        return {
          title: item.title!,
          url: item.link!,
          published_date: isoDate(pub),
          source: item.creator ?? extractDomain(item.link ?? ''),
          pub,
        }
      })
  } catch {
    return []
  }
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

const DEAL_KEYWORDS = [
  'acquires', 'acquired', 'acquisition', 'takes stake', 'majority stake', 'minority stake',
  'buyout', 'take private', 'merger', 'merges', 'carve-out', 'divestiture', 'divests',
  'strategic review', 'sale process', 'capital injection', 'going private',
  'spin-off', 'spins off', 'invested in', 'invests in', 'raises', 'funding round',
  'series a', 'series b', 'series c', 'growth equity', 'buys',
  'transaction', 'agreed to', 'agreement to', 'closes', 'completes acquisition',
]

// Patterns that indicate roundups, reports, or opinion pieces — not actual deals
const NOISE_PATTERNS = [
  'year in review', 'annual report', 'outlook for', 'predictions for', 'trends in',
  'state of', 'guide to', 'introduction to', 'overview of', 'history of',
  'what is', 'how to', 'why ', 'top 10', 'top 5', 'ranking', 'rankings',
  'podcast', 'webinar', 'conference', 'summit', 'award', 'awards',
  'interview', 'q&a', 'opinion:', 'column:', 'comment:', 'analysis:',
  'report:', 'weekly', 'monthly', 'quarterly review', 'market update',
]

function isDealArticle(title: string): boolean {
  const t = title.toLowerCase()
  if (NOISE_PATTERNS.some(p => t.includes(p))) return false
  return DEAL_KEYWORDS.some(kw => t.includes(kw))
}

async function getDealData(sector: string, geography: string, rawQuery: string) {
  const cutoff365 = nDaysAgo(365)
  const cutoff90 = nDaysAgo(90)
  const cutoff30 = nDaysAgo(30)

  const queries = [
    `"${rawQuery}" acquires OR acquired OR merger OR "takes stake" OR buyout`,
    `"${sector}" "${geography}" acquires OR acquired OR merger OR investment 2025 2026`,
    `"${rawQuery}" "funding round" OR "series" OR "growth equity" OR divestiture`,
  ]

  const batches = await Promise.all(queries.map(fetchNewsItems))

  const seen = new Set<string>()
  const items: NewsItem[] = []
  for (const batch of batches) {
    for (const item of batch) {
      if (!seen.has(item.url) && item.pub >= cutoff365) {
        seen.add(item.url)
        items.push(item)
      }
    }
  }

  const monthMap = new Map<string, number>()
  let count30d = 0
  let count90d = 0

  for (const item of items) {
    const d = item.pub
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    if (item.pub >= cutoff90) count90d++
    if (item.pub >= cutoff30) count30d++
  }

  const now = new Date()
  const chartData = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    chartData.push({
      month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      deal_count: monthMap.get(key) ?? 0,
    })
  }

  const sorted = [...items].sort((a, b) => b.pub.getTime() - a.pub.getTime())
  const dealItems = sorted.filter(item => isDealArticle(item.title))
  const evidence = dealItems.length >= 3 ? dealItems : sorted
  const recentItems = evidence.slice(0, 5).map(({ pub: _, ...rest }) => rest)

  return { chartData, recentItems, count30d, count90d }
}

// ── Step 3: Media mention count ────────────────────────────────────────────────

async function getMediaMentionCount(rawQuery: string): Promise<number> {
  try {
    const parser = new Parser({ timeout: 5000 })
    const query = encodeURIComponent(`${rawQuery} M&A acquisition investment`)
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`
    const feed = await parser.parseURL(url)
    const cutoff = nDaysAgo(90)
    return feed.items.filter(item => new Date(item.pubDate ?? 0) >= cutoff).length
  } catch {
    return 0
  }
}

// ── Step 4: Maturity-aware consensus score ─────────────────────────────────────

function calculateConsensusScore(
  dealCount90d: number,
  mediaCount90d: number,
  maturity: Maturity,
) {
  if (maturity === 'MATURE') {
    // For established sectors, the frame is entirely different.
    // Low volume ≠ undiscovered opportunity. It means steady-state or cooling.
    if (dealCount90d >= 5 && mediaCount90d >= dealCount90d * 0.5) {
      return {
        state: 'ACTIVE',
        colour: 'orange',
        explanation: 'Deal flow is running at a healthy pace for a mature sector. Competition for assets is real — pricing reflects that.',
      }
    } else if (dealCount90d >= 2) {
      return {
        state: 'ESTABLISHED',
        colour: 'green',
        explanation: 'A well-established sector with steady deal activity. The market is known and priced — edge comes from execution and relationships, not discovery.',
      }
    } else if (mediaCount90d >= 5) {
      return {
        state: 'NARRATIVE',
        colour: 'red',
        explanation: 'More commentary than transactions right now. The sector is well-understood but deal activity is below the level media interest would suggest.',
      }
    } else {
      return {
        state: 'COOLING',
        colour: 'grey',
        explanation: 'A mature sector seeing reduced deal activity. Cyclical pause, repricing, or consolidation fatigue — worth monitoring for re-entry timing.',
      }
    }
  }

  // EMERGING or NASCENT: original signal logic applies
  if (dealCount90d >= 3 && dealCount90d > mediaCount90d * 1.5) {
    return {
      state: 'EARLY SIGNAL',
      colour: 'green',
      explanation: "Deal activity in this space is outpacing media coverage — this theme hasn't fully entered the mainstream narrative yet.",
    }
  } else if (dealCount90d >= 3 && mediaCount90d >= dealCount90d * 0.8) {
    return {
      state: 'CONSENSUS',
      colour: 'yellow',
      explanation: 'This theme has broad market and media attention — the narrative is well-formed and most participants are already aware.',
    }
  } else if (dealCount90d < 3 && mediaCount90d >= 5) {
    return {
      state: 'HYPE',
      colour: 'red',
      explanation: 'Media coverage is running ahead of actual deal activity — interest may be outpacing real capital deployment.',
    }
  } else {
    return {
      state: 'QUIET',
      colour: 'grey',
      explanation: 'Limited deal activity and media coverage in this space — either very early stage or not yet an active theme.',
    }
  }
}

// ── Step 5: Gemini thesis ──────────────────────────────────────────────────────

async function generateThesis(params: {
  userInput: string
  consensusState: string
  maturity: Maturity
  maturityReason: string
  count30d: number
  count90d: number
  mediaCount90d: number
  recentItems: unknown[]
}): Promise<string> {
  const prompt = `You are a senior capital markets analyst writing for an audience of M&A advisors and fund managers.

Write a three-paragraph analytical thesis based on the following data. Your tone is FT Lex: sharp, opinionated, evidence-anchored. Never hedge excessively. Make a call.

Never use phrases like "it is worth noting", "it is important to consider", "overall", "confluence of factors", "nascent but accelerating", "underscores", "highlights", "juxtaposed".

Data:
- Thesis being evaluated: ${params.userInput}
- Sector maturity: ${params.maturity} (${params.maturityReason})
- Signal: ${params.consensusState}
- Deal count (last 30 days): ${params.count30d}
- Deal count (last 90 days): ${params.count90d}
- Media mentions (last 90 days): ${params.mediaCount90d}
- Recent news: ${JSON.stringify(params.recentItems)}

Paragraph 1 (3-4 sentences): Open with one plain sentence on how mature or new this sector is in this geography — no spin, just the obvious fact (e.g. "Saudi oil is a century-old industry dominated by Aramco and sovereign capital"). Then describe what the current deal flow data shows: volume trend, acceleration or deceleration. Reference specific numbers.

Paragraph 2 (3-4 sentences): What is driving this pattern? Draw on likely buyer types, macro tailwinds, sector dynamics, or geographic factors that explain the deal clustering.

Paragraph 3 (2-3 sentences): What should a deal professional do with this information? Be direct and actionable. Do not be vague.

Return only the three paragraphs. No headers, no bullet points, no preamble.`

  try {
    const result = await gemini.generateContent(prompt)
    const text = result.response.text().trim()
    if (text.length > 100) return text
    throw new Error('Response too short')
  } catch (err) {
    console.error('Gemini thesis error:', err)
    // Rich data-driven fallback
    const trend = params.count30d > (params.count90d - params.count30d) / 2
      ? 'accelerating — the most recent 30 days account for a disproportionate share of the 90-day total'
      : params.count30d === 0
        ? 'effectively stalled, with no recorded items in the last 30 days'
        : 'running at a broadly consistent pace across the quarter'
    const mediaVsDeals = params.mediaCount90d > params.count90d * 1.5
      ? 'Media coverage is running well ahead of transaction volume, suggesting narrative interest has outpaced actual capital deployment.'
      : params.count90d > params.mediaCount90d * 1.5
        ? 'Transaction activity is outpacing media coverage — this theme is moving faster than the press is reporting it.'
        : 'Transaction activity and media coverage are broadly in step, indicating the theme is well-tracked by market participants.'

    const maturityFrame = {
      MATURE: `This is an established market with deep historical precedent — the current data reflects a sector in steady state, not one being discovered.`,
      EMERGING: `This market is still building its deal ecosystem — the current numbers reflect a theme that is gaining traction rather than one already at scale.`,
      NASCENT: `This is an early-stage theme with limited transaction history — the data should be read as directional signal rather than established trend.`,
    }[params.maturity]

    const recentTitles = (params.recentItems as { title: string }[]).slice(0, 2).map(i => i.title)
    const evidenceLine = recentTitles.length > 0
      ? `Recent coverage includes: ${recentTitles.join('; ')}.`
      : 'No named transactions were surfaced in the most recent news scan.'

    const actionFrame = {
      MATURE: `In a mature market, the edge is in relationships and process — not in spotting the theme. Track whether deal velocity is accelerating relative to historical norms, and focus diligence on asset quality and pricing discipline.`,
      EMERGING: `The window to position ahead of consensus is narrowing. Prioritise sourcing over the next one to two quarters and track whether deal count continues to outpace media coverage — that gap is where alpha lives.`,
      NASCENT: `Move cautiously but deliberately. Identify the two or three most credible operators in this space and build relationships before the theme becomes crowded. Expect a long lead time before liquidity events.`,
    }[params.maturity]

    return [
      `${maturityFrame} Deal activity over the last 90 days stands at ${params.count90d} recorded items, with ${params.count30d} in the most recent 30 days — momentum is ${trend}.`,
      `${mediaVsDeals} ${evidenceLine} The ${params.consensusState} signal reflects where this thesis sits relative to the broader market's awareness.`,
      actionFrame,
    ].join('\n\n')
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { thesis } = await req.json()
    if (!thesis?.trim()) {
      return NextResponse.json({ error: 'thesis is required' }, { status: 400 })
    }

    // Step 1: parse thesis
    let sector = 'Other', geography = 'Other', raw_query = thesis
    try {
      const parsed = await parseThesis(thesis)
      sector = parsed.sector
      geography = parsed.geography
      raw_query = parsed.raw_query
    } catch {
      raw_query = thesis.slice(0, 60)
    }

    // Steps 1b + 2 + 3 in parallel
    const [maturityResult, { chartData, recentItems, count30d, count90d }, mediaCount90d] = await Promise.all([
      classifyMaturity(thesis, sector, geography),
      getDealData(sector, geography, raw_query),
      getMediaMentionCount(raw_query),
    ])

    // Step 4
    const consensus = calculateConsensusScore(count90d, mediaCount90d, maturityResult.maturity)

    // Step 5
    const thesisText = await generateThesis({
      userInput: thesis,
      consensusState: consensus.state,
      maturity: maturityResult.maturity,
      maturityReason: maturityResult.reason,
      count30d,
      count90d,
      mediaCount90d,
      recentItems,
    })

    return NextResponse.json({
      consensus,
      chart_data: chartData,
      stats: { count_30d: count30d, count_90d: count90d },
      thesis: thesisText,
      evidence: recentItems,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Analyse error:', message)
    return NextResponse.json({ error: 'Analysis failed', detail: message }, { status: 500 })
  }
}

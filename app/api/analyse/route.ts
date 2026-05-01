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

async function getDealData(sector: string, geography: string, rawQuery: string) {
  const cutoff365 = nDaysAgo(365)
  const cutoff90 = nDaysAgo(90)
  const cutoff30 = nDaysAgo(30)

  // Fetch from multiple complementary queries in parallel
  const queries = [
    `"${rawQuery}" acquisition OR buyout OR "takes stake"`,
    `"${sector}" "${geography}" acquisition OR merger 2025`,
    `"${sector}" "private equity" OR "strategic acquisition" 2025`,
  ]

  const batches = await Promise.all(queries.map(fetchNewsItems))

  // Deduplicate by URL
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

  // Bucket by month
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

  // Build 12-month chart array
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

  // Top 5 most recent as evidence
  const recentItems = [...items]
    .sort((a, b) => b.pub.getTime() - a.pub.getTime())
    .slice(0, 5)
    .map(({ pub: _, ...rest }) => rest)

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

// ── Step 4: Consensus score ────────────────────────────────────────────────────

function calculateConsensusScore(dealCount90d: number, mediaCount90d: number) {
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

// ── Step 5: Gemini thesis (with fallback) ─────────────────────────────────────

async function generateThesis(params: {
  userInput: string
  consensusState: string
  count30d: number
  count90d: number
  mediaCount90d: number
  recentItems: unknown[]
}): Promise<string> {
  const prompt = `You are a senior capital markets analyst writing for an audience of M&A advisors and fund managers.

Write a three-paragraph analytical thesis based on the following data. Your tone is FT Lex: sharp, opinionated, evidence-anchored. Never hedge excessively. Make a call.

Never use phrases like "it is worth noting", "it is important to consider", or "overall".

Data:
- Thesis being evaluated: ${params.userInput}
- Consensus score: ${params.consensusState}
- Deal count (last 30 days): ${params.count30d}
- Deal count (last 90 days): ${params.count90d}
- Media mentions (last 90 days): ${params.mediaCount90d}
- Recent news: ${JSON.stringify(params.recentItems)}

Paragraph 1 (3-4 sentences): What does this data show? Describe the volume trend and whether activity is accelerating or decelerating. Reference specific numbers.

Paragraph 2 (3-4 sentences): What is driving this pattern? Draw on likely buyer types, macro tailwinds, sector dynamics, or geographic factors that explain the deal clustering.

Paragraph 3 (2-3 sentences): What should a deal professional do with this information? Be direct and actionable. Do not be vague.

Return only the three paragraphs. No headers, no bullet points, no preamble.`

  try {
    const result = await gemini.generateContent(prompt)
    return result.response.text().trim()
  } catch {
    // Fallback when Gemini billing is not active
    const trend = params.count30d > params.count90d / 3 ? 'accelerating' : 'steady'
    return [
      `${params.count90d} news items tracked in the last 90 days for this thesis, with ${params.count30d} in the most recent 30 days — activity is ${trend}. Media coverage stands at ${params.mediaCount90d} mentions over the same 90-day window.`,
      `The ${params.consensusState} signal suggests ${params.consensusState === 'EARLY SIGNAL' ? 'deal activity is outpacing mainstream coverage — this theme has not yet been fully priced in by the market' : params.consensusState === 'HYPE' ? 'media interest is running ahead of actual transactions — caution is warranted' : 'this theme is broadly recognised across market participants'}.`,
      `Monitor the evidence items below for named buyers and targets. If activity continues at this pace, expect increased competition for assets in this space over the next two quarters.`,
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

    // Step 1: parse thesis — if Gemini fails, do basic extraction
    let sector = 'Other', geography = 'Other', raw_query = thesis
    try {
      const parsed = await parseThesis(thesis)
      sector = parsed.sector
      geography = parsed.geography
      raw_query = parsed.raw_query
    } catch {
      // Use the raw thesis as the search query
      raw_query = thesis.slice(0, 60)
    }

    // Steps 2 + 3 in parallel
    const [{ chartData, recentItems, count30d, count90d }, mediaCount90d] = await Promise.all([
      getDealData(sector, geography, raw_query),
      getMediaMentionCount(raw_query),
    ])

    // Step 4
    const consensus = calculateConsensusScore(count90d, mediaCount90d)

    // Step 5
    const thesisText = await generateThesis({
      userInput: thesis,
      consensusState: consensus.state,
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

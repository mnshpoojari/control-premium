import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Parser from 'rss-parser'

export const maxDuration = 60

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const gemini = genai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

// ── Feeds ──────────────────────────────────────────────────────────────────────

const TIER_1_FEEDS = [
  'https://www.altassets.net/feed',
  'https://www.pehub.com/feed',
  'https://www.privateequityinternational.com/feed',
  'https://www.buyoutsinsider.com/feed',
  'https://www.privateequitywire.co.uk/feed',
  'https://www.dealstreetasia.com/feed',
  'https://www.vccircle.com/feed',
  'https://e27.co/feed',
  'https://www.finsmes.com/feed',
]

const TIER_2_FEEDS = [
  'https://feeds.reuters.com/reuters/businessNews',
  'https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml',
  'https://www.axios.com/feeds/feed/markets.xml',
  'https://www.businesswire.com/rss/home/?rss=g22',
  'https://www.prnewswire.com/rss/news-releases-list.rss',
  'https://www.arabianbusiness.com/rss',
  'https://economictimes.indiatimes.com/markets/rss.cms',
]

const TIER_3_QUERIES = [
  'private equity acquisition 2025',
  'M&A deal acquisition majority stake 2025',
  'strategic acquisition buyout 2025',
  'take private deal 2025',
  '"sovereign wealth fund" OR "family office" acquisition 2025',
  '"private equity" OR "growth equity" investment stake 2025',
]

const DEAL_KEYWORDS = [
  'acquires', 'acquisition', 'takes stake', 'majority stake',
  'buyout', 'take private', 'merger', 'carve-out', 'divestiture',
  'strategic review', 'sale process', 'capital injection',
  'going private', 'spin-off', 'invested in', 'portfolio company',
]

// ── Supabase helpers ───────────────────────────────────────────────────────────

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  }
}

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() })
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sbUpsert(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`Supabase upsert ${res.status}: ${await res.text()}`)
}

// ── Feed fetching ──────────────────────────────────────────────────────────────

interface RawItem {
  title: string
  url: string
  source: string
  pub: Date
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

function hasDealKeyword(text: string): boolean {
  const t = text.toLowerCase()
  return DEAL_KEYWORDS.some(kw => t.includes(kw))
}

async function fetchFeed(url: string, requireDealKeyword: boolean): Promise<RawItem[]> {
  try {
    const parser = new Parser({ timeout: 6000 })
    const feed = await parser.parseURL(url)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return feed.items
      .filter(item => item.title && item.link)
      .filter(item => !requireDealKeyword || hasDealKeyword(item.title!))
      .map(item => ({
        title: item.title!,
        url: item.link!,
        source: feed.title ?? extractDomain(item.link!),
        pub: item.pubDate ? new Date(item.pubDate) : new Date(),
      }))
      .filter(item => item.pub >= cutoff)
  } catch {
    return []
  }
}

async function fetchAllItems(): Promise<RawItem[]> {
  const feeds: [string, boolean][] = [
    ...TIER_1_FEEDS.map(u => [u, false] as [string, boolean]),
    ...TIER_2_FEEDS.map(u => [u, true] as [string, boolean]),
    ...TIER_3_QUERIES.map(q => [
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
      false,
    ] as [string, boolean]),
  ]

  const batches = await Promise.all(feeds.map(([url, req]) => fetchFeed(url, req)))

  const seen = new Set<string>()
  const items: RawItem[] = []
  for (const batch of batches) {
    for (const item of batch) {
      if (!seen.has(item.url)) {
        seen.add(item.url)
        items.push(item)
      }
    }
  }

  // Sort by recency, cap at 80 items
  return items
    .sort((a, b) => b.pub.getTime() - a.pub.getTime())
    .slice(0, 80)
}

// ── Recurring story tracking ───────────────────────────────────────────────────

async function getPreviousSeenUrls(): Promise<Map<string, number>> {
  try {
    const rows: { seen_urls: string[] }[] = await sbGet(
      'daily_briefs?select=seen_urls&order=date.desc&limit=7'
    )
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const url of (row.seen_urls ?? [])) {
        counts.set(url, (counts.get(url) ?? 0) + 1)
      }
    }
    return counts
  } catch {
    return new Map()
  }
}

// ── Gemini brief generation ────────────────────────────────────────────────────

const BRIEF_SYSTEM_PROMPT = `You are a senior capital markets analyst writing a daily market intelligence brief for sophisticated investors and operators. Synthesise what happened today across capital flows and ownership change, surface what matters beneath the surface, and tell readers what to think about — not what to think.

The brief must have exactly these sections in this order:

**Executive Summary**
4 to 6 sentences answering: what stood out today, where activity is forming rather than closing, what feels structurally important, and what this implies about risk appetite or capital dynamics. Lead with the sharpest observation.

**Confirmed Transactions**
Only announced or clearly progressing deals. For each deal:
- A 2 to 3 sentence deal snapshot covering the asset, parties, structure, size and sector.
- 2 to 3 sentences on why it matters — say something not obvious from the headline.
- A "So what" paragraph of 2 to 3 sentences drawing out what the deal reveals about the sector, capital environment, or ownership dynamic. Goal is to illuminate the implication, not prescribe action.
Include the deal URL on its own line immediately after the deal snapshot, unmodified.

**Situations to Watch**
Signals, not certainty. Strategic reviews, companies exploring options, activist pressure, balance sheet stress, refinancing risk, regulatory overhangs. For each: why this could evolve into a transaction or control shift, and what specific developments would confirm or weaken the thesis.
Include the URL on its own line after each item.

**Regulatory and Market Intelligence**
Developments shaping the transaction environment even when no deal is imminent. Regulation, antitrust, policy, fundraising signals, financing conditions, macro developments with direct capital implications. For each: what happened stated plainly, and how it changes the math on transactions or ownership.
Include the URL on its own line after each item.

**Sector Heatmap**
Qualitative and directional, not quantitative. Four categories: Building momentum, Steady activity, Pressure or transition, Quiet or noise only. Each sector gets one clean standalone sentence. Sector names bolded at the start of the sentence, nothing else bolded. No bullets or lists anywhere in this section.

**Closing Take**
2 to 3 sentences synthesising the dominant themes across today's activity into one directional paragraph. No new ideas. Write what today's pattern reveals about where capital is moving and why. Like a trader's morning note: direct, forward-looking, no filler.

WRITING RULES:
- Write like a senior analyst who reads the FT before breakfast. Terse, direct, confident. Active verbs. Each paragraph leads with the point — first sentence carries the weight, the rest add context. No throat-clearing.
- Banned words and phrases: "narrative," "landscape," "lens," "prism," "toolkit," "ecosystem," "paradigm," "trajectory," "increasingly," "potentially," "it remains to be seen," "through the lens of," "suggests a maturing," "remains unresolved."
- No separator lines, dashes, bullets, asterisks, or list symbols anywhere in the output except where specified. Section headers only may be bolded. Sentence case for all sub-headings. One idea per paragraph. Clean spacing.
- Every deal item that has a URL must include that full URL in the output, on its own line, unmodified. Do not shorten, rewrite, or replace URLs with homepage links. Never drop a URL for formatting reasons.
- ONGOING items: only include if there is genuinely new information — a new stakeholder, a regulatory decision, a financing change, a timeline update. If nothing new, mention it once in the Executive Summary as ongoing and skip the full section treatment. When included, open with: "UPDATE: [what changed since last report]."

Return only the brief. No preamble, no closing remarks.`

async function generateBrief(items: RawItem[], previousSeen: Map<string, number>): Promise<string> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const itemsText = items.map((item, i) => {
    const mentions = previousSeen.get(item.url) ?? 0
    const status = mentions > 0 ? 'ONGOING' : 'NEW'
    const lines = [
      `[${i + 1}] STATUS: ${status} | MENTIONS: ${mentions + 1}`,
      `Title: ${item.title}`,
      `Source: ${item.source}`,
      `Date: ${item.pub.toISOString().split('T')[0]}`,
      `URL: ${item.url}`,
    ]
    return lines.join('\n')
  }).join('\n\n')

  const prompt = `${BRIEF_SYSTEM_PROMPT}

Today's date: ${today}

NEWS ITEMS:

${itemsText}`

  const result = await gemini.generateContent(prompt)
  return result.response.text().trim()
}

// ── Handler ────────────────────────────────────────────────────────────────────

async function run() {
  const [items, previousSeen] = await Promise.all([
    fetchAllItems(),
    getPreviousSeenUrls(),
  ])

  if (items.length === 0) {
    return NextResponse.json({ error: 'No news items found' }, { status: 422 })
  }

  const content = await generateBrief(items, previousSeen)
  const seenUrls = items.map(i => i.url)
  const today = new Date().toISOString().split('T')[0]

  await sbUpsert('daily_briefs', {
    date: today,
    content,
    generated_at: new Date().toISOString(),
    seen_urls: seenUrls,
  })

  return NextResponse.json({ date: today, content })
}

export async function GET() {
  return run()
}

export async function POST() {
  return run()
}

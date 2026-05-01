import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

export const maxDuration = 60

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Feeds ──────────────────────────────────────────────────────────────────────

// PE/VC specialist publications — highest signal density
const TIER_1_FEEDS = [
  'https://www.altassets.net/feed',
  'https://www.pehub.com/feed',
  'https://www.privateequityinternational.com/feed',
  'https://www.buyoutsinsider.com/feed',
  'https://www.privateequitywire.co.uk/feed',
  // Asia-Pacific
  'https://www.dealstreetasia.com/feed',
  'https://www.vccircle.com/feed',         // India
  'https://e27.co/feed',                    // Southeast Asia
  'https://kr.asia/feed',                   // Korea/Northeast Asia
  'https://www.techinasia.com/feed',        // Southeast/East Asia
  'https://inc42.com/feed',                 // India startup deals
  // Africa & Middle East
  'https://techcabal.com/feed/',            // West Africa tech
  'https://disrupt-africa.com/feed/',       // Pan-Africa
  'https://venturesafrica.com/feed/',       // Pan-Africa
  'https://www.wamda.com/feed',             // MENA startups
  // Latin America
  'https://contxto.com/en/feed/',           // Latin America tech deals
  // Wire services — deal announcements
  'https://www.finsmes.com/feed',
  'https://www.globenewswire.com/RssFeed/subjectcode/14-Mergers%20Acquisitions', // GlobeNewswire M&A
]

// General business / broad geography coverage
const TIER_2_FEEDS = [
  'https://feeds.reuters.com/reuters/businessNews',
  'https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml',
  'https://www.axios.com/feeds/feed/markets.xml',
  'https://www.businesswire.com/rss/home/?rss=g22',
  'https://www.prnewswire.com/rss/news-releases-list.rss',
  'https://www.arabianbusiness.com/rss',
  'https://economictimes.indiatimes.com/markets/rss.cms',
  'https://www.livemint.com/rss/deals',                          // India deals
  'https://www.theedgesingapore.com/rss.xml',                    // Singapore/SEA
  'https://www.scmp.com/rss/91/feed',                            // South China Morning Post
  'https://african.business/feed/',                              // African Business Magazine
  'https://www.menafy.com/rss/',                                 // MENA finance
  'https://www.financialnews.com/feed/',                         // European finance
  'https://www.cityam.com/feed/',                                // UK deals
]

// Google News queries — fills gaps by geography and sector
const TIER_3_QUERIES = [
  // Core deal types
  'private equity acquisition 2026',
  'majority stake acquisition 2026',
  'take private deal 2026',
  '"sovereign wealth fund" acquisition stake 2026',
  // North America
  'strategic acquisition United States 2026',
  'private equity buyout Canada 2026',
  // Europe
  'private equity buyout Europe 2026',
  'acquisition Germany OR France OR Netherlands 2026',
  'private equity buyout UK 2026',
  // South & Southeast Asia
  'M&A deal India 2026',
  'acquisition Singapore OR Malaysia OR Indonesia 2026',
  'private equity Vietnam OR Thailand OR Philippines 2026',
  // Northeast Asia
  'private equity acquisition Japan 2026',
  'M&A deal South Korea 2026',
  // Middle East & Africa
  'private equity Middle East OR UAE OR Saudi Arabia 2026',
  'acquisition Africa OR Nigeria OR Kenya OR South Africa 2026',
  // Latin America
  'private equity acquisition Brazil OR Mexico 2026',
  'M&A deal "Latin America" 2026',
  // Sector-specific
  '"climate infrastructure" OR "energy transition" acquisition 2026',
  '"fintech" OR "financial technology" acquires OR "takes stake" 2026',
  '"healthtech" OR "digital health" acquisition OR buyout 2026',
  '"SaaS" OR "B2B software" private equity buyout 2026',
  '"logistics" OR "supply chain" acquisition stake 2026',
  '"agritech" OR "agriculture" acquisition OR investment 2026',
  '"defence" OR "aerospace" acquisition 2026',
  '"real estate" OR "proptech" private equity 2026',
]

const DEAL_KEYWORDS = [
  'acquires', 'acquisition', 'takes stake', 'majority stake',
  'buyout', 'take private', 'merger', 'carve-out', 'divestiture',
  'strategic review', 'sale process', 'capital injection',
  'going private', 'spin-off', 'invested in', 'portfolio company',
]

const SECTOR_KEYWORDS: Record<string, string[]> = {
  'Healthcare IT': [
    'healthcare', 'health care', 'hospital', 'medical', 'pharma', 'pharmaceutical',
    'biotech', 'healthtech', 'health tech', 'digital health', 'health IT', 'medtech',
    'telehealth', 'telemedicine', 'health software', 'clinical', 'life sciences',
    'health data', 'medical device', 'diagnostics',
  ],
  'Climate Infrastructure': [
    'climate', 'clean energy', 'renewable', 'solar', 'wind', 'energy transition',
    'green infrastructure', 'net zero', 'cleantech', 'clean tech', 'electric vehicle',
    'EV', 'battery', 'green hydrogen', 'decarbonisation', 'decarbonization',
    'sustainability', 'carbon', 'offshore wind', 'photovoltaic',
  ],
  'B2B SaaS': [
    'software', 'SaaS', 'enterprise software', 'cloud software', 'B2B software',
    'tech company', 'technology company', 'software company', 'platform',
    'HR tech', 'hrtech', 'martech', 'marketing tech', 'CRM', 'ERP',
    'workflow', 'automation software', 'cloud platform',
  ],
  'Fintech': [
    'fintech', 'financial technology', 'payments', 'payment', 'digital banking',
    'insurtech', 'neobank', 'lending', 'wealthtech', 'wealth tech', 'regtech',
    'open banking', 'embedded finance', 'payment processing', 'digital payments',
    'insurance tech', 'financial software',
  ],
  'Consumer Tech': [
    'consumer tech', 'e-commerce', 'ecommerce', 'online marketplace', 'marketplace',
    'retail tech', 'food tech', 'travel tech', 'direct-to-consumer', 'DTC',
    'consumer platform', 'digital consumer',
  ],
  'Logistics & Supply Chain': [
    'logistics', 'supply chain', 'freight', 'shipping', 'last-mile', 'warehouse',
    'fulfillment', 'fulfilment', 'fleet', '3PL', 'cold chain', 'distribution',
    'transport', 'trucking', 'cargo',
  ],
  'Industrial Tech': [
    'industrial', 'manufacturing', 'robotics', 'factory', 'automation',
    'industrial IoT', 'smart factory', 'process automation', 'machinery',
    'industrial software', 'engineering firm',
  ],
  'Real Estate': [
    'real estate', 'property', 'proptech', 'REIT', 'commercial real estate',
    'data centre', 'data center', 'infrastructure fund', 'housing',
    'residential', 'office space', 'retail property',
  ],
  'Energy': [
    'oil', 'gas', 'energy', 'power generation', 'utilities', 'LNG',
    'natural gas', 'midstream', 'upstream', 'downstream', 'petroleum',
    'oil field', 'energy company', 'power plant',
  ],
  'Financial Services': [
    'asset management', 'investment management', 'wealth management',
    'reinsurance', 'financial services', 'fund manager', 'bank', 'banking',
    'insurance', 'pension', 'hedge fund', 'private credit',
  ],
  'Education Tech': [
    'edtech', 'education tech', 'education technology', 'online learning',
    'e-learning', 'skills platform', 'learning management', 'tutoring',
    'training platform', 'higher education',
  ],
  'Defence & Aerospace': [
    'defence', 'defense', 'aerospace', 'satellite', 'space tech', 'space company',
    'cybersecurity', 'cyber security', 'military', 'government tech', 'govtech',
    'intelligence', 'surveillance',
  ],
  'Agriculture Tech': [
    'agritech', 'agtech', 'agriculture', 'farming', 'precision farming',
    'vertical farming', 'smart farming', 'food production', 'crop',
    'agricultural', 'animal health',
  ],
  'Media & Entertainment': [
    'media', 'entertainment', 'streaming', 'gaming', 'sports', 'content',
    'publishing', 'broadcast', 'film', 'music', 'podcast', 'esports',
  ],
  'Retail & Consumer': [
    'retail', 'consumer goods', 'FMCG', 'fashion', 'beauty', 'food and beverage',
    'F&B', 'consumer brand', 'lifestyle', 'luxury', 'grocery', 'supermarket',
  ],
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hasDealKeyword(text: string): boolean {
  const t = text.toLowerCase()
  return DEAL_KEYWORDS.some(kw => t.includes(kw))
}

function classifySectors(text: string): string[] {
  const t = text.toLowerCase()
  return Object.entries(SECTOR_KEYWORDS)
    .filter(([, kws]) => kws.some(kw => t.includes(kw.toLowerCase())))
    .map(([sector]) => sector)
}

interface FeedItem { sectors: string[]; pub: Date }

async function fetchFeedItems(url: string, requireDealKeyword: boolean): Promise<FeedItem[]> {
  try {
    const parser = new Parser({ timeout: 6000 })
    const feed = await parser.parseURL(url)
    const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const items: FeedItem[] = []
    for (const item of feed.items) {
      if (!item.title) continue
      if (requireDealKeyword && !hasDealKeyword(item.title)) continue
      const sectors = classifySectors(item.title)
      if (!sectors.length) continue
      const pub = item.pubDate ? new Date(item.pubDate) : new Date()
      if (pub < cutoff90) continue
      items.push({ sectors, pub })
    }
    return items
  } catch {
    return []
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET() {
  const feeds: [string, boolean][] = [
    ...TIER_1_FEEDS.map(u => [u, true] as [string, boolean]),
    ...TIER_2_FEEDS.map(u => [u, true] as [string, boolean]),
    ...TIER_3_QUERIES.map(q => [
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
      false,
    ] as [string, boolean]),
  ]

  const batches = await Promise.all(feeds.map(([url, req]) => fetchFeedItems(url, req)))

  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Accumulate counts per sector
  const counts: Record<string, { count_30d: number; count_90d: number }> = {}
  for (const items of batches) {
    for (const { sectors, pub } of items) {
      for (const sector of sectors) {
        if (!counts[sector]) counts[sector] = { count_30d: 0, count_90d: 0 }
        counts[sector].count_90d++
        if (pub >= cutoff30) counts[sector].count_30d++
      }
    }
  }

  const now = new Date().toISOString()
  const rows = Object.entries(counts).map(([sector, { count_30d, count_90d }]) => ({
    sector,
    count_30d,
    count_90d,
    explanation: `${count_30d} deals tracked in the last 30 days.`,
    updated_at: now,
  }))

  await fetch(`${SUPABASE_URL}/rest/v1/sector_trends`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })

  return NextResponse.json({ refreshed: rows.length, at: now })
}

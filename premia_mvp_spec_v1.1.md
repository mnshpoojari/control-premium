# Premia — MVP Product Specification
**Version MVP-1.1 | Claude Code Ready**
**Last updated: April 2026 | Updated: expanded data sources in Section 7**

---

## INSTRUCTIONS FOR CLAUDE CODE
Read this entire document before writing any code. This is the single source of truth for every decision. When in doubt, refer back here. Do not add features not described in this document. Do not make architectural decisions that contradict Section 6 (Tech Stack) or Section 5 (Data Architecture). Ask for clarification before deviating from anything in this spec.

---

## 1. What Premia MVP Is

Premia is a conviction engine for deal professionals. The MVP is a single-feature web app that answers one question:

**"I think [sector X] in [geography Y] is getting interesting. Am I early, on time, or late?"**

A user types a thesis into a text field. Premia queries its deal database, fetches media mention data from Google News, calculates a consensus score, renders a chart of deal volume over time, and returns a Gemini-written analytical thesis explaining what the data means.

That is the entire MVP. One interaction. Done properly.

**Live URL:** Will be deployed on Vercel. No login required for MVP. Anyone with the link can use it.

---

## 2. The Problem It Solves

Large firms publish sector reports 6–18 months after the signal was already visible in deal flow. By then the theme is consensus. A boutique M&A advisor or emerging fund manager who spots the clustering pattern before the narrative exists has a genuine edge.

Premia surfaces that signal. Specifically: it detects when deal activity in a sector is outpacing media coverage — the gap between what's happening and what's being written about is where the early signal lives.

---

## 3. Target User

- Boutique M&A advisors (2–10 person shops, no internal research team)
- Emerging fund managers ($50M–$500M funds, building or validating a thesis)
- Competitive dealmakers (corp dev, deal origination, sector-focused bankers)

They are busy. The product must deliver insight in under 10 seconds from input. Visual first, analytical second, evidence third.

---

## 4. The Single Feature: Conviction Validator

### User flow
1. User lands on Premia homepage
2. Sees a single text input field with placeholder: *"e.g. healthcare IT in India, climate infrastructure in the US, B2B SaaS in Southeast Asia"*
3. Types their thesis and hits Enter (or clicks Analyse)
4. Premia shows a loading state (under 10 seconds target)
5. Results page renders with four components (described below)

### Result components — in this exact order, top to bottom:

**Component 1: Consensus Score Badge**
A large, prominent visual badge. Four possible states:
- 🟢 EARLY SIGNAL — deal activity high, media coverage low
- 🟡 CONSENSUS — deal activity high, media coverage high
- 🔴 HYPE — media coverage high, deal activity low
- ⚫ QUIET — both low

Below the badge: one sentence explaining what the score means in plain English.
Example: *"Deal activity in this space is outpacing media coverage — this theme hasn't fully entered the mainstream narrative yet."*

**Component 2: Deal Volume Chart**
A line chart showing deal count per month for the last 12 months for this sector/geography cluster.
- X axis: months (last 12, labelled MMM YYYY)
- Y axis: number of deals
- If deal size data is available for any deals, render a second line in a different colour showing average deal size over the same period
- Chart library: Recharts (already in Next.js ecosystem)
- Below the chart: two stat chips — "X deals in last 30 days" and "X deals in last 90 days"

**Component 3: Gemini Analytical Thesis**
Three paragraphs. Tone: senior capital markets analyst, FT Lex register. Opinionated, evidence-anchored, not hedged.

Paragraph 1: What the data shows (volume trend, acceleration or deceleration)
Paragraph 2: What is driving this pattern (likely buyers, macro tailwinds, sector dynamics)
Paragraph 3: What a deal professional should do with this information (actionable, direct)

Gemini prompt instructions are in Section 7.

**Component 4: Evidence — Recent Transactions**
3–5 real deals from the database matching this cluster.
Each deal shows: target name (if available), buyer name (if available), deal type, geography, date, source link.
Label this section: "What's driving the signal"

### After results render:
- A "Search again" button that clears the input and returns to the home state
- A subtle footer line: "Premia analyses deal flow data and media coverage to surface emerging investment themes. Data updated every 24 hours."

---

## 5. Data Architecture

### Supabase — Deals Table

Create this table exactly as specified. Do not add or remove columns without instruction.

```sql
CREATE TABLE deals (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title               TEXT NOT NULL,
  url                 TEXT NOT NULL,
  source              TEXT,
  published_date      DATE,
  sector              TEXT,
  sub_sector          TEXT,
  geography           TEXT,
  buyer_name          TEXT,
  buyer_type          TEXT CHECK (buyer_type IN ('PE', 'Strategic', 'SWF', 'VC', 'Unknown')),
  target_name         TEXT,
  deal_size_usd       NUMERIC,
  deal_type           TEXT CHECK (deal_type IN ('Acquisition', 'Stake', 'Merger', 'Carve-out', 'IPO', 'Other')),
  status              TEXT DEFAULT 'NEW' CHECK (status IN ('NEW', 'ONGOING')),
  mention_count       INTEGER DEFAULT 1,
  deal_key            TEXT UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_sector ON deals(sector);
CREATE INDEX idx_deals_geography ON deals(geography);
CREATE INDEX idx_deals_published_date ON deals(published_date);
CREATE INDEX idx_deals_deal_key ON deals(deal_key);
```

### Deal Key (Deduplication)

The deal_key is a hash used to prevent the same deal appearing twice. Generate it as:

```python
import hashlib

def generate_deal_key(buyer_name, target_name, deal_type):
    raw = f"{(buyer_name or '').lower().strip()}-{(target_name or '').lower().strip()}-{(deal_type or '').lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()
```

If a deal_key already exists in the database, increment mention_count and update last_seen_at. Do not insert a duplicate row.

---

## 6. Tech Stack

Use exactly these technologies. Do not substitute without instruction.

```
Database:         Supabase (Postgres)
Backend:          Python 3.11+
AI — Tagging:     Claude API (model: claude-sonnet-4-20250514)
AI — Synthesis:   Gemini API (model: gemini-2.0-flash)
Frontend:         Next.js 14 (App Router) + Tailwind CSS
Charts:           Recharts
Deployment:       Vercel
Environment:      .env.local for all API keys (never hardcode keys)
```

### Required environment variables
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

---

## 7. Ingestion Pipeline (Python)

The ingestion pipeline is a Python script run manually (or on a cron) that:
1. Fetches RSS feeds from the sources listed below
2. Filters for deal-relevant items
3. Sends each item to Claude for classification
4. Generates a deal_key and checks for duplicates
5. Inserts new deals into Supabase

### Data sources — RSS feeds to fetch

**Tier 1 — Deal-specific (fetch all, highest signal):**
```
# Global PE / M&A
https://www.altassets.net/feed
https://www.pehub.com/feed
https://www.pehubnetwork.com/feed
https://www.privateequityinternational.com/feed
https://www.buyoutsinsider.com/feed
https://www.pe-insights.com/feed
https://www.mergermarket.com/feed
https://www.privateequitywire.co.uk/feed        # Europe-focused PE
https://www.unquote.com/feed                     # European mid-market

# Asia / Emerging Markets
https://www.dealstreetasia.com/feed              # Southeast Asia + India
https://www.vccircle.com/feed                    # India — best India-specific PE/M&A source
https://e27.co/feed                              # Singapore / SEA startups + deals

# Sector-specific
https://www.healthcareprivateequity.com/feed     # Healthcare PE
https://www.finsmes.com/feed                     # Fintech M&A
```

**Tier 2 — Broad financial (fetch, keyword filter before Claude):**
```
# Global
https://www.ft.com/rss/home/private-equity
https://feeds.reuters.com/reuters/businessNews
https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml
https://www.axios.com/feeds/feed/markets.xml
https://feeds.content.dowjones.io/public/rss/RSSMarketsMain

# Deal announcements (high precision — actual press releases)
https://www.businesswire.com/rss/home/?rss=g22
https://www.prnewswire.com/rss/news-releases-list.rss

# Middle East
https://www.arabianbusiness.com/rss
https://www.zawya.com/rss/feed                   # MENA deals — very strong signal

# India
https://economictimes.indiatimes.com/markets/rss.cms
```

**Tier 3 — Google News keyword queries (construct URL dynamically):**
Base URL: `https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en`

Run these queries:
```python
queries = [
    # Geographic — broad deal queries
    "private equity acquisition 2025",
    "M&A deal India 2025",
    "strategic acquisition United States 2025",
    "private equity buyout Europe 2025",
    "majority stake acquisition 2025",
    "take private deal 2025",
    "carve out divestiture 2025",
    "acquisition Singapore 2025",
    "private equity Middle East 2025",
    "acquisition Australia 2025",
    "M&A Japan 2025",
    "acquisition South Korea 2025",
    "private equity China 2025",
    "acquisition Africa 2025",
    "Brazil acquisition OR private equity 2025",    # Latin America — new

    # Sector-specific — surfaces deals broad queries miss
    '"climate infrastructure" OR "energy transition" acquisition 2025',
    '"fintech" OR "financial technology" acquires OR "takes stake" 2025',
    '"healthtech" OR "digital health" acquisition OR buyout 2025',
    '"SaaS" OR "B2B software" private equity buyout 2025',
    '"logistics" OR "supply chain" acquisition stake 2025',
    '"agritech" OR "agriculture technology" acquisition 2025',

    # Deal type specific
    '"growth equity" investment 2025',
    '"family office" acquisition 2025',
    '"sovereign wealth fund" acquisition stake 2025',
]
```

### Keyword filter (before sending to Claude)
Only send items to Claude if they contain at least one keyword from this list:
```python
DEAL_KEYWORDS = [
    "acquires", "acquisition", "takes stake", "majority stake",
    "buyout", "take private", "merger", "carve-out", "divestiture",
    "strategic review", "sale process", "capital injection",
    "going private", "spin-off", "invested in", "portfolio company"
]
```

### Claude classification prompt

Send each filtered item to Claude with this exact prompt:

```
You are a deal classification engine. Given the following news item, extract structured data.

News item:
Title: {title}
Description: {description}
Source: {source}
Date: {date}

Return ONLY a JSON object with these exact fields. If a field cannot be determined, use null.
Do not include any explanation or text outside the JSON.

{
  "sector": "string — one of: Healthcare IT, Climate Infrastructure, B2B SaaS, Fintech, Consumer Tech, Industrial Tech, Real Estate, Energy, Financial Services, Media & Entertainment, Retail & Consumer, Logistics & Supply Chain, Education Tech, Defence & Aerospace, Agriculture Tech, Other",
  "sub_sector": "string — more specific tag if determinable, else null",
  "geography": "string — primary country or region. Use: United States, India, United Kingdom, Germany, France, Southeast Asia, Middle East, Australia, China, Other",
  "buyer_name": "string or null",
  "buyer_type": "one of: PE, Strategic, SWF, VC, Unknown",
  "target_name": "string or null",
  "deal_size_usd": "number in USD millions or null if not reported",
  "deal_type": "one of: Acquisition, Stake, Merger, Carve-out, IPO, Other",
  "is_deal": true or false — is this actually a deal/transaction or just market commentary?
}
```

Only insert rows where `is_deal` is `true`.

---

## 8. Conviction Validator — Backend Logic

When a user submits a thesis, the backend must:

### Step 1: Parse the thesis with Claude

Send the raw thesis text to Claude:
```
Parse this investment thesis into structured components.
Return ONLY JSON, no explanation.

Thesis: "{user_input}"

{
  "sector": "match to one of the sector tags used in the deals database",
  "geography": "match to one of the geography tags used in the deals database",
  "raw_query": "a clean 3-5 word description for Google News search"
}
```

### Step 2: Query Supabase for deal data

```sql
-- Deal count by month for last 12 months
SELECT
  DATE_TRUNC('month', published_date) AS month,
  COUNT(*) AS deal_count,
  AVG(deal_size_usd) AS avg_deal_size_usd
FROM deals
WHERE
  sector ILIKE '%{sector}%'
  AND geography ILIKE '%{geography}%'
  AND published_date >= NOW() - INTERVAL '12 months'
GROUP BY month
ORDER BY month ASC;

-- Recent deals for evidence section
SELECT title, buyer_name, target_name, deal_type, geography, published_date, url, source
FROM deals
WHERE
  sector ILIKE '%{sector}%'
  AND geography ILIKE '%{geography}%'
  AND published_date >= NOW() - INTERVAL '90 days'
ORDER BY published_date DESC
LIMIT 5;

-- 30-day and 90-day counts for consensus score
SELECT
  COUNT(CASE WHEN published_date >= NOW() - INTERVAL '30 days' THEN 1 END) AS count_30d,
  COUNT(CASE WHEN published_date >= NOW() - INTERVAL '90 days' THEN 1 END) AS count_90d
FROM deals
WHERE
  sector ILIKE '%{sector}%'
  AND geography ILIKE '%{geography}%';
```

### Step 3: Fetch Google News media mention count

```python
import feedparser
import urllib.parse

def get_media_mention_count(raw_query: str, days: int = 90) -> int:
    """
    Fetch Google News RSS for the query and count articles in last N days.
    Returns article count as proxy for media coverage intensity.
    """
    query = urllib.parse.quote(f"{raw_query} M&A acquisition investment")
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    
    feed = feedparser.parse(url)
    
    cutoff = datetime.now() - timedelta(days=days)
    count = 0
    for entry in feed.entries:
        published = datetime(*entry.published_parsed[:6])
        if published >= cutoff:
            count += 1
    
    return count
```

### Step 4: Calculate consensus score

```python
def calculate_consensus_score(deal_count_90d: int, media_count_90d: int) -> dict:
    """
    Returns consensus state and explanation sentence.
    
    Logic:
    - EARLY SIGNAL:  deals >= 3 AND deal_count > media_count * 1.5
    - CONSENSUS:     deals >= 3 AND media_count >= deal_count * 0.8
    - HYPE:          deals < 3 AND media_count >= 5
    - QUIET:         deals < 3 AND media_count < 5
    """
    
    if deal_count_90d >= 3 and deal_count_90d > media_count_90d * 1.5:
        return {
            "state": "EARLY SIGNAL",
            "colour": "green",
            "explanation": "Deal activity in this space is outpacing media coverage — this theme hasn't fully entered the mainstream narrative yet."
        }
    elif deal_count_90d >= 3 and media_count_90d >= deal_count_90d * 0.8:
        return {
            "state": "CONSENSUS",
            "colour": "yellow",
            "explanation": "This theme has broad market and media attention — the narrative is well-formed and most participants are already aware."
        }
    elif deal_count_90d < 3 and media_count_90d >= 5:
        return {
            "state": "HYPE",
            "colour": "red",
            "explanation": "Media coverage is running ahead of actual deal activity — interest may be outpacing real capital deployment."
        }
    else:
        return {
            "state": "QUIET",
            "colour": "grey",
            "explanation": "Limited deal activity and media coverage in this space — either very early stage or not yet an active theme."
        }
```

### Step 5: Generate Gemini thesis

Send this prompt to Gemini:

```
You are a senior capital markets analyst writing for an audience of M&A advisors and fund managers.

Write a three-paragraph analytical thesis based on the following data. Your tone is FT Lex: sharp, opinionated, evidence-anchored. Never hedge excessively. Make a call.

Never use phrases like "it is worth noting", "it is important to consider", or "overall".

Data:
- Thesis being evaluated: {user_input}
- Consensus score: {consensus_state}
- Deal count (last 30 days): {count_30d}
- Deal count (last 90 days): {count_90d}
- Media mentions (last 90 days): {media_count_90d}
- Recent transactions: {recent_deals_json}

Paragraph 1 (3-4 sentences): What does this data show? Describe the volume trend and whether activity is accelerating or decelerating. Reference specific numbers.

Paragraph 2 (3-4 sentences): What is driving this pattern? Draw on likely buyer types, macro tailwinds, sector dynamics, or geographic factors that explain the deal clustering.

Paragraph 3 (2-3 sentences): What should a deal professional do with this information? Be direct and actionable. Do not be vague.

Return only the three paragraphs. No headers, no bullet points, no preamble.
```

### Step 6: Return to frontend

Return a single JSON object:
```json
{
  "consensus": {
    "state": "EARLY SIGNAL",
    "colour": "green",
    "explanation": "..."
  },
  "chart_data": [
    { "month": "May 2024", "deal_count": 2, "avg_deal_size": null },
    ...
  ],
  "stats": {
    "count_30d": 4,
    "count_90d": 11
  },
  "thesis": "Paragraph one text...\n\nParagraph two text...\n\nParagraph three text...",
  "evidence": [
    {
      "title": "...",
      "buyer_name": "...",
      "target_name": "...",
      "deal_type": "Acquisition",
      "geography": "India",
      "published_date": "2025-03-12",
      "url": "https://...",
      "source": "DealStreet Asia"
    }
  ]
}
```

---

## 9. Frontend Specification

### Pages
```
/          — Home page (thesis input)
/results   — Results page (rendered after submission)
```

No other pages needed for MVP.

### Design direction
- Dark background: #0A0A0F (near black)
- Accent colour: #C9A84C (gold — same as existing Premia brand)
- Text: #F5F5F0 (off-white)
- Card backgrounds: #13131A
- Font: Inter for body, a serif (Playfair Display or similar) for the Premia wordmark only
- The product should feel premium and serious. Not startup-bubbly. Not generic SaaS blue.

### Home page layout
```
[Premia wordmark — top left]

[Centred, vertically centred on screen:]
  Headline: "What's your thesis?"
  Subheadline: "Type a sector and geography. Premia tells you if you're early, on time, or late."
  
  [Text input — full width, large]
  placeholder: "e.g. healthcare IT in India, climate infrastructure in the US"
  
  [Analyse button — gold, full width below input]

[Footer: "Premia · Deal intelligence for deal professionals"]
```

### Results page layout (top to bottom)
```
[Back arrow + "New search" — top left]
[User's original thesis text — displayed as a subtitle]

[Consensus Score Badge — large, prominent, full width card]
  State label (EARLY SIGNAL / CONSENSUS / HYPE / QUIET)
  Explanation sentence beneath

[Deal Volume Chart — full width]
  Recharts LineChart
  30-day and 90-day stat chips below

[Gemini Thesis — full width card]
  Label: "What the data says"
  Three paragraphs

[Evidence section]
  Label: "What's driving the signal"
  3–5 deal cards, each showing:
    Target name | Buyer name | Deal type | Geography | Date | Source link
```

### Loading state
While results are being fetched, show:
- The user's thesis text
- An animated pulse on each of the four result sections
- Estimated time: "Analysing deal flow data..."
- Target: under 10 seconds total

---

## 10. API Route Structure (Next.js)

```
/api/analyse    POST    Accepts { thesis: string }
                        Runs Steps 1–5 from Section 8
                        Returns the JSON object from Step 6
```

All backend logic (Claude call, Supabase queries, Google News fetch, Gemini call) runs inside this single API route. Keep it in one file: `app/api/analyse/route.ts`

---

## 11. Build Order — Sprint by Sprint

### Sprint 1 — Data Foundation (Week 1)
Do not move to Sprint 2 until every item here is working.

- [ ] Supabase project created, deals table created with exact schema from Section 5
- [ ] Python ingestion script written and tested
- [ ] Script fetches from at least 3 Tier 1 RSS sources
- [ ] Keyword filter running before Claude classification
- [ ] Claude classifies deal items and returns valid JSON
- [ ] Deduplication logic working (deal_key hash, mention_count increment)
- [ ] At least 50 deals inserted into Supabase with correct sector/geography tags
- [ ] Manual query confirms: "SELECT sector, COUNT(*) FROM deals GROUP BY sector" returns sensible results

**Test before proceeding:** Run the ingestion script twice. Confirm no duplicate rows are created. Confirm sector tags look correct for 10 random rows.

---

### Sprint 2 — Backend Logic (Week 2)
Do not move to Sprint 3 until every item here is working.

- [ ] Next.js project scaffolded with Tailwind CSS
- [ ] Supabase client configured in Next.js
- [ ] `/api/analyse` route created
- [ ] Step 1: Claude parses thesis input into sector + geography tags
- [ ] Step 2: Supabase queries return correct deal data
- [ ] Step 3: Google News RSS fetch returns article count
- [ ] Step 4: Consensus score calculated correctly
- [ ] Step 5: Gemini generates three-paragraph thesis
- [ ] Step 6: Route returns complete JSON object

**Test before proceeding:** POST to `/api/analyse` with `{ thesis: "healthcare IT in India" }`. Confirm complete JSON response with all six components present. Test with 3 different thesis inputs.

---

### Sprint 3 — Frontend (Week 3)
Do not move to Sprint 4 until every item here is working.

- [ ] Home page renders correctly (wordmark, input, button)
- [ ] Input submits to `/api/analyse` and navigates to results
- [ ] Loading state shows during API call
- [ ] Consensus score badge renders with correct colour and state
- [ ] Recharts line chart renders with real data
- [ ] Stat chips (30d / 90d counts) display correctly
- [ ] Gemini thesis renders as three paragraphs
- [ ] Evidence section renders 3–5 deal cards with source links
- [ ] "New search" button works
- [ ] Design matches spec: dark background, gold accent, premium feel
- [ ] Deployed to Vercel and accessible at a public URL

**Test before proceeding:** Share the URL with one person outside the project. Ask them to input a thesis and describe what they see. Fix anything that confuses them.

---

## 12. What This MVP Is Not

Do not build these. They are in the full spec but not in the MVP.

- ❌ User accounts or login
- ❌ Stripe payments or pricing page
- ❌ Surge Feed / sector heat map
- ❌ Theme alerts or notifications
- ❌ User watchlists or saved searches
- ❌ HOT/WARMING/WATCH tags
- ❌ Export functionality
- ❌ Mobile app
- ❌ Email digest

---

## 13. First User Strategy

Once the Vercel URL is live and Sprint 3 is complete:

1. Test with 5 thesis inputs yourself. Confirm results feel credible and analytical.
2. Share with 3 trusted contacts in finance. Ask: "Would you use this before a sector pitch? What's missing?"
3. Email 5 boutique advisors from your target list. Subject: "Built something you might find useful before your next sector pitch — 30 seconds to try." Include the URL. No deck, no pitch, just the link.
4. Goal: 10 people have tried it within 2 weeks of launch. At least 3 say they'd pay for it.

---

*End of Premia MVP Specification v1.0*
*Paste this entire document at the start of every Claude Code session.*
*Do not modify this document mid-build without updating the version number.*

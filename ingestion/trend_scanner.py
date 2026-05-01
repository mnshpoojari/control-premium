"""
Premia trend scanner.
Fetches RSS feeds, uses keyword matching to count deal activity per sector,
and stores results in the sector_trends table in Supabase.

No AI calls — runs in seconds.

Usage:
    python ingestion/trend_scanner.py
"""

import json
import logging
import os
import urllib.parse
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import feedparser
from dotenv import load_dotenv
from supabase import create_client, Client

_root = Path(__file__).parent.parent
load_dotenv(_root / ".env.local")
load_dotenv(_root / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# ── Feed sources (same as ingest.py) ──────────────────────────────────────────

TIER_1_FEEDS = [
    "https://www.altassets.net/feed",
    "https://www.pehub.com/feed",
    "https://www.pehubnetwork.com/feed",
    "https://www.privateequityinternational.com/feed",
    "https://www.buyoutsinsider.com/feed",
    "https://www.pe-insights.com/feed",
    "https://www.mergermarket.com/feed",
    "https://www.privateequitywire.co.uk/feed",
    "https://www.unquote.com/feed",
    "https://www.dealstreetasia.com/feed",
    "https://www.vccircle.com/feed",
    "https://e27.co/feed",
    "https://www.healthcareprivateequity.com/feed",
    "https://www.finsmes.com/feed",
]

TIER_2_FEEDS = [
    "https://www.ft.com/rss/home/private-equity",
    "https://feeds.reuters.com/reuters/businessNews",
    "https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml",
    "https://www.axios.com/feeds/feed/markets.xml",
    "https://www.businesswire.com/rss/home/?rss=g22",
    "https://www.prnewswire.com/rss/news-releases-list.rss",
    "https://www.arabianbusiness.com/rss",
    "https://www.zawya.com/rss/feed",
    "https://economictimes.indiatimes.com/markets/rss.cms",
]

TIER_3_QUERIES = [
    "private equity acquisition 2025",
    "M&A deal India 2025",
    "strategic acquisition United States 2025",
    "private equity buyout Europe 2025",
    "majority stake acquisition 2025",
    "take private deal 2025",
    "acquisition Singapore 2025",
    "private equity Middle East 2025",
    '"climate infrastructure" OR "energy transition" acquisition 2025',
    '"fintech" OR "financial technology" acquires OR "takes stake" 2025',
    '"healthtech" OR "digital health" acquisition OR buyout 2025',
    '"SaaS" OR "B2B software" private equity buyout 2025',
    '"logistics" OR "supply chain" acquisition stake 2025',
    '"sovereign wealth fund" acquisition stake 2025',
]

DEAL_KEYWORDS = [
    "acquires", "acquisition", "takes stake", "majority stake",
    "buyout", "take private", "merger", "carve-out", "divestiture",
    "strategic review", "sale process", "capital injection",
    "going private", "spin-off", "invested in", "portfolio company",
]

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "Healthcare IT": [
        "healthcare", "health care", "hospital", "medical", "pharma", "pharmaceutical",
        "biotech", "healthtech", "health tech", "digital health", "health IT", "medtech",
        "telehealth", "telemedicine", "health software", "clinical", "life sciences",
        "health data", "medical device", "diagnostics",
    ],
    "Climate Infrastructure": [
        "climate", "clean energy", "renewable", "solar", "wind", "energy transition",
        "green infrastructure", "net zero", "cleantech", "clean tech", "electric vehicle",
        "EV", "battery", "green hydrogen", "decarbonisation", "decarbonization",
        "sustainability", "carbon", "offshore wind", "photovoltaic",
    ],
    "B2B SaaS": [
        "software", "SaaS", "enterprise software", "cloud software", "B2B software",
        "tech company", "technology company", "software company", "platform",
        "HR tech", "hrtech", "martech", "marketing tech", "CRM", "ERP",
        "workflow", "automation software", "cloud platform",
    ],
    "Fintech": [
        "fintech", "financial technology", "payments", "payment", "digital banking",
        "insurtech", "neobank", "lending", "wealthtech", "wealth tech", "regtech",
        "open banking", "embedded finance", "payment processing", "digital payments",
        "insurance tech", "financial software",
    ],
    "Consumer Tech": [
        "consumer tech", "e-commerce", "ecommerce", "online marketplace", "marketplace",
        "retail tech", "food tech", "travel tech", "direct-to-consumer", "DTC",
        "consumer platform", "digital consumer",
    ],
    "Logistics & Supply Chain": [
        "logistics", "supply chain", "freight", "shipping", "last-mile", "warehouse",
        "fulfillment", "fulfilment", "fleet", "3PL", "cold chain", "distribution",
        "transport", "trucking", "cargo",
    ],
    "Industrial Tech": [
        "industrial", "manufacturing", "robotics", "factory", "automation",
        "industrial IoT", "smart factory", "process automation", "machinery",
        "industrial software", "engineering firm",
    ],
    "Real Estate": [
        "real estate", "property", "proptech", "REIT", "commercial real estate",
        "data centre", "data center", "infrastructure fund", "housing",
        "residential", "office space", "retail property",
    ],
    "Energy": [
        "oil", "gas", "energy", "power generation", "utilities", "LNG",
        "natural gas", "midstream", "upstream", "downstream", "petroleum",
        "oil field", "energy company", "power plant",
    ],
    "Financial Services": [
        "asset management", "investment management", "wealth management",
        "reinsurance", "financial services", "fund manager", "bank", "banking",
        "insurance", "pension", "hedge fund", "private credit",
    ],
    "Education Tech": [
        "edtech", "education tech", "education technology", "online learning",
        "e-learning", "skills platform", "learning management", "tutoring",
        "training platform", "higher education",
    ],
    "Defence & Aerospace": [
        "defence", "defense", "aerospace", "satellite", "space tech", "space company",
        "cybersecurity", "cyber security", "military", "government tech", "govtech",
        "intelligence", "surveillance",
    ],
    "Agriculture Tech": [
        "agritech", "agtech", "agriculture", "farming", "precision farming",
        "vertical farming", "smart farming", "food production", "crop",
        "agricultural", "animal health",
    ],
    "Media & Entertainment": [
        "media", "entertainment", "streaming", "gaming", "sports", "content",
        "publishing", "broadcast", "film", "music", "podcast", "esports",
    ],
    "Retail & Consumer": [
        "retail", "consumer goods", "FMCG", "fashion", "beauty", "food and beverage",
        "F&B", "consumer brand", "lifestyle", "luxury", "grocery", "supermarket",
    ],
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def has_deal_keyword(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in DEAL_KEYWORDS)


def classify_sectors(text: str) -> list[str]:
    t = text.lower()
    return [sector for sector, kws in SECTOR_KEYWORDS.items() if any(kw.lower() in t for kw in kws)]


def parse_date(entry) -> Optional[datetime]:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        except Exception:
            pass
    return None


def fetch_feed(url: str) -> list[dict]:
    try:
        feed = feedparser.parse(url)
        items = [{"title": e.get("title", ""), "date": parse_date(e)} for e in feed.entries]
        log.info(f"Fetched {len(items):>3} items  ←  {url}")
        return items
    except Exception as e:
        log.warning(f"Feed failed  ←  {url}  ({e})")
        return []


def build_explanation(sector: str, count_30d: int, monthly: list[dict]) -> str:
    if len(monthly) >= 2:
        recent = monthly[-1]["count"]
        prior = monthly[-2]["count"]
        if prior == 0:
            trend = "picking up"
        elif recent >= prior * 1.4:
            trend = "accelerating"
        elif recent <= prior * 0.6:
            trend = "slowing"
        else:
            trend = "steady"
    else:
        trend = "active"
    return f"{count_30d} deals tracked in the last 30 days — {trend}."


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    log.info("Premia trend scanner — starting (no AI, keyword matching only)")

    now = datetime.now(timezone.utc)
    cutoff_90d = now - timedelta(days=90)
    cutoff_30d = now - timedelta(days=30)

    # Last 6 month keys: list of (year, month) tuples oldest → newest
    month_keys = []
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        month_keys.append((y, m))
    month_key_set = set(month_keys)

    # sector → counts
    counts: dict[str, dict] = defaultdict(lambda: {
        "count_30d": 0,
        "count_90d": 0,
        "monthly": defaultdict(int),
    })

    # Tier 1 + 2: apply deal keyword filter (mixed content)
    # Tier 3 Google News: skip deal filter — queries already guarantee deal content
    feed_batches: list[tuple[str, bool]] = (
        [(url, True) for url in TIER_1_FEEDS] +
        [(url, True) for url in TIER_2_FEEDS] +
        [(f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl=en-US&gl=US&ceid=US:en", False)
         for q in TIER_3_QUERIES]
    )

    for url, require_deal_keyword in feed_batches:
        for item in fetch_feed(url):
            if require_deal_keyword and not has_deal_keyword(item["title"]):
                continue
            sectors = classify_sectors(item["title"])
            if not sectors:
                continue

            item_date = item["date"] or now  # assume recent if no date
            for sector in sectors:
                if item_date >= cutoff_90d:
                    counts[sector]["count_90d"] += 1
                    ym = (item_date.year, item_date.month)
                    if ym in month_key_set:
                        counts[sector]["monthly"][ym] += 1
                if item_date >= cutoff_30d:
                    counts[sector]["count_30d"] += 1

    # Build results — filter noise
    results = []
    for sector, data in counts.items():
        if data["count_90d"] < 1:
            continue

        monthly_counts = [
            {"month": datetime(y, m, 1).strftime("%b %Y"), "count": data["monthly"].get((y, m), 0)}
            for y, m in month_keys
        ]

        results.append({
            "sector": sector,
            "count_30d": data["count_30d"],
            "count_90d": data["count_90d"],
            "monthly_counts": monthly_counts,
            "explanation": build_explanation(sector, data["count_30d"], monthly_counts),
            "updated_at": now.isoformat(),
        })

    results.sort(key=lambda x: x["count_30d"], reverse=True)

    log.info(f"Found {len(results)} active sectors")
    for r in results[:10]:
        log.info(f"  {r['sector']:<30} 30d: {r['count_30d']:>3}  90d: {r['count_90d']:>3}")

    for r in results:
        supabase.table("sector_trends").upsert(r, on_conflict="sector").execute()

    log.info(f"Upserted {len(results)} sectors to Supabase")


if __name__ == "__main__":
    main()

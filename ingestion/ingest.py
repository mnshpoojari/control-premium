"""
Premia ingestion pipeline.
Fetches RSS feeds, filters for deal items, classifies with Gemini, upserts into Supabase.

Token-efficient design:
- Items batched 50 per Gemini call (vs 1 per call in naive approach)
- Only titles sent — no descriptions
- Compact prompt with no verbose field explanations
- All tiers included; keyword pre-filter reduces Gemini calls further

Usage:
    python ingestion/ingest.py
"""

import hashlib
import json
import logging
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import feedparser
from google import genai
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

BATCH_SIZE = 50  # items per Gemini call — max reliable batch before output token limits

# ── API clients ────────────────────────────────────────────────────────────────

_gemini = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# ── Feed sources ───────────────────────────────────────────────────────────────

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
    # Legal / governance commentary — high signal for announced deals
    "https://corpgov.law.harvard.edu/feed/",
    # India exchange filings (BSE corporate announcements)
    "https://trendlyne.com/bse-corporate-announcements/feed/",
]

TIER_2_FEEDS = [
    "https://www.ft.com/rss/home/private-equity",
    "https://feeds.reuters.com/reuters/businessNews",
    "https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml",
    "https://www.axios.com/feeds/feed/markets.xml",
    "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
    "https://www.businesswire.com/rss/home/?rss=g22",
    "https://www.prnewswire.com/rss/news-releases-list.rss",
    "https://www.arabianbusiness.com/rss",
    "https://www.zawya.com/rss/feed",
    "https://economictimes.indiatimes.com/markets/rss.cms",
    # India M&A and GlobeNewswire PE press releases
    "https://www.business-standard.com/rss/companies-101.rss",
    "https://www.globenewswire.com/RssFeed/industry/9133-private-equity",
]

TIER_3_QUERIES = [
    "private equity acquisition 2026",
    "M&A deal India 2026",
    "strategic acquisition United States 2026",
    "private equity buyout Europe 2026",
    "majority stake acquisition 2026",
    "take private deal 2026",
    "carve out divestiture 2026",
    "acquisition Singapore 2026",
    "private equity Middle East 2026",
    "acquisition Australia 2026",
    "M&A Japan 2026",
    "acquisition South Korea 2026",
    "private equity China 2026",
    "acquisition Africa 2026",
    "Brazil acquisition OR private equity 2026",
    '"climate infrastructure" OR "energy transition" acquisition 2026',
    '"fintech" OR "financial technology" acquires OR "takes stake" 2026',
    '"healthtech" OR "digital health" acquisition OR buyout 2026',
    '"SaaS" OR "B2B software" private equity buyout 2026',
    '"logistics" OR "supply chain" acquisition stake 2026',
    '"agritech" OR "agriculture technology" acquisition 2026',
    '"growth equity" investment 2026',
    '"family office" acquisition 2026',
    '"sovereign wealth fund" acquisition stake 2026',
    # Formal deal language — picks up press-release-style announcements
    '"definitive agreement" acquisition 2026',
    '"binding offer" acquisition 2026',
    '"letter of intent" acquisition merger 2026',
    '"signs agreement" OR "completes acquisition" 2026',
    # India SEBI / exchange-level filings
    '"open offer" India SEBI 2026',
    '"preferential allotment" acquisition India 2026',
    '"block deal" India stake 2026',
    # Gulf sovereign wealth funds
    '"Mubadala" OR "ADIA" acquisition stake 2026',
    '"PIF" OR "Public Investment Fund" acquisition 2026',
    '"QIA" OR "Qatar Investment Authority" stake 2026',
    '"ADQ" OR "KIPCO" acquisition 2026',
]

DEAL_KEYWORDS = [
    "acquires", "acquisition", "takes stake", "majority stake",
    "buyout", "take private", "merger", "carve-out", "divestiture",
    "strategic review", "sale process", "capital injection",
    "going private", "spin-off", "invested in", "portfolio company",
]

BATCH_PROMPT_HEADER = """\
Classify each news item. Return a JSON array with exactly one object per item, in the same order.
IMPORTANT: Only extract information explicitly stated in the text. Use null rather than guessing.
Fields per object:
sector: one of [Healthcare IT, Climate Infrastructure, B2B SaaS, Fintech, Consumer Tech, Industrial Tech, Real Estate, Energy, Financial Services, Media & Entertainment, Retail & Consumer, Logistics & Supply Chain, Education Tech, Defence & Aerospace, Agriculture Tech, Other]
sub_sector: string or null
geography: one of [United States, India, United Kingdom, Germany, France, Southeast Asia, Middle East, Australia, China, Other]
buyer_name: string from text or null
buyer_type: one of [PE, Strategic, SWF, VC, Unknown]
target_name: string from text or null
deal_size_usd: number in USD millions only if explicitly stated, else null
deal_type: one of [Acquisition, Stake, Merger, Carve-out, IPO, Other]
is_deal: true if this is an actual transaction, false if commentary/analysis

Return ONLY the JSON array. No explanation.

Items:
"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def generate_deal_key(buyer_name: Optional[str], target_name: Optional[str], deal_type: Optional[str]) -> str:
    raw = f"{(buyer_name or '').lower().strip()}-{(target_name or '').lower().strip()}-{(deal_type or '').lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def has_deal_keyword(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in DEAL_KEYWORDS)


def parse_date(entry) -> Optional[str]:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            return datetime(*entry.published_parsed[:6]).strftime("%Y-%m-%d")
        except Exception:
            pass
    return None


def extract_json_array(text: str) -> list:
    text = text.strip()
    if "```" in text:
        for block in text.split("```"):
            block = block.strip().lstrip("json").strip()
            try:
                result = json.loads(block)
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                continue
    return json.loads(text)


def fetch_edgar_items() -> list[dict]:
    """Fetch recent 8-K M&A filings from SEC EDGAR full-text search API."""
    today = datetime.now(timezone.utc).date()
    start = (datetime.now(timezone.utc) - timedelta(days=30)).date()
    url = (
        "https://efts.sec.gov/LATEST/search-index?q=%22acquisition%22+OR+%22merger%22"
        f"&forms=8-K&dateRange=custom&startdt={start}&enddt={today}"
    )
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Premia/1.0 mnshpoojari@gmail.com"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        hits = data.get("hits", {}).get("hits", [])
        items = []
        for hit in hits:
            src = hit.get("_source", {})
            entity = src.get("entity_name", "Unknown")
            file_date = src.get("file_date", "")
            accession = src.get("accession_no", "").replace("-", "")
            cik = str(src.get("entity_id", "")).lstrip("0")
            filing_url = (
                f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/"
                if cik and accession else "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K"
            )
            items.append({
                "title": f"{entity} files 8-K: merger/acquisition",
                "snippet": f"SEC EDGAR 8-K filing dated {file_date}",
                "url": filing_url,
                "source": "SEC EDGAR",
                "published_date": file_date or None,
            })
        log.info(f"Fetched {len(items):>3} items  ←  SEC EDGAR EFTS")
        return items
    except Exception as e:
        log.warning(f"EDGAR fetch failed  ({e})")
        return []


# ── Core pipeline steps ────────────────────────────────────────────────────────

def fetch_feed(url: str) -> list[dict]:
    try:
        feed = feedparser.parse(url)
        feed_title = feed.feed.get("title", url)
        items = []
        for entry in feed.entries:
            description = entry.get("summary", entry.get("description", ""))
            items.append({
                "title": entry.get("title", ""),
                "snippet": description[:150].strip(),
                "url": entry.get("link", ""),
                "source": feed_title,
                "published_date": parse_date(entry),
            })
        log.info(f"Fetched {len(items):>3} items  ←  {url}")
        return items
    except Exception as e:
        log.warning(f"Feed failed  ←  {url}  ({e})")
        return []


def classify_batch(items: list[dict]) -> list[Optional[dict]]:
    """Classify up to BATCH_SIZE items in a single Gemini call."""
    lines = "\n".join(
        f"{i+1}. {item['title']}" + (f" — {item['snippet']}" if item.get("snippet") else "")
        for i, item in enumerate(items)
    )
    prompt = BATCH_PROMPT_HEADER + lines

    try:
        response = _gemini.models.generate_content(model="gemini-2.5-flash-lite", contents=prompt)
        results = extract_json_array(response.text)
        while len(results) < len(items):
            results.append(None)
        return results[:len(items)]
    except json.JSONDecodeError as e:
        log.warning(f"JSON parse failed for batch of {len(items)}: {e}")
        return [None] * len(items)
    except Exception as e:
        log.warning(f"Gemini error for batch of {len(items)}: {e}")
        return [None] * len(items)


def upsert_deal(item: dict, classified: dict) -> str:
    """Returns 'inserted', 'updated', or 'skipped'."""
    deal_key = generate_deal_key(
        classified.get("buyer_name"),
        classified.get("target_name"),
        classified.get("deal_type"),
    )

    existing = (
        supabase.table("deals")
        .select("id, mention_count")
        .eq("deal_key", deal_key)
        .execute()
    )

    if existing.data:
        row_id = existing.data[0]["id"]
        supabase.table("deals").update({
            "mention_count": existing.data[0]["mention_count"] + 1,
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", row_id).execute()
        return "updated"

    row = {
        "title": item["title"],
        "url": item["url"],
        "source": item["source"],
        "published_date": item["published_date"],
        "sector": classified.get("sector"),
        "sub_sector": classified.get("sub_sector"),
        "geography": classified.get("geography"),
        "buyer_name": classified.get("buyer_name"),
        "buyer_type": classified.get("buyer_type"),
        "target_name": classified.get("target_name"),
        "deal_size_usd": classified.get("deal_size_usd"),
        "deal_type": classified.get("deal_type"),
        "deal_key": deal_key,
        "status": "NEW",
        "mention_count": 1,
    }

    try:
        supabase.table("deals").insert(row).execute()
        return "inserted"
    except Exception as e:
        log.warning(f"Insert failed — '{item['title'][:60]}' — {e}")
        return "skipped"


def process_items(items: list[dict]) -> tuple[int, int, int]:
    inserted = updated = skipped = 0

    candidates = [i for i in items if has_deal_keyword(i["title"] + " " + i.get("snippet", ""))]
    skipped += len(items) - len(candidates)

    for batch_start in range(0, len(candidates), BATCH_SIZE):
        batch = candidates[batch_start:batch_start + BATCH_SIZE]
        classifications = classify_batch(batch)

        for item, classified in zip(batch, classifications):
            if not classified or not classified.get("is_deal"):
                skipped += 1
                continue

            result = upsert_deal(item, classified)
            if result == "inserted":
                inserted += 1
                log.info(f"  [+] {item['title'][:80]}")
            elif result == "updated":
                updated += 1
            else:
                skipped += 1

        if batch_start + BATCH_SIZE < len(candidates):
            time.sleep(1)

    return inserted, updated, skipped


# ── Entry point ────────────────────────────────────────────────────────────────

def main():
    log.info("Premia ingestion pipeline — starting")
    total_i = total_u = 0

    log.info("── Tier 1 feeds ──────────────────────────────────────────────────")
    for url in TIER_1_FEEDS:
        items = fetch_feed(url)
        i, u, _ = process_items(items)
        total_i += i
        total_u += u

    log.info("── Tier 2 feeds ──────────────────────────────────────────────────")
    for url in TIER_2_FEEDS:
        items = fetch_feed(url)
        i, u, _ = process_items(items)
        total_i += i
        total_u += u

    log.info("── Tier 3 Google News queries ────────────────────────────────────")
    for query in TIER_3_QUERIES:
        encoded = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
        items = fetch_feed(url)
        i, u, _ = process_items(items)
        total_i += i
        total_u += u

    log.info("── SEC EDGAR 8-K filings ─────────────────────────────────────────")
    items = fetch_edgar_items()
    i, u, _ = process_items(items)
    total_i += i
    total_u += u

    log.info(f"── Complete — inserted: {total_i}  updated: {total_u} ─────────────")


if __name__ == "__main__":
    main()

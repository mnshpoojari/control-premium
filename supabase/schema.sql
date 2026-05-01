-- Premia deals table
-- Run this once in the Supabase SQL editor before running the ingestion script.

CREATE TABLE IF NOT EXISTS deals (
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

CREATE INDEX IF NOT EXISTS idx_deals_sector         ON deals(sector);
CREATE INDEX IF NOT EXISTS idx_deals_geography      ON deals(geography);
CREATE INDEX IF NOT EXISTS idx_deals_published_date ON deals(published_date);
CREATE INDEX IF NOT EXISTS idx_deals_deal_key       ON deals(deal_key);

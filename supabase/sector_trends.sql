-- Premia sector trends table
-- Run in Supabase SQL editor before running trend_scanner.py

CREATE TABLE IF NOT EXISTS sector_trends (
  sector        TEXT PRIMARY KEY,
  count_30d     INTEGER DEFAULT 0,
  count_90d     INTEGER DEFAULT 0,
  monthly_counts JSONB DEFAULT '[]',
  explanation   TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read (sector trends are not sensitive)
ALTER TABLE sector_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON sector_trends FOR SELECT USING (true);

-- Market context cache — results from Gemini 2.0 Flash with Google Search grounding
-- Cached per sector × geography for 7 days
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS market_context_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sector TEXT NOT NULL,
  geography TEXT NOT NULL,
  result JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sector, geography)
);

ALTER TABLE market_context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON market_context_cache
  FOR SELECT USING (true);

CREATE POLICY "Service role write" ON market_context_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Query log — tracks what sectors users search (product analytics, not data seeding)

CREATE TABLE IF NOT EXISTS sector_query_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sector TEXT NOT NULL,
  geography TEXT NOT NULL,
  cache_hit BOOLEAN NOT NULL,
  cagr_found BOOLEAN,
  market_size_found BOOLEAN,
  ev_revenue_found BOOLEAN,
  ev_ebitda_found BOOLEAN,
  queried_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sector_query_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role write" ON sector_query_log
  FOR ALL USING (auth.role() = 'service_role');

-- Premia daily intelligence briefs
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS daily_briefs (
  id            SERIAL PRIMARY KEY,
  date          DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  content       TEXT NOT NULL,
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  seen_urls     JSONB DEFAULT '[]'
);

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON daily_briefs FOR SELECT USING (true);

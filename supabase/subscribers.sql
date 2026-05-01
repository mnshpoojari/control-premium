-- Premia email subscribers
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS subscribers (
  id                SERIAL PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  unsubscribe_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  active            BOOLEAN DEFAULT TRUE
);

-- No public read — only service role key can access
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

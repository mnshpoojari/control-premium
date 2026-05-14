// scripts/migrate-market-context.mjs
// Run: node scripts/migrate-market-context.mjs
// Creates market_context_cache and sector_query_log tables in Supabase.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars'); process.exit(1) }

const SQL = readFileSync(join(__dirname, '../supabase/market_context_cache.sql'), 'utf8')

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// ── Attempt 1: Supabase pg_meta SQL endpoint ───────────────────────────────────
async function runViaPgMeta() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: SQL }),
  })
  if (res.ok) return true
  const text = await res.text()
  if (!text.includes('Not Found') && !text.includes('404')) {
    console.error('pg_meta attempt failed:', text.slice(0, 200))
  }
  return false
}

// ── Attempt 2: Supabase Management API ────────────────────────────────────────
async function runViaManagementApi() {
  const ref = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1]
  if (!ref) return false
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { ...headers, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ query: SQL }),
  })
  if (res.ok) return true
  return false
}

// ── Verify both tables exist via REST ─────────────────────────────────────────
async function verifyTable(name) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${name}?limit=0`,
    { headers }
  )
  return res.ok || res.status === 200
}

async function main() {
  console.log('── Premia DB migration: market context tables ──')
  console.log()

  let created = false

  console.log('Trying REST SQL endpoint...')
  created = await runViaPgMeta()
  if (created) console.log('✓ SQL executed via REST endpoint')

  if (!created) {
    console.log('Trying Supabase Management API...')
    created = await runViaManagementApi()
    if (created) console.log('✓ SQL executed via Management API')
  }

  if (!created) {
    console.log()
    console.log('─────────────────────────────────────────────────────────')
    console.log('Programmatic DDL not available with the service role key.')
    console.log('Please run the SQL below in your Supabase SQL editor:')
    console.log('https://supabase.com/dashboard/project/lxvddwtqzddjvtumfnhd/sql/new')
    console.log('─────────────────────────────────────────────────────────')
    console.log()
    console.log(SQL)
    console.log()
    console.log('After running the SQL above, re-run this script to verify.')
    console.log()
  }

  // Verify — works regardless of how tables were created
  console.log('Verifying tables...')
  const [cacheOk, logOk] = await Promise.all([
    verifyTable('market_context_cache'),
    verifyTable('sector_query_log'),
  ])

  console.log(`  market_context_cache : ${cacheOk ? '✓ exists' : '✗ NOT FOUND'}`)
  console.log(`  sector_query_log     : ${logOk  ? '✓ exists' : '✗ NOT FOUND'}`)
  console.log()

  if (cacheOk && logOk) {
    console.log('✓ Both tables confirmed. Ready for Phase 2.')
  } else {
    console.log('✗ One or more tables missing. Run the SQL above and retry.')
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

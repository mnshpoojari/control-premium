import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sector_trends?select=sector,count_30d,count_90d&order=count_30d.desc`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  )

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 })
  }

  const all: { sector: string; count_30d: number; count_90d: number }[] = await res.json()

  // Top 3 sectors by count_30d — exclude these from underrated
  const top3 = new Set(all.slice(0, 3).map(s => s.sector))

  const underrated = all
    .filter(s => !top3.has(s.sector))
    .filter(s => s.count_30d >= 2 && s.count_90d > 0)
    .map(s => {
      // Daily rate last 30 days vs daily rate in days 31–90
      const prior60Count = s.count_90d - s.count_30d
      const recentRate = s.count_30d / 30
      const priorRate = prior60Count / 60
      const momentum = recentRate / Math.max(priorRate, 0.05)
      return { ...s, momentum }
    })
    .filter(s => s.momentum >= 1.5)
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 3)
    .map(s => ({
      sector: s.sector,
      count_30d: s.count_30d,
      momentum: Math.round(s.momentum * 10) / 10,
    }))

  return NextResponse.json(underrated)
}

import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sector_trends?select=sector,count_30d,explanation&order=count_30d.desc&limit=3`,
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

  const data = await res.json()
  return NextResponse.json(data ?? [])
}

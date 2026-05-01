'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SERIF = 'var(--font-serif), serif'
const SANS = 'var(--font-sans), sans-serif'
const C = {
  bg: '#FAF8F3',
  card: '#ECE6DB',
  cardHover: '#DDD5C6',
  border: 'rgba(59,47,47,0.12)',
  text: '#3B2F2F',
  muted: 'rgba(59,47,47,0.55)',
  faint: 'rgba(59,47,47,0.35)',
  accent: '#A3E635',
  momentum: '#E8892A',
}

interface SectorTrend { sector: string; count_30d: number }
interface UnderratedSector { sector: string; count_30d: number; momentum: number }


export default function HomePage() {
  const [thesis, setThesis] = useState('')
  const [focused, setFocused] = useState(false)
  const [trends, setTrends] = useState<SectorTrend[]>([])
  const [underrated, setUnderrated] = useState<UnderratedSector[]>([])
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [underratedLoading, setUnderratedLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/top-sectors')
      .then(r => r.json())
      .then(d => { setTrends(Array.isArray(d) ? d : []); setTrendsLoading(false) })
      .catch(() => setTrendsLoading(false))
    fetch('/api/underrated-sectors')
      .then(r => r.json())
      .then(d => { setUnderrated(Array.isArray(d) ? d : []); setUnderratedLoading(false) })
      .catch(() => setUnderratedLoading(false))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = thesis.trim()
    if (t) router.push(`/results?thesis=${encodeURIComponent(t)}`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.bg }}>
      <header className="px-8 pt-6 pb-2 flex items-center justify-between">
        <span style={{ fontFamily: SERIF, color: C.text, fontSize: '1.5rem' }}>Premia</span>
        <button
          onClick={() => router.push('/brief')}
          className="btn-glow text-sm font-semibold transition-opacity hover:opacity-90 px-4 py-1.5 rounded-full"
          style={{ color: '#3B2F2F', backgroundColor: '#A3E635', border: 'none', fontFamily: SANS }}
        >
          Intelligence Brief of the day!
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pt-6 pb-8">
        <div className="w-full max-w-2xl flex flex-col gap-8">

          <div>
            <h1 className="mb-2" style={{ fontFamily: SERIF, fontSize: '2.4rem', fontWeight: 400, color: C.text, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              What&apos;s your thesis?
            </h1>
            <p className="text-base mb-5" style={{ color: C.muted, fontFamily: SANS, fontWeight: 500 }}>
              Type a sector and geography — Premia tells you if you&apos;re early, on time, or late.
            </p>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={thesis}
                onChange={e => setThesis(e.target.value)}
                placeholder="e.g. healthcare IT in India, fintech in the US"
                className="flex-1 px-5 py-3.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  backgroundColor: C.card,
                  color: C.text,
                  border: `1px solid ${focused ? C.text : C.border}`,
                  caretColor: C.accent,
                  fontFamily: SANS,
                  fontWeight: 500,
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
              />
              <button
                type="submit"
                disabled={!thesis.trim()}
                className="px-7 py-3.5 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ backgroundColor: '#A3E635', color: '#3B2F2F', fontFamily: SANS, fontWeight: 700, boxShadow: '0 2px 10px rgba(163,230,53,0.4)' }}
              >
                Analyse
              </button>
            </form>
          </div>

          <div>
            <SectionDivider label="What's moving right now" />
            <p className="text-sm mb-4" style={{ color: C.muted, fontFamily: SANS, fontWeight: 600 }}>Highest deal activity in the last 30 days</p>
            <SectorGrid loading={trendsLoading} empty={trends.length === 0} emptyMessage="Sector data updates every 4 hours.">
              {trends.map((t, idx) => (
                <TopCard key={t.sector} sector={t.sector} count={t.count_30d} rank={idx + 1}
                  onClick={() => router.push(`/results?thesis=${encodeURIComponent(t.sector)}`)} />
              ))}
            </SectorGrid>
          </div>

          <div>
            <SectionDivider label="Gaining momentum" />
            <p className="text-sm mb-4" style={{ color: C.muted, fontFamily: SANS, fontWeight: 600 }}>Sectors accelerating in the last 30 days vs. the prior two months</p>
            <SectorGrid loading={underratedLoading} empty={underrated.length === 0} emptyMessage="Momentum data updates every 4 hours.">
              {underrated.map(s => (
                <MomentumCard key={s.sector} sector={s.sector} count={s.count_30d} momentum={s.momentum}
                  onClick={() => router.push(`/results?thesis=${encodeURIComponent(s.sector)}`)} />
              ))}
            </SectorGrid>
          </div>

        </div>
      </main>

      <SubscribeSection />

      <footer className="px-8 py-4 text-center" style={{ color: C.faint, fontSize: '0.75rem', fontFamily: SANS }}>
        Premia · Deal intelligence for deal professionals
        <span className="mx-2">·</span>
        <a href="mailto:manishapoojari48@gmail.com" style={{ color: C.muted, fontWeight: 600, textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
          Contact
        </a>
      </footer>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mb-3">
      <div className="flex-1 h-px" style={{ backgroundColor: C.border }} />
      <span className="text-sm uppercase tracking-widest whitespace-nowrap" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>{label}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: C.border }} />
    </div>
  )
}

function SectorGrid({ loading, empty, emptyMessage, children }: {
  loading: boolean; empty: boolean; emptyMessage: string; children: React.ReactNode
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ backgroundColor: C.card }} />)}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <p style={{ color: C.muted, fontSize: '0.85rem', fontFamily: SANS }}>{emptyMessage}</p>
      </div>
    )
  }
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
}

function TopCard({ sector, count, rank, onClick }: { sector: string; count: number; rank: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl p-6 transition-all flex flex-col justify-between"
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, minHeight: '11rem' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.text; e.currentTarget.style.backgroundColor = C.cardHover }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.backgroundColor = C.card }}
    >
      <div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full mb-3 inline-block"
          style={{ backgroundColor: 'rgba(59,47,47,0.08)', color: C.muted }}>#{rank}</span>
        <div className="mt-1" style={{ color: C.text, fontFamily: SERIF, fontSize: '1.05rem', lineHeight: 1.3 }}>{sector}</div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-4xl" style={{ color: '#D6336C', fontFamily: SERIF }}>{count}</span>
          <span className="text-xs ml-1.5" style={{ color: C.muted }}>deals / 30d</span>
        </div>
        <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.text }}>Explore →</span>
      </div>
    </button>
  )
}

function MomentumCard({ sector, count, momentum, onClick }: { sector: string; count: number; momentum: number; onClick: () => void }) {
  const label = momentum >= 3 ? 'Surging' : momentum >= 2 ? 'Accelerating' : 'Rising'
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl p-6 transition-all flex flex-col justify-between"
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, minHeight: '11rem' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.momentum; e.currentTarget.style.backgroundColor = C.cardHover }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.backgroundColor = C.card }}
    >
      <div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full mb-3 inline-block"
          style={{ backgroundColor: 'rgba(232,137,42,0.12)', color: C.momentum }}>{label}</span>
        <div className="mt-1" style={{ color: C.text, fontFamily: SERIF, fontSize: '1.05rem', lineHeight: 1.3 }}>{sector}</div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-4xl" style={{ color: '#D6336C', fontFamily: SERIF }}>{momentum}×</span>
          <span className="text-xs ml-1.5" style={{ color: C.muted }}>recent rate</span>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity mb-1" style={{ color: C.momentum }}>Explore →</div>
          <div className="text-xs" style={{ color: C.faint }}>{count} deals / 30d</div>
        </div>
      </div>
    </button>
  )
}

function SubscribeSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'exists' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (data.message === 'already_subscribed') setStatus('exists')
      else if (data.message === 'subscribed') setStatus('done')
      else setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="w-full px-6 py-10">
      <div className="max-w-2xl mx-auto rounded-2xl px-8 py-10 text-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: C.muted }}>Intelligence Brief</p>
        <h2 className="mb-3" style={{ fontFamily: SERIF, fontSize: '1.6rem', fontWeight: 400, color: C.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          What moved in private markets today
        </h2>
        <p className="text-sm mb-7 mx-auto max-w-sm" style={{ color: C.muted, lineHeight: 1.7, fontWeight: 500 }}>
          Every morning, Premia publishes a sharp briefing on confirmed transactions, situations developing, and what it means for where capital is moving. Free, no noise.
        </p>
        {status === 'done' ? (
          <p className="text-sm font-semibold" style={{ color: '#4a6b1a' }}>You&apos;re in. See you tomorrow morning.</p>
        ) : status === 'exists' ? (
          <p className="text-sm font-medium" style={{ color: C.muted }}>You&apos;re already subscribed.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-sm mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: SANS, fontWeight: 500 }}
              required
            />
            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: '#A3E635', color: '#3B2F2F', fontFamily: SANS }}
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && <p className="text-xs mt-3" style={{ color: C.momentum }}>Something went wrong — try again.</p>}
      </div>
    </div>
  )
}

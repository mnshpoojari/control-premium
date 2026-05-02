'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

interface AnalyseResult {
  consensus: { state: string; colour: string; explanation: string }
  chart_data: { month: string; deal_count: number }[]
  stats: { count_30d: number; count_90d: number }
  thesis: string
  evidence: { title: string; url: string; published_date: string; source: string }[]
}

const BADGE: Record<string, { border: string; bg: string; text: string; label: string }> = {
  'EARLY SIGNAL': { border: '#A3E635', bg: 'rgba(163,230,53,0.12)', text: '#4a6b1a', label: '● Early Signal' },
  'CONSENSUS':    { border: C.momentum, bg: 'rgba(232,137,42,0.1)', text: C.momentum, label: '● Consensus' },
  'HYPE':         { border: '#c0392b', bg: 'rgba(192,57,43,0.08)', text: '#c0392b', label: '● Hype' },
  'QUIET':        { border: 'rgba(59,47,47,0.2)', bg: 'rgba(59,47,47,0.04)', text: C.muted, label: '● Quiet' },
}

const LOADING_MESSAGES = [
  'Reading between the lines of press releases…',
  'Following the money…',
  'Asking sources who prefer to remain anonymous…',
  'Cross-referencing deal rumours with actual facts…',
  'Checking what the smart money is doing…',
  'Separating signal from noise…',
  'Consulting the deal flow oracle…',
  'Running the numbers so you don\'t have to…',
  'Triangulating from 40+ sources…',
  'Looking past the headline valuation…',
]

function useLoadingMessage(active: boolean) {
  const [idx, setIdx] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!active) { if (timer.current) clearInterval(timer.current); return }
    setIdx(Math.floor(Math.random() * LOADING_MESSAGES.length))
    timer.current = setInterval(() => setIdx(i => (i + 1) % LOADING_MESSAGES.length), 2800)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [active])
  return LOADING_MESSAGES[idx]
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const thesis = searchParams.get('thesis') ?? ''
  const [data, setData] = useState<AnalyseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!thesis) { router.push('/'); return }
    fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thesis }),
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Unknown error'); setLoading(false) })
  }, [thesis, router])

  const badge = data ? (BADGE[data.consensus.state] ?? BADGE['QUIET']) : null
  const loadingMessage = useLoadingMessage(loading)

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, color: C.text, fontFamily: SANS }}>
      <div className="max-w-3xl mx-auto px-6 py-10">

        <button onClick={() => router.push('/')} className="text-sm mb-8 block transition-opacity hover:opacity-60" style={{ color: C.muted }}>
          ← New search
        </button>

        <p className="text-xl mb-10" style={{ color: C.text, fontFamily: SERIF }}>
          &ldquo;{thesis}&rdquo;
        </p>

        {loading && (
          <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <p style={{ fontFamily: SERIF, fontSize: '1.1rem', color: C.text }}>{loadingMessage}</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: C.card, border: `1px solid ${C.momentum}` }}>
            <p style={{ color: C.momentum }}>Analysis failed: {error}</p>
          </div>
        )}

        <div className="flex flex-col gap-6">

          {/* Consensus badge */}
          {!loading && data && badge && (
            <div className="rounded-2xl p-8" style={{ backgroundColor: badge.bg, border: `1px solid ${badge.border}` }}>
              <div className="text-2xl mb-3" style={{ color: badge.text, fontFamily: SERIF }}>{badge.label}</div>
              <p style={{ color: C.text, lineHeight: 1.7, opacity: 0.85, fontFamily: SANS }}>{data.consensus.explanation}</p>
            </div>
          )}

          {/* Chart */}
          {!loading && data && (
            <div className="rounded-2xl p-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: C.muted, fontFamily: SANS }}>
                News Activity — Last 12 Months
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.chart_data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,3,34,0.08)" />
                  <XAxis dataKey="month" tick={{ fill: C.muted as string, fontSize: 11, fontFamily: SANS }} axisLine={{ stroke: 'rgba(31,3,34,0.1)' }} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: C.muted as string, fontSize: 11, fontFamily: SANS }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: SANS }}
                    labelStyle={{ color: '#D6336C', fontFamily: SERIF }}
                    itemStyle={{ color: '#D6336C' }}
                  />
                  <Line type="monotone" dataKey="deal_count" name="News items" stroke="#D6336C" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#D6336C' }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-4">
                {[`${data.stats.count_30d} deals · 30 days`, `${data.stats.count_90d} deals · 90 days`].map(label => (
                  <span key={label} className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(214,51,108,0.08)', color: '#D6336C', fontFamily: SANS }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Thesis */}
          {!loading && data && (
            <div className="rounded-2xl p-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: C.muted, fontFamily: SANS }}>
                What the data says
              </h2>
              <div className="flex flex-col gap-4">
                {data.thesis.split('\n\n').filter(Boolean).map((para, i) => (
                  <p key={i} style={{ color: C.text, lineHeight: 1.8, fontSize: '0.95rem', fontFamily: SANS }}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {!loading && data && (
            <div className="rounded-2xl p-6" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: C.muted, fontFamily: SANS }}>
                What&apos;s driving the signal
              </h2>
              {data.evidence.length === 0 ? (
                <p style={{ color: C.muted, fontSize: '0.9rem', fontFamily: SANS }}>No recent news found for this thesis.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.evidence.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                      className="block rounded-xl p-4 transition-colors"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(31,3,34,0.3)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm font-medium leading-snug flex-1" style={{ color: C.text, fontFamily: SANS }}>{item.title}</p>
                        <span className="text-xs shrink-0 mt-0.5" style={{ color: C.accent }}>↗</span>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs" style={{ color: C.muted, fontFamily: SANS }}>
                        <span>{item.source}</span>
                        <span>{item.published_date}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {!loading && data && (
          <div className="mt-10 flex flex-col items-center gap-4">
            <button onClick={() => router.push('/')}
              className="px-6 py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-80"
              style={{ backgroundColor: C.card, color: C.text, border: `1px solid ${C.border}`, fontFamily: SANS }}>
              Search again
            </button>
            <p className="text-xs text-center" style={{ color: C.faint, fontFamily: SANS }}>
              Premia analyses deal flow data and media coverage to surface emerging investment themes.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF8F3' }}>
        <p style={{ color: 'rgba(31,3,34,0.5)', fontFamily: 'Instrument Sans, sans-serif' }}>Loading…</p>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}

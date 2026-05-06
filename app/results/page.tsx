'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface AnalyseResult {
  consensus: { state: string; colour: string; explanation: string }
  chart_data: { month: string; deal_count: number }[]
  stats: {
    count_30d: number
    count_90d: number
    media_sources: number
    velocity_ratio: number
    signal_gap: number
    confidence: 'high' | 'medium' | 'low'
  }
  thesis: string
  evidence: { title: string; url: string; published_date: string; source: string }[]
}

const STATE_META: Record<string, { color: string; bg: string; label: string; blurb: string }> = {
  'EARLY SIGNAL': { color: '#7CB518', bg: 'rgba(163,230,53,.18)', label: 'Early Signal',
    blurb: "Deal flow is outpacing media. The narrative hasn't formed yet — you're ahead of the page." },
  'CONSENSUS':    { color: '#A88B4C', bg: 'rgba(168,139,76,.16)', label: 'Consensus',
    blurb: 'Deals and coverage in lockstep. The theme is well-formed; most participants already see it.' },
  'HYPE':         { color: '#B83A26', bg: 'rgba(184,58,38,.12)', label: 'Hype',
    blurb: 'Coverage is running ahead of capital. Narrative without follow-through — proceed with skepticism.' },
  'QUIET':        { color: '#8C7E6F', bg: 'rgba(140,126,111,.14)', label: 'Quiet',
    blurb: 'Little of either. Either too early to call, or simply not a real theme yet.' },
  'ACTIVE':       { color: '#A88B4C', bg: 'rgba(168,139,76,.16)', label: 'Active',
    blurb: 'Strong, sustained deal activity in a well-established theme. Capital is actively deploying.' },
  'ESTABLISHED':  { color: '#7CB518', bg: 'rgba(163,230,53,.18)', label: 'Established',
    blurb: 'A mature market with consistent deal flow. Opportunity is in differentiation, not discovery.' },
  'NARRATIVE':    { color: '#B83A26', bg: 'rgba(184,58,38,.12)', label: 'Narrative',
    blurb: 'Media coverage outpacing deal flow in a mature sector. Stories are getting ahead of reality.' },
  'COOLING':      { color: '#8C7E6F', bg: 'rgba(140,126,111,.14)', label: 'Cooling',
    blurb: 'Activity is slowing. The theme had its run; deploy selectively if at all.' },
}

const LOADING_MSGS = [
  'Reading between the lines of press releases…',
  'Following the money…',
  'Cross-referencing deal rumours with actual facts…',
  'Checking what the smart money is doing…',
  'Separating signal from noise…',
  'Triangulating from 40+ sources…',
  'Looking past the headline valuation…',
]

// ── MiniLineChart ─────────────────────────────────────────────────────────────

function MiniLineChart({ data }: { data: { month: string; deal_count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 560, H = 190
  const PAD = { l: 36, r: 12, t: 14, b: 30 }
  const w = W - PAD.l - PAD.r
  const h = H - PAD.t - PAD.b
  const n = data.length
  if (n === 0) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>No chart data available.</div>

  const counts = data.map(d => d.deal_count)
  const months = data.map(d => d.month)
  const yMax = Math.max(Math.ceil(Math.max(...counts) / 5) * 5, 5)

  const X = (i: number) => PAD.l + (w * (n <= 1 ? 0.5 : i / (n - 1)))
  const Y = (v: number) => PAD.t + h - (v / yMax) * h

  let pathD = `M ${X(0)} ${Y(counts[0])}`
  for (let i = 1; i < n; i++) {
    const cx = (X(i - 1) + X(i)) / 2
    pathD += ` C ${cx} ${Y(counts[i - 1])}, ${cx} ${Y(counts[i])}, ${X(i)} ${Y(counts[i])}`
  }

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const k = Math.max(0, Math.min(1, (e.clientX - r.left - PAD.l) / w))
    setHover(Math.round(k * (n - 1)))
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMax * t))

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
      onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}
      style={{ display: 'block', cursor: 'crosshair' }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke="rgba(43,37,32,.08)" strokeDasharray="3 4" />
          <text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" fontFamily="var(--font-mono, monospace)" fontSize="10" fill="rgba(43,37,32,.42)">{v}</text>
        </g>
      ))}
      {months.map((m, i) => {
        if (n > 6 && i % 2 !== 0 && i !== n - 1) return null
        return <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontFamily="var(--font-mono, monospace)" fontSize="10" fill="rgba(43,37,32,.42)">{m.split(' ')[0]}</text>
      })}
      <path d={`${pathD} L ${X(n - 1)} ${Y(0)} L ${X(0)} ${Y(0)} Z`} fill="rgba(184,58,38,.10)" />
      <path d={pathD} stroke="#B83A26" strokeWidth="2.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {counts.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r={hover === i ? 5 : 3} fill="#FAF8F3" stroke="#B83A26" strokeWidth="1.8" />
      ))}
      {hover !== null && (
        <g>
          <line x1={X(hover)} x2={X(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(43,37,32,.35)" strokeDasharray="2 3" />
          <rect x={Math.min(X(hover) - 52, W - 118)} y={PAD.t - 2} width="114" height="18" rx="4" fill="#2B2520" />
          <text x={Math.min(X(hover), W - 59)} y={PAD.t + 12} textAnchor="middle" fontFamily="var(--font-mono, monospace)" fontSize="10" fill="#E9E1CF">
            {months[hover]} · {counts[hover]} items
          </text>
        </g>
      )}
    </svg>
  )
}

// ── Results Content ───────────────────────────────────────────────────────────

function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const thesis = searchParams.get('thesis') ?? ''
  const [data, setData] = useState<AnalyseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    if (!thesis) { router.push('/'); return }
    setMsgIdx(Math.floor(Math.random() * LOADING_MSGS.length))
    const timer = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MSGS.length), 2800)
    fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thesis }) })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); clearInterval(timer) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Unknown error'); setLoading(false); clearInterval(timer) })
    return () => clearInterval(timer)
  }, [thesis, router])

  const handlePin = () => {
    if (!data) return
    try {
      const saved = JSON.parse(localStorage.getItem('premia-pad-notes') || '[]')
      const note = {
        id: Date.now().toString(), text: thesis, state: data.consensus.state,
        x: 20 + (saved.length % 4) * 210, y: 30 + Math.floor(saved.length / 4) * 140,
        tilt: (Math.random() - 0.5) * 6,
        deals30: data.stats.count_30d, deals90: data.stats.count_90d, media: data.stats.media_sources,
      }
      localStorage.setItem('premia-pad-notes', JSON.stringify([...saved, note]))
    } catch (_) {}
  }

  const meta = data ? (STATE_META[data.consensus.state] ?? STATE_META['QUIET']) : null
  const confColor = !data ? '#8C7E6F' : data.stats.confidence === 'high' ? '#7CB518' : data.stats.confidence === 'medium' ? '#A88B4C' : '#B83A26'
  const confLabel = !data ? '' : data.stats.confidence === 'high' ? 'High confidence' : data.stats.confidence === 'medium' ? 'Medium confidence' : 'Low confidence'

  const confBars = data ? [
    { label: 'Data volume',   pct: Math.min(95, 30 + data.stats.count_90d * 2) },
    { label: 'Recency',       pct: Math.min(95, 40 + data.stats.count_30d * 3) },
    { label: 'Source breadth',pct: Math.min(95, 40 + data.stats.media_sources * 4) },
    { label: 'Signal clarity',pct: Math.max(10, Math.min(95, 80 - Math.abs(data.stats.signal_gap) * 4)) },
  ] : []

  const v = data?.stats.velocity_ratio ?? 1
  const pct = Math.round(Math.abs(v - 1) * 100)
  const velLabel = v >= 1.5 ? `↑ ${pct}% vs prior` : v <= 0.7 ? `↓ ${pct}% vs prior` : '→ flat'
  const velColor = v >= 1.5 ? '#7CB518' : v <= 0.7 ? '#B83A26' : 'var(--ink-mute)'
  const gap = data?.stats.signal_gap ?? 0

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3' }}>
      {/* Top nav */}
      <header style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,37,32,.08)' }}>
        <button onClick={() => router.push('/')} style={{ appearance: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'default', display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span className="serif" style={{ fontSize: '1.4rem', color: 'var(--ink)', lineHeight: 1 }}>
            Premia<span style={{ color: 'var(--terra)', fontSize: '0.6em', verticalAlign: 'super', marginLeft: 1 }}>·</span>
          </span>
        </button>
        {data && (
          <button onClick={handlePin} style={{ appearance: 'none', border: '1px solid rgba(124,181,24,.55)', background: 'rgba(163,230,53,.18)', color: 'var(--ink)', font: '600 12px Instrument Sans', padding: '7px 14px', borderRadius: 999, cursor: 'default' }}>
            Pin to Pad
          </button>
        )}
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 60px' }}>

        {/* Back crumb */}
        <button onClick={() => router.push('/')} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--ink-mute)', font: '500 12px Instrument Sans', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 18, padding: 0 }}>
          ← Back to search
        </button>

        <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.05, margin: '0 0 4px', letterSpacing: '-.005em' }}>
          &ldquo;{thesis}&rdquo;
        </h1>
        {data && (
          <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--ink-mute)' }}>
            Based on {data.stats.count_90d} items tracked · {data.stats.media_sources} sources · 90 days
          </p>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <p className="serif" style={{ fontSize: '1.1rem', color: 'var(--ink-mute)' }}>{LOADING_MSGS[msgIdx]}</p>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(184,58,38,.08)', border: '1px solid rgba(184,58,38,.3)', borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#B83A26', margin: 0 }}>Analysis failed: {error}</p>
          </div>
        )}

        {data && meta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* VERDICT BLOCK */}
            <section style={{ background: meta.bg, border: `1px solid ${meta.color}55`, borderRadius: 14, padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 1px), rgba(43,37,32,.05) 100%)', backgroundSize: '100% 22px', position: 'absolute', inset: 0, pointerEvents: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: meta.color, boxShadow: `0 0 0 4px ${meta.color}25`, display: 'inline-block' }} />
                    <span className="serif" style={{ fontSize: 28, color: meta.color }}>{meta.label}</span>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{meta.blurb}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="mono" style={{ display: 'inline-block', padding: '5px 11px', borderRadius: 999, background: 'rgba(255,255,255,.55)', border: `1px solid ${confColor}55`, color: confColor, fontSize: 11, letterSpacing: '.1em', fontWeight: 600 }}>
                    {confLabel.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Stats tiles */}
              <div style={{ display: 'flex', marginTop: 20, background: 'rgba(255,255,255,.45)', border: '1px solid rgba(43,37,32,.10)', borderRadius: 12, position: 'relative' }}>
                {[
                  { label: 'Deals · 30d',  value: data.stats.count_30d, sub: velLabel, color: velColor },
                  { label: 'Deals · 90d',  value: data.stats.count_90d, sub: 'transactions tracked', color: 'var(--ink)' },
                  { label: 'Sources',       value: data.stats.media_sources, sub: 'unique outlets', color: 'var(--ink)' },
                  { label: 'Signal gap',    value: gap > 0 ? `+${gap}` : String(gap), sub: gap >= 0 ? 'deals ahead of media' : 'media ahead of deals', color: gap >= 0 ? '#7CB518' : '#B83A26' },
                ].map((t, i, arr) => (
                  <div key={i} style={{ flex: 1, minWidth: 0, padding: '14px 18px', borderRight: i < arr.length - 1 ? '1px dashed rgba(43,37,32,.16)' : 'none' }}>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-mute)' }}>{t.label.toUpperCase()}</div>
                    <div className="num" style={{ fontSize: 32, lineHeight: 1.05, marginTop: 4, color: t.color }}>{t.value}</div>
                    <div style={{ fontSize: 11, marginTop: 2, color: 'var(--ink-mute)' }}>{t.sub}</div>
                  </div>
                ))}
              </div>

              <p style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, opacity: .8, margin: '14px 0 0' }}>
                {data.consensus.explanation}
              </p>
            </section>

            {/* CHART + CONFIDENCE */}
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
              <div className="paper" style={{ padding: '20px 22px' }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 4 }}>NEWS & DEAL ACTIVITY</div>
                <div className="serif" style={{ fontSize: 18, marginBottom: 14 }}>Past 12 Months</div>
                <MiniLineChart data={data.chart_data} />
                <p style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8, marginBottom: 0 }}>
                  Hover the chart to scrub months. Data from 40+ tracked sources.
                </p>
              </div>

              <div className="paper" style={{ padding: '18px 20px' }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 6 }}>CONFIDENCE BREAKDOWN</div>
                <div className="serif" style={{ fontSize: 22, color: confColor, lineHeight: 1, marginBottom: 14 }}>{confLabel}</div>
                {confBars.map(({ label, pct: barPct }) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 36px', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px dashed rgba(43,37,32,.14)' }}>
                    <span style={{ font: '500 12px Instrument Sans', color: 'var(--ink-soft)' }}>{label}</span>
                    <div style={{ height: 7, background: 'rgba(43,37,32,.06)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${barPct}%`, background: `linear-gradient(90deg, ${confColor}55, ${confColor}cc)`, borderRadius: 4, transition: 'width .5s cubic-bezier(.2,.9,.2,1.1)' }} />
                    </div>
                    <span className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-soft)' }}>{barPct}%</span>
                  </div>
                ))}
              </div>
            </section>

            {/* NARRATIVE */}
            <section className="paper" style={{ padding: '22px 26px' }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 10 }}>WHAT THE DATA SAYS</div>
              <div style={{ borderLeft: '2px solid rgba(43,37,32,.18)', paddingLeft: 18 }}>
                {data.thesis.split('\n\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="serif" style={{ fontSize: 16, lineHeight: 1.6, margin: i === 0 ? '0 0 12px' : '0 0 12px' }}>{para}</p>
                ))}
              </div>
            </section>

            {/* EVIDENCE */}
            <section>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 4 }}>WHAT&apos;S DRIVING THE SIGNAL</div>
              <div className="serif" style={{ fontSize: 20, marginBottom: 12 }}>Recent transactions &amp; mentions</div>

              {data.evidence.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-mute)', fontSize: 13 }}>No recent evidence found for this thesis.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.evidence.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center', background: '#FAF8F3', border: '1px solid rgba(43,37,32,.10)', borderRadius: 12, padding: '14px 18px', textDecoration: 'none', transition: 'transform .15s, box-shadow .15s' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 14px -10px rgba(43,37,32,.25)' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ font: '500 14px Instrument Sans', color: 'var(--ink)', marginBottom: 4 }}>{item.title}</div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-mute)' }}>
                          <span className="mono">{item.source}</span>
                          <span className="mono">{item.published_date}</span>
                        </div>
                      </div>
                      <span style={{ color: '#7CB518', fontSize: 18, opacity: .7 }}>↗</span>
                    </a>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}

        {!loading && (
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <button onClick={() => router.push('/')} style={{ appearance: 'none', border: '1px solid rgba(43,37,32,.18)', background: 'rgba(255,255,255,.5)', color: 'var(--ink-soft)', font: '500 13px Instrument Sans', padding: '10px 20px', borderRadius: 12, cursor: 'default' }}>
              Search again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8F3' }}>
        <p style={{ color: 'var(--ink-mute)', fontFamily: 'Instrument Sans, sans-serif' }}>Loading…</p>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}

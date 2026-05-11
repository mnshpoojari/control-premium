'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'

// ── Data ───────────────────────────────────────────────────────────────────────

const SECTORS_LIST = [
  { id: 'climate',    label: 'Climate Infrastructure' },
  { id: 'health',     label: 'Healthcare IT' },
  { id: 'fintech',    label: 'Fintech' },
  { id: 'saas',       label: 'B2B SaaS' },
  { id: 'wealth',     label: 'Wealthtech' },
  { id: 'logistics',  label: 'Logistics' },
  { id: 'defence',    label: 'Defence & Aerospace' },
  { id: 'agritech',   label: 'Agritech' },
  { id: 'femtech',    label: 'Femtech' },
  { id: 'realestate', label: 'Real Estate' },
  { id: 'proptech',   label: 'PropTech' },
  { id: 'edtech',     label: 'EdTech' },
]

const GEOS_LIST = [
  { id: 'india',   label: 'India' },
  { id: 'us',      label: 'United States' },
  { id: 'sea',     label: 'Southeast Asia' },
  { id: 'uk',      label: 'United Kingdom' },
  { id: 'mena',    label: 'Middle East' },
  { id: 'germany', label: 'Germany' },
  { id: 'brazil',  label: 'Brazil' },
  { id: 'japan',   label: 'Japan' },
  { id: 'africa',  label: 'Africa' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMarketStatus() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
  try {
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day = et.getDay()
    const mins = et.getHours() * 60 + et.getMinutes()
    const open = day >= 1 && day <= 5 && mins >= 570 && mins < 960
    return { dateStr, open }
  } catch { return { dateStr, open: false } }
}

function computeAccel(count_30d: number, count_90d: number) {
  const recent = count_30d / 30
  const prior = Math.max((count_90d - count_30d) / 60, 0.01)
  return Math.round((recent / prior - 1) * 100)
}

function useIsMobile(breakpoint = 700) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

// ── SectionDivider ─────────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(43,37,32,.12)' }} />
      <span className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', fontWeight: 600 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(43,37,32,.12)' }} />
    </div>
  )
}

// ── TypeOrDrop ─────────────────────────────────────────────────────────────────

interface Opt { id: string; label: string }

function TypeOrDrop({ label, value, onChange, options, color, accent }: {
  label: string; value: string; onChange: (v: string) => void
  options: Opt[]; color?: string; accent?: string
}) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [hoverIdx, setHoverIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(value) }, [value])

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    return !q ? options : options.filter(o => o.label.toLowerCase().includes(q))
  }, [text, options])

  const commit = (lbl: string) => { onChange(lbl); setText(lbl); setOpen(false); inputRef.current?.blur() }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIdx(h => Math.min(filtered.length - 1, h + 1)); setOpen(true) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHoverIdx(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const p = filtered[hoverIdx] || filtered[0]; if (p) commit(p.label) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const filled = !!value
  return (
    <div style={{ position: 'relative', flex: '1 1 0', minHeight: 66, borderRadius: 12, background: filled ? (color || 'rgba(163,230,53,.14)') : 'rgba(255,255,255,.55)', border: filled ? `1.5px solid ${accent || 'rgba(124,181,24,.55)'}` : '1.5px solid rgba(43,37,32,.18)', padding: '10px 14px 12px', transition: 'background .2s, border-color .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 2 }}>{label}</div>
          <input ref={inputRef} value={text}
            onChange={e => { setText(e.target.value); onChange(e.target.value); setOpen(true); setHoverIdx(0) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => { setOpen(false); onChange(text.trim()) }, 150)}
            onKeyDown={onKey}
            placeholder="type or pick…"
            style={{ border: 0, outline: 'none', background: 'transparent', font: `400 18px/1.2 var(--font-serif, 'Young Serif', Georgia, serif)`, color: 'var(--ink)', width: '100%', padding: '2px 0' }}
          />
        </div>
        {filled && <button onMouseDown={e => { e.preventDefault(); setText(''); onChange('') }} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--ink-mute)', fontSize: 18, cursor: 'default', padding: 4, lineHeight: 1 }}>×</button>}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: '#FAF8F3', border: '1px solid rgba(43,37,32,.18)', borderRadius: 10, boxShadow: '0 14px 30px -16px rgba(43,37,32,.35)', padding: 6, maxHeight: 220, overflowY: 'auto' }}>
          {filtered.slice(0, 8).map((o, i) => (
            <div key={o.id} onMouseDown={e => { e.preventDefault(); commit(o.label) }} onMouseEnter={() => setHoverIdx(i)}
              style={{ padding: '7px 10px', borderRadius: 6, cursor: 'default', background: hoverIdx === i ? 'rgba(163,230,53,.22)' : 'transparent', font: '500 14px Instrument Sans', color: 'var(--ink)' }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ChipRow ────────────────────────────────────────────────────────────────────

function ChipRow({ items, kind, active, onSelect }: { items: Opt[]; kind: 'sector' | 'geo'; active: string; onSelect: (l: string) => void }) {
  const [lifted, setLifted] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => {
        const isLifted = lifted === item.id
        const isActive = active === item.label
        return (
          <button key={item.id}
            onClick={() => onSelect(item.label)}
            onPointerDown={() => setLifted(item.id)}
            onPointerUp={() => { setLifted(null); onSelect(item.label) }}
            onPointerLeave={() => setLifted(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
              border: `1px solid ${isActive ? 'rgba(124,181,24,.55)' : isLifted ? 'rgba(43,37,32,.35)' : 'rgba(43,37,32,.18)'}`,
              background: isActive ? 'rgba(163,230,53,.18)' : isLifted ? '#FAF8F3' : 'rgba(255,255,255,.55)',
              color: 'var(--ink)', font: '500 12px Instrument Sans', cursor: 'grab',
              transform: isLifted ? 'scale(1.1) translateY(-4px) rotate(-1deg)' : 'scale(1) translateY(0)',
              boxShadow: isLifted ? '0 12px 28px -8px rgba(43,37,32,.3), 0 2px 0 rgba(255,255,255,.7) inset' : 'none',
              transition: isLifted ? 'transform .08s ease-out, box-shadow .08s ease-out' : 'all .18s ease',
              zIndex: isLifted ? 20 : 1,
              position: 'relative',
              userSelect: 'none',
              touchAction: 'none',
            }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: kind === 'sector' ? 'var(--terra)' : 'var(--accent-deep)', flexShrink: 0 }} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// ── StrengthDial ───────────────────────────────────────────────────────────────

function StrengthDial({ value = 8, max = 50, accent = '#8C7E6F' }: { value?: number; max?: number; accent?: string }) {
  const [val, setVal] = useState(value)
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef(false)

  useEffect(() => { setVal(value) }, [value])

  const setFromX = (clientX: number) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setVal(Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * max))
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (drag.current) setFromX(e.clientX) }
    const onUp = () => { drag.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  })

  const W = 240, H = 58
  const pct = Math.max(0, Math.min(1, val / max))
  const cx = W / 2, cy = H + 10, r = W / 2 - 6
  const aN = Math.PI + (0 - Math.PI) * pct
  const nx = cx + r * Math.cos(aN), ny = cy + r * Math.sin(aN)

  const ticks = Array.from({ length: 11 }).map((_, i) => {
    const a = Math.PI + (0 - Math.PI) * (i / 10)
    const r1 = r - 2, r2 = r - (i % 5 === 0 ? 12 : 7)
    return { x1: cx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a), x2: cx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a), strong: i % 5 === 0 }
  })

  return (
    <div ref={ref} onPointerDown={e => { drag.current = true; setFromX(e.clientX); e.preventDefault() }}
      style={{ position: 'relative', width: W, height: H + 10, touchAction: 'none', userSelect: 'none', cursor: 'ew-resize' }}>
      <svg width={W} height={H + 14} viewBox={`0 0 ${W} ${H + 14}`} style={{ display: 'block' }}>
        <path d={`M 6 ${H + 10} A ${r} ${r} 0 0 1 ${W - 6} ${H + 10}`} fill="none" stroke="rgba(43,37,32,.12)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M 6 ${H + 10} A ${r} ${r} 0 0 1 ${nx} ${ny}`} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.strong ? 'rgba(43,37,32,.45)' : 'rgba(43,37,32,.22)'} strokeWidth={t.strong ? 1.4 : 1} />
        ))}
        <circle cx={nx} cy={ny} r={9} fill="#FAF8F3" stroke={accent} strokeWidth="2.5" />
        <circle cx={nx} cy={ny} r={3} fill={accent} />
      </svg>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', font: `600 9px var(--font-mono, monospace)`, color: 'var(--ink-mute)', letterSpacing: '.04em' }}>
        <span>QUIET</span><span>EARLY</span><span>CONSENSUS</span><span>HYPE</span>
      </div>
    </div>
  )
}

// ── SignalBoard ────────────────────────────────────────────────────────────────

const HERO_SECTORS = ['Healthcare', 'Fintech', 'Real Estate', 'Climatetech', 'Logistics', 'Agritech', 'B2B SaaS']
const HERO_GEOS    = ['India', 'the USA', 'the UAE', 'Germany', 'Brazil', 'Indonesia', 'Nigeria']

function SignalBoard({ onAnalyse, onPin, isMobile, preset }: {
  onAnalyse: (t: string) => void; onPin: (s: string, g: string) => void
  isMobile: boolean; preset?: { sector: string; geo: string } | null
}) {
  const [sector, setSector] = useState('')
  const [geo, setGeo] = useState('')
  const [shuffle, setShuffle] = useState(0)
  const [btnPressed, setBtnPressed] = useState(false)
  const [heroSectorIdx, setHeroSectorIdx] = useState(0)
  const [heroGeoIdx,    setHeroGeoIdx]    = useState(0)
  const [heroSectorKey, setHeroSectorKey] = useState(0)
  const [heroGeoKey,    setHeroGeoKey]    = useState(0)
  const ready = !!(sector && geo)

  useEffect(() => {
    if (preset) { setSector(preset.sector); setGeo(preset.geo) }
  }, [preset])

  // Sector rotates every 3.5s
  useEffect(() => {
    const id = setInterval(() => {
      setHeroSectorIdx(i => (i + 1) % HERO_SECTORS.length)
      setHeroSectorKey(k => k + 1)
    }, 3500)
    return () => clearInterval(id)
  }, [])

  // Geography rotates every 3.5s, staggered 1.75s behind sector
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setHeroGeoIdx(i => (i + 1) % HERO_GEOS.length)
        setHeroGeoKey(k => k + 1)
      }, 3500)
    }, 1750)
    return () => { clearTimeout(timeoutId); clearInterval(intervalId) }
  }, [])

  const sectorPool = useMemo(() => {
    const pool = SECTORS_LIST.filter(s => s.label !== sector)
    const start = (shuffle * 4) % pool.length
    return [...pool.slice(start), ...pool.slice(0, start)].slice(0, isMobile ? 5 : 7)
  }, [sector, shuffle, isMobile])

  const geoPool = useMemo(() => {
    const pool = GEOS_LIST.filter(g => g.label !== geo)
    const start = (shuffle * 3) % pool.length
    return [...pool.slice(start), ...pool.slice(0, start)]
  }, [geo, shuffle])

  return (
    <section className="paper" style={{ padding: isMobile ? '20px 18px 24px' : '28px 30px 32px', overflow: 'visible' }}>
      <div className="pin" style={{ top: 10, left: 14 }} />
      <div className="pin brass" style={{ top: 10, right: 14 }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 className="serif" style={{ fontSize: isMobile ? 26 : 38, lineHeight: 1.15, margin: 0 }}>
            Is{' '}
            <span key={heroSectorKey} className="word-in" style={{ display: 'inline-block', color: 'var(--accent-deep)', borderBottom: '2px solid var(--accent-deep)', paddingBottom: 1, whiteSpace: 'nowrap' }}>
              {HERO_SECTORS[heroSectorIdx]}
            </span>
            {' '}in{' '}
            <span key={heroGeoKey + 100} className="word-in" style={{ display: 'inline-block', color: 'var(--terra)', borderBottom: '2px solid var(--terra)', paddingBottom: 1, whiteSpace: 'nowrap' }}>
              {HERO_GEOS[heroGeoIdx]}
            </span>
            {' '}overcrowded or still early?
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: isMobile ? 13 : 15, color: 'var(--ink-soft)', maxWidth: 560 }}>
            Type a sector and country. Get an analysis in seconds.
          </p>
        </div>
        {!isMobile && (
          <button onClick={() => setShuffle(s => s + 1)} style={{
            flexShrink: 0, appearance: 'none', border: '1px solid rgba(43,37,32,.18)', background: 'rgba(255,255,255,.4)',
            padding: '8px 14px', borderRadius: 999, font: '500 12px Instrument Sans', color: 'var(--ink-soft)', cursor: 'default', letterSpacing: '.04em', marginTop: 4,
          }}>↻ reshuffle</button>
        )}
      </div>

      {/* Input row — stacks on mobile */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 12, alignItems: 'stretch', margin: '18px 0 16px' }}>
        <TypeOrDrop label="Sector" value={sector} onChange={setSector} options={SECTORS_LIST} color="rgba(184,58,38,.10)" accent="rgba(184,58,38,.5)" />
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, color: 'var(--ink-mute)', font: `400 16px var(--font-serif, 'Young Serif', Georgia, serif)` }}>in</div>
        )}
        <TypeOrDrop label="Geography" value={geo} onChange={setGeo} options={GEOS_LIST} color="rgba(163,230,53,.16)" accent="rgba(124,181,24,.55)" />
        <button
          disabled={!ready}
          onClick={() => ready && onAnalyse(`${sector} in ${geo}`)}
          onPointerDown={() => ready && setBtnPressed(true)}
          onPointerUp={() => setBtnPressed(false)}
          onPointerLeave={() => setBtnPressed(false)}
          style={{
            appearance: 'none', border: 0,
            background: ready ? 'var(--accent)' : 'rgba(43,37,32,.10)',
            color: ready ? '#1a1a1a' : 'var(--ink-mute)',
            font: '600 14px Instrument Sans',
            padding: isMobile ? '14px 22px' : '0 22px',
            borderRadius: 12,
            minWidth: isMobile ? 'unset' : 120,
            width: isMobile ? '100%' : 'auto',
            cursor: ready ? 'default' : 'not-allowed',
            boxShadow: ready
              ? btnPressed
                ? '0 1px 3px -2px rgba(124,181,24,.4)'
                : '0 6px 14px -8px rgba(124,181,24,.7), 0 1px 0 rgba(255,255,255,.5) inset'
              : 'none',
            transform: btnPressed ? 'scale(0.96) translateY(1px)' : 'scale(1) translateY(0)',
            transition: btnPressed ? 'transform .06s ease-out, box-shadow .06s ease-out' : 'all .15s ease',
          }}>Analyse →</button>
      </div>

      {/* Chips — single column on mobile, two columns on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 14 : 20, marginBottom: 20 }}>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>SECTORS</div>
          <ChipRow items={sectorPool} kind="sector" active={sector} onSelect={setSector} />
        </div>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>GEOGRAPHIES</div>
          <ChipRow items={geoPool} kind="geo" active={geo} onSelect={setGeo} />
        </div>
      </div>

      {/* Reshuffle — mobile only, below chips */}
      {isMobile && (
        <button onClick={() => setShuffle(s => s + 1)} style={{
          width: '100%', appearance: 'none', border: '1px solid rgba(43,37,32,.18)', background: 'rgba(255,255,255,.4)',
          padding: '8px 14px', borderRadius: 999, font: '500 12px Instrument Sans', color: 'var(--ink-soft)', cursor: 'default', letterSpacing: '.04em', marginBottom: 16,
        }}>↻ reshuffle chips</button>
      )}

      {/* Verdict strip */}
      <div style={{ padding: isMobile ? '14px 16px' : '18px 22px', borderRadius: 12, background: '#FAF8F3', border: '1px solid rgba(43,37,32,.10)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: isMobile ? 12 : 24, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 1px), rgba(43,37,32,.06) 100%)', backgroundSize: '100% 22px', position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          {ready ? (
            <div>
              <div className="serif" style={{ fontSize: isMobile ? 17 : 20, color: 'var(--ink)', marginBottom: 8 }}>
                {sector} in {geo} — ready to analyse.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => onPin(sector, geo)} style={{ appearance: 'none', border: '1px solid rgba(124,181,24,.55)', background: 'rgba(163,230,53,.18)', color: 'var(--ink)', font: '600 12px Instrument Sans', padding: '7px 14px', borderRadius: 999, cursor: 'default' }}>Pin to Pad</button>
                <button
                  onClick={() => onAnalyse(`${sector} in ${geo}`)}
                  onPointerDown={() => setBtnPressed(true)}
                  onPointerUp={() => setBtnPressed(false)}
                  onPointerLeave={() => setBtnPressed(false)}
                  style={{ appearance: 'none', border: 0, background: 'var(--accent)', color: '#1a1a1a', font: '600 13px Instrument Sans', padding: '7px 18px', borderRadius: 999, cursor: 'default',
                    boxShadow: btnPressed ? '0 1px 2px -1px rgba(124,181,24,.4)' : '0 4px 10px -6px rgba(124,181,24,.7)',
                    transform: btnPressed ? 'scale(0.96) translateY(1px)' : 'scale(1)',
                    transition: btnPressed ? 'transform .06s ease-out, box-shadow .06s ease-out' : 'all .15s ease',
                  }}>Full analysis →</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 8px', borderRadius: 999, background: 'rgba(140,126,111,.14)', color: 'var(--ink-mute)', font: `600 11px var(--font-mono, monospace)`, letterSpacing: '.1em' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-mute)', display: 'inline-block' }} />
                  — PICK ONE OF EACH —
                </span>
              </div>
              <div className="serif" style={{ fontSize: isMobile ? 16 : 19, lineHeight: 1.3, color: 'var(--ink-mute)', maxWidth: 480 }}>
                Your verdict appears here once both are selected.
              </div>
            </div>
          )}
        </div>
        {!isMobile && (
          <div style={{ position: 'relative' }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--ink-mute)', marginBottom: 6, textAlign: 'center' }}>SIGNAL STRENGTH · drag to test</div>
            <StrengthDial value={ready ? 12 : 8} accent={ready ? '#A88B4C' : '#8C7E6F'} />
          </div>
        )}
      </div>
    </section>
  )
}

// ── ThesisPad ─────────────────────────────────────────────────────────────────

interface PadNote { id: string; text: string; state: string; x: number; y: number; tilt: number; deals30: number; deals90: number; media: number }

const NOTE_COLORS: Record<string, { bg: string; tape: string }> = {
  'EARLY SIGNAL': { bg: '#E9F4C9', tape: 'rgba(124,181,24,.45)' },
  'CONSENSUS':    { bg: '#F2E8CC', tape: 'rgba(168,139,76,.5)'  },
  'HYPE':         { bg: '#F4D5C8', tape: 'rgba(184,58,38,.5)'   },
  'QUIET':        { bg: '#E6E1D5', tape: 'rgba(140,126,111,.5)' },
  'ACTIVE':       { bg: '#F2E8CC', tape: 'rgba(168,139,76,.5)'  },
  'ESTABLISHED':  { bg: '#E9F4C9', tape: 'rgba(124,181,24,.45)' },
  'NARRATIVE':    { bg: '#F4D5C8', tape: 'rgba(184,58,38,.5)'   },
  'COOLING':      { bg: '#E6E1D5', tape: 'rgba(140,126,111,.5)' },
}

function PadNote({ note, onMove, onRemove, onSelect }: {
  note: PadNote
  onMove: (id: string, p: { x: number; y: number }) => void
  onRemove: (id: string) => void
  onSelect: (text: string) => void
}) {
  const [local, setLocal] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const startRef = useRef({ mx: 0, my: 0 })
  const colors = NOTE_COLORS[note.state] || NOTE_COLORS['QUIET']

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    setDragging(true); startRef.current = { mx: e.clientX, my: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault()
  }
  const onPointerMove = (e: React.PointerEvent) => { if (dragging) setLocal({ x: e.clientX - startRef.current.mx, y: e.clientY - startRef.current.my }) }
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - startRef.current.mx
    const dy = e.clientY - startRef.current.my
    const moved = Math.sqrt(dx * dx + dy * dy)
    setDragging(false)
    if (moved < 8) {
      onSelect(note.text)
    } else {
      onMove(note.id, { x: note.x + local.x, y: note.y + local.y })
    }
    setLocal({ x: 0, y: 0 })
  }

  return (
    <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onMouseEnter={() => { setHovered(true); onSelect(note.text) }} onMouseLeave={() => setHovered(false)}
      style={{ position: 'absolute', left: note.x + local.x, top: note.y + local.y, width: 175, minHeight: 110, background: colors.bg, padding: '14px 14px 12px', borderRadius: 2,
        boxShadow: dragging ? '0 24px 40px -16px rgba(43,37,32,.4)' : hovered ? '0 12px 28px -10px rgba(43,37,32,.35), 0 0 0 2px rgba(124,181,24,.5)' : '0 8px 18px -10px rgba(43,37,32,.3), 0 1px 0 rgba(255,255,255,.5) inset',
        transform: `rotate(${note.tilt}deg) ${dragging ? 'scale(1.02)' : hovered ? 'scale(1.02) translateY(-2px)' : ''}`,
        transition: dragging ? 'none' : 'transform .18s, box-shadow .18s', cursor: dragging ? 'grabbing' : 'pointer', userSelect: 'none', touchAction: 'none', zIndex: dragging ? 30 : hovered ? 20 : 1 }}>
      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%) rotate(-2deg)', width: 70, height: 18, background: colors.tape, boxShadow: '0 2px 4px rgba(0,0,0,.08)' }} />
      <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', color: 'rgba(43,37,32,.55)' }}>{note.state}</div>
      <div className="serif" style={{ fontSize: 15, lineHeight: 1.25, marginTop: 6, color: 'var(--ink)' }}>{note.text}</div>
      <div className="mono" style={{ marginTop: 10, fontSize: 10, color: 'rgba(43,37,32,.55)', letterSpacing: '.06em' }}>{note.deals30}d/30 · {note.deals90}d/90 · {note.media}m</div>
      {hovered && <div className="mono" style={{ marginTop: 6, fontSize: 8, letterSpacing: '.12em', color: 'rgba(124,181,24,.8)' }}>LOADED ABOVE · CLICK TO ANALYSE ↑</div>}
      <button onClick={e => { e.stopPropagation(); onRemove(note.id) }} style={{ position: 'absolute', top: 6, right: 6, appearance: 'none', border: 0, background: 'transparent', color: 'rgba(43,37,32,.4)', fontSize: 14, cursor: 'default', padding: 4 }}>×</button>
    </div>
  )
}

function ThesisPad({ notes, setNotes, isMobile, onSelect }: { notes: PadNote[]; setNotes: React.Dispatch<React.SetStateAction<PadNote[]>>; isMobile: boolean; onSelect: (text: string) => void }) {
  const onMove = (id: string, p: { x: number; y: number }) => setNotes(prev => prev.map(n => n.id === id ? { ...n, ...p } : n))
  const onRemove = (id: string) => setNotes(prev => prev.filter(n => n.id !== id))
  const boardH = isMobile ? 220 : 320

  return (
    <div>
      <SectionDivider label="YOUR IDEAS PAD" />
      <div style={{ marginTop: 14 }}>
        <div style={{ position: 'relative', height: boardH, borderRadius: 14, background: '#3A2A1E',
          backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 2px, transparent 2px 6px), url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='c'><feTurbulence baseFrequency='1.4' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.13  0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23c)'/></svg>")`,
          boxShadow: '0 14px 30px -20px rgba(43,37,32,.5), 0 0 0 7px #5A3D24, 0 0 0 8px #2B1B0F', overflow: 'hidden' }}>
          <div className="pin brass" style={{ top: 14, left: 14 }} />
          <div className="pin brass" style={{ top: 14, right: 14 }} />
          <div className="pin brass" style={{ bottom: 14, left: 14 }} />
          <div className="pin brass" style={{ bottom: 14, right: 14 }} />
          <div className="mono" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, letterSpacing: '.24em', color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>IDEAS PAD · drag freely</div>
          {notes.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 2, background: '#E9F4C9', opacity: .4, transform: 'rotate(-3deg)' }} />
              <p className="mono" style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, letterSpacing: '.1em', marginTop: 8 }}>Pin a thesis to start your board.</p>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 32 }}>
              {notes.map(n => <PadNote key={n.id} note={n} onMove={onMove} onRemove={onRemove} onSelect={onSelect} />)}
            </div>
          )}
        </div>
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-mute)' }}>
          Pinned theses live here. Drag them around, group them, or pluck them off.
        </p>
      </div>
    </div>
  )
}

// ── NeedleMeter ────────────────────────────────────────────────────────────────

function NeedleMeter({ pct, color = '#B83A26' }: { pct: number; color?: string }) {
  const W = 120, H = 36, px = 8 + (W - 16) * Math.max(0, Math.min(1, pct))
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0,1,2,3,4].map(i => <line key={i} x1={8+(W-16)*(i/4)} y1={20} x2={8+(W-16)*(i/4)} y2={28} stroke="rgba(43,37,32,.25)" strokeWidth={i%2===0?1.2:.8} />)}
      <line x1={8} y1={24} x2={W-8} y2={24} stroke="rgba(43,37,32,.18)" strokeWidth="1.2" />
      <line x1={px} y1={8} x2={px} y2={30} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={px} cy={8} r={3} fill={color} />
    </svg>
  )
}

// ── SectorBoard ────────────────────────────────────────────────────────────────

interface SectorData { sector: string; count_30d: number; count_90d: number }

function SectorCard({ rank, sector, count_30d, count_90d, onClick }: { rank: number; sector: string; count_30d: number; count_90d: number; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const pct = Math.min(1, count_30d / 30)
  const accel = computeAccel(count_30d, count_90d)
  const accelColor = accel >= 20 ? '#7CB518' : accel >= 0 ? '#A88B4C' : '#B83A26'
  const accelBg = accel >= 20 ? 'rgba(163,230,53,.16)' : accel >= 0 ? 'rgba(168,139,76,.14)' : 'rgba(184,58,38,.12)'
  const needleColor = count_30d >= 15 ? '#7CB518' : count_30d >= 8 ? '#A88B4C' : '#B83A26'

  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '100%', textAlign: 'left', background: 'var(--paper)', borderRadius: 14, position: 'relative', overflow: 'hidden',
        border: `1px solid ${hov ? 'rgba(43,37,32,.22)' : 'rgba(43,37,32,.10)'}`,
        boxShadow: hov ? '0 20px 36px -20px rgba(43,37,32,.3), 0 1px 0 rgba(255,255,255,.6) inset' : '0 10px 24px -18px rgba(43,37,32,.25), 0 1px 0 rgba(255,255,255,.6) inset',
        padding: '18px 18px 16px', cursor: 'default', transform: hov ? 'translateY(-2px)' : 'none', transition: 'all .18s' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence baseFrequency='1' numOctaves='1' seed='${rank}'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.16  0 0 0 0 0.12  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>")`,
        mixBlendMode: 'multiply', opacity: .5 }} />
      <div className="pin" style={{ top: 8, left: '50%', transform: 'translateX(-50%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(43,37,32,.08)', color: 'var(--ink-soft)', letterSpacing: '.12em' }}>#{rank}</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: accelBg, color: accelColor, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '.04em' }}>{accel >= 0 ? '+' : ''}{accel}%</span>
      </div>
      <h3 className="serif" style={{ margin: '12px 0 4px', fontSize: 20, lineHeight: 1.1, color: 'var(--ink)' }}>{sector}</h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span className="num" style={{ fontSize: 42, lineHeight: 1, color: '#B83A26' }}>{count_30d}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>deals · 30d</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <NeedleMeter pct={pct} color={needleColor} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>velocity</span>
      </div>
    </button>
  )
}

function SectorBoard({ data, loading, onSelect, isMobile }: { data: SectorData[]; loading: boolean; onSelect: (s: string) => void; isMobile: boolean }) {
  const cardW = isMobile ? '78vw' : 'calc(33.33% - 10px)'

  return (
    <div>
      <SectionDivider label="WHAT'S MOVING RIGHT NOW" />
      <div style={{ margin: '14px 0 14px' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: isMobile ? 22 : 26 }}>What&rsquo;s moving right now</h2>
        {!isMobile && <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--ink-mute)' }}>Live deal flow across tracked sectors.</p>}
      </div>
      <div style={{
        display: 'flex', flexDirection: 'row', gap: 14,
        overflowX: 'auto', paddingBottom: 8,
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {loading
          ? [1,2,3].map(i => <div key={i} className="shimmer" style={{ flex: `0 0 ${cardW}`, height: 220, borderRadius: 14, background: 'var(--paper)', scrollSnapAlign: 'start' }} />)
          : data.map((s, i) => (
              <div key={s.sector} style={{ flex: `0 0 ${cardW}`, minWidth: 0, scrollSnapAlign: 'start' }}>
                <SectorCard rank={i + 1} sector={s.sector} count_30d={s.count_30d} count_90d={s.count_90d} onClick={() => onSelect(s.sector)} />
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ── ProductDemo ───────────────────────────────────────────────────────────────

const DEMO_EVIDENCE = [
  { title: 'Razorpay acquires B2B payments firm Ezetap in all-stock deal', source: 'techcrunch.com', date: '2025-04-14' },
  { title: 'PayU leads ₹180Cr round in embedded finance startup Juspay', source: 'economictimes.indiatimes.com', date: '2025-03-29' },
  { title: 'Goldman Sachs-backed Navi secures growth equity from Accel Partners', source: 'moneycontrol.com', date: '2025-03-11' },
]

const DEMO_STATS = [
  { label: 'Deals · 30d',  value: '18', sub: 'accelerating' },
  { label: 'Deals · 90d',  value: '47', sub: 'transactions tracked' },
  { label: 'Sources',       value: '14', sub: 'unique outlets' },
  { label: 'Signal gap',   value: '+11', sub: 'deals ahead of media' },
]

function ProductDemo({ isMobile }: { isMobile: boolean }) {
  return (
    <div>
      <SectionDivider label="EXAMPLE ANALYSIS" />
      <div style={{ marginBottom: 14, marginTop: 14 }}>
        <h2 className="serif" style={{ margin: 0, fontSize: isMobile ? 22 : 26 }}>Here&rsquo;s what you get</h2>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--ink-mute)' }}>A live result for &ldquo;Fintech in India&rdquo; — type your own thesis above.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.92, pointerEvents: 'none', userSelect: 'none' }}>

        {/* Verdict block */}
        <section style={{ background: 'rgba(163,230,53,.18)', border: '1px solid rgba(124,181,24,.35)', borderRadius: 14, padding: isMobile ? '18px 20px' : '22px 26px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 1px), rgba(43,37,32,.05) 100%)', backgroundSize: '100% 22px', position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: isMobile ? 12 : 24, alignItems: 'flex-start', position: 'relative' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#7CB518', boxShadow: '0 0 0 4px rgba(124,181,24,.25)', display: 'inline-block', flexShrink: 0 }} />
                <span className="serif" style={{ fontSize: isMobile ? 22 : 26, color: '#7CB518' }}>Early Signal</span>
              </div>
              <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>Recent activity is outpacing media. The narrative hasn&rsquo;t fully formed — you&rsquo;re ahead of the page.</p>
            </div>
            <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
              <span className="mono" style={{ display: 'inline-block', padding: '5px 11px', borderRadius: 999, background: 'rgba(255,255,255,.55)', border: '1px solid rgba(124,181,24,.4)', color: '#7CB518', fontSize: 11, letterSpacing: '.1em', fontWeight: 600 }}>DENSE SIGNAL</span>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', marginTop: 18, background: 'rgba(255,255,255,.45)', border: '1px solid rgba(43,37,32,.10)', borderRadius: 12 }}>
            {DEMO_STATS.map((t, i) => (
              <div key={i} style={{
                padding: isMobile ? '10px 12px' : '14px 18px',
                borderRight: isMobile ? (i % 2 === 0 ? '1px dashed rgba(43,37,32,.16)' : 'none') : (i < 3 ? '1px dashed rgba(43,37,32,.16)' : 'none'),
                borderBottom: isMobile && i < 2 ? '1px dashed rgba(43,37,32,.16)' : 'none',
              }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-mute)' }}>{t.label.toUpperCase()}</div>
                <div className="num" style={{ fontSize: isMobile ? 24 : 30, lineHeight: 1.05, marginTop: 4, color: i === 3 ? '#7CB518' : 'var(--ink)' }}>{t.value}</div>
                <div style={{ fontSize: 11, marginTop: 2, color: 'var(--ink-mute)' }}>{t.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Narrative */}
        <section className="paper" style={{ padding: isMobile ? '18px 20px' : '22px 26px' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 10 }}>WHAT THE DATA SAYS</div>
          <div style={{ borderLeft: '2px solid rgba(43,37,32,.18)', paddingLeft: 18 }}>
            <p className="serif" style={{ fontSize: isMobile ? 14 : 16, lineHeight: 1.65, margin: '0 0 12px', color: 'var(--ink)' }}>
              India&rsquo;s fintech sector has been one of the most active deal markets in Asia for the past decade, underpinned by a mobile-first population of 1.4 billion and a sustained regulatory push toward digital payments infrastructure. Deal volume has accelerated through early 2025, with 18 transactions recorded in the last 30 days — a material step-up from the prior period&rsquo;s pace.
            </p>
            {!isMobile && (
              <p className="serif" style={{ fontSize: 16, lineHeight: 1.65, margin: 0, color: 'var(--ink)' }}>
                The compression of rounds into the Series B–D range points to a maturing cohort approaching exit readiness. Buyers are a mix of strategic acquirers from banking and insurance, and international PE firms building India exposure ahead of what looks like a 12–18 month IPO window.
              </p>
            )}
          </div>
        </section>

        {/* Evidence */}
        <section>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 4 }}>WHAT&apos;S DRIVING THE SIGNAL</div>
          <div className="serif" style={{ fontSize: isMobile ? 17 : 20, marginBottom: 12 }}>Recent transactions &amp; mentions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_EVIDENCE.slice(0, isMobile ? 2 : 3).map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center', background: '#FAF8F3', border: '1px solid rgba(43,37,32,.10)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '500 14px Instrument Sans', color: 'var(--ink)', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-mute)' }}>
                    <span className="mono">{item.source}</span>
                    <span className="mono">{item.date}</span>
                  </div>
                </div>
                <span style={{ color: '#7CB518', fontSize: 18, opacity: .5 }}>↗</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [topSectors, setTopSectors] = useState<SectorData[]>([])
  const [sectorsLoading, setSectorsLoading] = useState(true)
  const [padNotes, setPadNotes] = useState<PadNote[]>([])
  const [padPreset, setPadPreset] = useState<{ sector: string; geo: string } | null>(null)
  const [{ dateStr }] = useState(() => getMarketStatus())
  const isMobile = useIsMobile()

  useEffect(() => {
    fetch('/api/top-sectors').then(r => r.json()).then(d => { setTopSectors(Array.isArray(d) ? d : []); setSectorsLoading(false) }).catch(() => setSectorsLoading(false))
    try { const s = localStorage.getItem('premia-pad-notes'); if (s) setPadNotes(JSON.parse(s)) } catch (_) {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('premia-pad-notes', JSON.stringify(padNotes)) } catch (_) {}
  }, [padNotes])

  const handleAnalyse = (thesis: string) => router.push(`/results?thesis=${encodeURIComponent(thesis)}`)

  const handlePadSelect = (text: string) => {
    const idx = text.lastIndexOf(' in ')
    if (idx > 0) setPadPreset({ sector: text.slice(0, idx).trim(), geo: text.slice(idx + 4).trim() })
  }

  const handlePin = (sector: string, geo: string) => {
    setPadNotes(prev => [...prev, {
      id: Date.now().toString(), text: `${sector} in ${geo}`, state: 'QUIET',
      x: 20 + (prev.length % 4) * 195, y: 30 + Math.floor(prev.length / 4) * 130,
      tilt: (Math.random() - 0.5) * 6, deals30: 0, deals90: 0, media: 0,
    }])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3' }}>
      <header style={{ padding: isMobile ? '12px 16px' : '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span className="serif" style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', color: 'var(--ink)', flexShrink: 0 }}>
          Premia<span style={{ color: 'var(--terra)', fontSize: '0.65em', verticalAlign: 'super', marginLeft: 1 }}>·</span>
        </span>
        {!isMobile && (
          <div className="mono" style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--ink-mute)' }}>
            {dateStr}
          </div>
        )}
        <button onClick={() => router.push('/brief')} className="btn-glow"
          style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600, padding: isMobile ? '5px 12px' : '6px 16px', borderRadius: 999, color: '#3B2F2F', backgroundColor: '#A3E635', border: 'none', cursor: 'default', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isMobile ? 'Brief →' : 'Intelligence Brief →'}
        </button>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '4px 14px 48px' : '8px 32px 60px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 24 }}>
          <SignalBoard onAnalyse={handleAnalyse} onPin={handlePin} isMobile={isMobile} preset={padPreset} />
          <ProductDemo isMobile={isMobile} />
          <ThesisPad notes={padNotes} setNotes={setPadNotes} isMobile={isMobile} onSelect={handlePadSelect} />
          <SectorBoard data={topSectors} loading={sectorsLoading} onSelect={handleAnalyse} isMobile={isMobile} />
        </div>
      </main>

      <footer style={{ padding: isMobile ? '12px 16px' : '16px 32px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--ink-mute)' }}>
        Premia · Understanding where money is moving
        <span style={{ margin: '0 8px' }}>·</span>
        <a href="mailto:manishapoojari48@gmail.com" style={{ color: 'var(--ink-soft)', fontWeight: 600, textDecoration: 'none' }}>Contact</a>
      </footer>
    </div>
  )
}

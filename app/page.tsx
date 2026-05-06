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
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [text, options])

  const commit = (lbl: string) => {
    onChange(lbl); setText(lbl); setOpen(false); inputRef.current?.blur()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIdx(h => Math.min(filtered.length - 1, h + 1)); setOpen(true) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHoverIdx(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const p = filtered[hoverIdx] || filtered[0]; if (p) commit(p.label) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const filled = !!value
  const bg = filled ? (color || 'rgba(163,230,53,.14)') : 'rgba(255,255,255,.55)'
  const border = filled ? `1.5px solid ${accent || 'rgba(124,181,24,.55)'}` : '1.5px solid rgba(43,37,32,.18)'

  return (
    <div style={{ position: 'relative', flex: '1 1 0', minHeight: 66, borderRadius: 12, background: bg, border, padding: '10px 14px 12px', transition: 'background .2s, border-color .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 2 }}>{label}</div>
          <input
            ref={inputRef}
            value={text}
            onChange={e => { setText(e.target.value); setOpen(true); setHoverIdx(0); if (!e.target.value) onChange('') }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKey}
            placeholder="type or click below…"
            style={{ border: 0, outline: 'none', background: 'transparent', font: `400 18px/1.2 var(--font-serif, serif)`, color: 'var(--ink)', width: '100%', padding: '2px 0' }}
          />
        </div>
        {filled && (
          <button onMouseDown={e => { e.preventDefault(); onChange(''); setText('') }}
            style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--ink-mute)', fontSize: 18, cursor: 'default', padding: 4, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: '#FAF8F3', border: '1px solid rgba(43,37,32,.18)', borderRadius: 10, boxShadow: '0 14px 30px -16px rgba(43,37,32,.35)', padding: 6, maxHeight: 220, overflowY: 'auto' }}>
          {filtered.slice(0, 8).map((o, i) => (
            <div key={o.id}
              onMouseDown={e => { e.preventDefault(); commit(o.label) }}
              onMouseEnter={() => setHoverIdx(i)}
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
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => {
        const isActive = active === item.label
        return (
          <button key={item.id} onClick={() => onSelect(item.label)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            border: `1px solid ${isActive ? 'rgba(124,181,24,.55)' : 'rgba(43,37,32,.18)'}`,
            background: isActive ? 'rgba(163,230,53,.18)' : 'rgba(255,255,255,.55)',
            color: 'var(--ink)', font: '500 12px Instrument Sans', cursor: 'default', transition: 'all .15s',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: kind === 'sector' ? 'var(--terra)' : 'var(--accent-deep)' }} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// ── SignalBoard ────────────────────────────────────────────────────────────────

function SignalBoard({ onAnalyse, onPin }: { onAnalyse: (t: string) => void; onPin: (s: string, g: string) => void }) {
  const [sector, setSector] = useState('')
  const [geo, setGeo] = useState('')
  const ready = !!(sector && geo)

  return (
    <section className="paper" style={{ padding: '28px 30px 32px', overflow: 'visible' }}>
      <div className="pin" style={{ top: 10, left: 14 }} />
      <div className="pin brass" style={{ top: 10, right: 14 }} />

      <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.05, margin: '0 0 8px' }}>
        What&rsquo;s your <span className="underline-wave">thesis</span>?
      </h1>
      <p style={{ margin: '0 0 22px', fontSize: 15, color: 'var(--ink-soft)' }}>
        Type a sector and geography — Premia tells you if you&rsquo;re early, on time, or late.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 20 }}>
        <TypeOrDrop label="Sector" value={sector} onChange={setSector} options={SECTORS_LIST}
          color="rgba(184,58,38,.10)" accent="rgba(184,58,38,.5)" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, color: 'var(--ink-mute)', font: `400 16px var(--font-serif, serif)` }}>in</div>
        <TypeOrDrop label="Geography" value={geo} onChange={setGeo} options={GEOS_LIST}
          color="rgba(163,230,53,.16)" accent="rgba(124,181,24,.55)" />
        <button
          disabled={!ready}
          onClick={() => ready && onAnalyse(`${sector} in ${geo}`)}
          style={{
            appearance: 'none', border: 0,
            background: ready ? 'var(--accent)' : 'rgba(43,37,32,.10)',
            color: ready ? '#1a1a1a' : 'var(--ink-mute)',
            font: '600 14px Instrument Sans',
            padding: '0 22px', borderRadius: 12, minWidth: 120,
            cursor: ready ? 'default' : 'not-allowed',
            boxShadow: ready ? '0 6px 14px -8px rgba(124,181,24,.7), 0 1px 0 rgba(255,255,255,.5) inset' : 'none',
            transition: 'all .15s',
          }}>
          Analyse →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 22 }}>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>← SECTORS · click one</div>
          <ChipRow items={SECTORS_LIST.filter(s => s.label !== sector).slice(0, 7)} kind="sector" active={sector} onSelect={setSector} />
        </div>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>← GEOGRAPHIES · click one</div>
          <ChipRow items={GEOS_LIST.filter(g => g.label !== geo)} kind="geo" active={geo} onSelect={setGeo} />
        </div>
      </div>

      {/* Verdict strip */}
      <div style={{
        padding: '16px 20px', borderRadius: 12,
        background: '#FAF8F3', border: '1px solid rgba(43,37,32,.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div className="serif" style={{ fontSize: 17, color: ready ? 'var(--ink)' : 'var(--ink-mute)' }}>
          {ready ? `"${sector} in ${geo}" — ready to analyse.` : 'Your verdict appears here. Select a sector and geography to begin.'}
        </div>
        {ready && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => onPin(sector, geo)} style={{
              appearance: 'none', border: '1px solid rgba(124,181,24,.55)',
              background: 'rgba(163,230,53,.18)', color: 'var(--ink)',
              font: '600 12px Instrument Sans', padding: '8px 14px', borderRadius: 999, cursor: 'default',
            }}>Pin to Pad</button>
            <button onClick={() => onAnalyse(`${sector} in ${geo}`)} style={{
              appearance: 'none', border: 0, background: 'var(--accent)', color: '#1a1a1a',
              font: '600 13px Instrument Sans', padding: '8px 18px', borderRadius: 999, cursor: 'default',
              boxShadow: '0 4px 10px -6px rgba(124,181,24,.7)',
            }}>Full analysis →</button>
          </div>
        )}
      </div>
    </section>
  )
}

// ── NeedleMeter ────────────────────────────────────────────────────────────────

function NeedleMeter({ pct, color = '#B83A26' }: { pct: number; color?: string }) {
  const W = 120, H = 36
  const px = 8 + (W - 16) * Math.max(0, Math.min(1, pct))
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={8 + (W - 16) * (i / 4)} y1={20} x2={8 + (W - 16) * (i / 4)} y2={28}
          stroke="rgba(43,37,32,.25)" strokeWidth={i % 2 === 0 ? 1.2 : .8} />
      ))}
      <line x1={8} y1={24} x2={W - 8} y2={24} stroke="rgba(43,37,32,.18)" strokeWidth="1.2" />
      <line x1={px} y1={8} x2={px} y2={30} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={px} cy={8} r={3} fill={color} />
    </svg>
  )
}

// ── SectorBoard ────────────────────────────────────────────────────────────────

interface SectorData { sector: string; count_30d: number }

function SectorCard({ rank, sector, count, onClick }: { rank: number; sector: string; count: number; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const pct = Math.min(1, count / 30)
  const color = count >= 15 ? '#7CB518' : count >= 8 ? '#A88B4C' : '#B83A26'
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: '1 1 0', minWidth: 0, textAlign: 'left',
        background: 'var(--paper)', borderRadius: 14, position: 'relative', overflow: 'hidden',
        border: `1px solid ${hov ? 'rgba(43,37,32,.22)' : 'rgba(43,37,32,.10)'}`,
        boxShadow: hov ? '0 20px 36px -20px rgba(43,37,32,.3), 0 1px 0 rgba(255,255,255,.6) inset' : '0 10px 24px -18px rgba(43,37,32,.25), 0 1px 0 rgba(255,255,255,.6) inset',
        padding: '18px 18px 16px', cursor: 'default',
        transform: hov ? 'translateY(-2px)' : 'none', transition: 'all .18s',
      }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence baseFrequency='1' numOctaves='1' seed='${rank}'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.16  0 0 0 0 0.12  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>")`,
        mixBlendMode: 'multiply', opacity: .5 }} />
      <div className="pin" style={{ top: 8, left: '50%', transform: 'translateX(-50%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(43,37,32,.08)', color: 'var(--ink-soft)', letterSpacing: '.12em' }}>#{rank}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-soft)', opacity: hov ? 1 : 0, transition: 'opacity .15s' }}>Explore →</span>
      </div>
      <h3 className="serif" style={{ margin: '12px 0 4px', fontSize: 20, lineHeight: 1.1, color: 'var(--ink)' }}>{sector}</h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span className="num" style={{ fontSize: 42, lineHeight: 1, color: '#B83A26' }}>{count}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>deals · 30d</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <NeedleMeter pct={pct} color={color} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>velocity</span>
      </div>
    </button>
  )
}

function SectorBoard({ data, loading, onSelect }: { data: SectorData[]; loading: boolean; onSelect: (s: string) => void }) {
  return (
    <div>
      <h2 className="serif" style={{ margin: '0 0 4px', fontSize: 26 }}>What&rsquo;s moving right now</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-mute)' }}>Highest deal activity in the last 30 days</p>
      <div style={{ display: 'flex', gap: 16 }}>
        {loading
          ? [1, 2, 3].map(i => <div key={i} className="shimmer" style={{ flex: '1 1 0', height: 200, borderRadius: 14, background: 'var(--paper)' }} />)
          : data.map((s, i) => <SectorCard key={s.sector} rank={i + 1} sector={s.sector} count={s.count_30d} onClick={() => onSelect(s.sector)} />)
        }
      </div>
    </div>
  )
}

// ── Knob ───────────────────────────────────────────────────────────────────────

function Knob({ angle, setAngle, size = 100 }: { angle: number; setAngle: (a: number) => void; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const startA = useRef(0)

  const onDown = (e: React.PointerEvent) => {
    drag.current = true
    const r = ref.current!.getBoundingClientRect()
    startA.current = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI - angle
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current || !ref.current) return
      const r = ref.current.getBoundingClientRect()
      const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI
      setAngle(Math.max(-135, Math.min(135, a - startA.current)))
    }
    const onUp = () => { drag.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [setAngle])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div ref={ref} onPointerDown={onDown} style={{
        width: size, height: size, borderRadius: '50%', position: 'relative',
        background: 'radial-gradient(circle at 35% 30%, #f6efe0 0%, #d8cdb6 60%, #a89674 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,.7) inset, 0 -3px 8px rgba(0,0,0,.1) inset, 0 12px 24px -10px rgba(43,37,32,.35)',
        cursor: 'grab', touchAction: 'none', userSelect: 'none',
      }}>
        <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 21 }).map((_, i) => {
            const a = (-135 + 270 * (i / 20)) * Math.PI / 180
            const r1 = size / 2 - 4, r2 = size / 2 - (i % 5 === 0 ? 13 : 8)
            return <line key={i}
              x1={size / 2 + r1 * Math.cos(a)} y1={size / 2 + r1 * Math.sin(a)}
              x2={size / 2 + r2 * Math.cos(a)} y2={size / 2 + r2 * Math.sin(a)}
              stroke={i % 5 === 0 ? 'rgba(43,37,32,.6)' : 'rgba(43,37,32,.25)'}
              strokeWidth={i % 5 === 0 ? 1.5 : 1} />
          })}
        </svg>
        <div style={{
          position: 'absolute', inset: 12, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #fcf7eb 0%, #cabd9f 70%, #847357 100%)',
          boxShadow: '0 2px 6px rgba(0,0,0,.18), 0 1px 0 rgba(255,255,255,.6) inset',
          transform: `rotate(${angle}deg)`,
        }}>
          <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 4, height: size / 2 - 18, background: 'var(--terra)', borderRadius: 2 }} />
        </div>
      </div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', color: 'var(--ink-mute)', fontWeight: 600 }}>WINDOW</div>
    </div>
  )
}

// ── MomentumPanel ──────────────────────────────────────────────────────────────

interface UnderratedData { sector: string; count_30d: number; momentum: number }

function MomentumPanel({ data, loading, onSelect }: { data: UnderratedData[]; loading: boolean; onSelect: (s: string) => void }) {
  const [angle, setAngle] = useState(-45)
  const winLabel = angle < -90 ? '7D' : angle < 0 ? '30D' : angle < 90 ? '60D' : '90D'
  const sorted = [...data].sort((a, b) => b.momentum - a.momentum)
  const max = Math.max(...sorted.map(s => s.momentum), 3)

  return (
    <section className="paper" style={{ padding: '24px 26px' }}>
      <div className="pin brass" style={{ top: 10, left: '50%', transform: 'translateX(-50%)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 28, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Knob angle={angle} setAngle={setAngle} />
          <div style={{ textAlign: 'center' }}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1 }}>{winLabel}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>turn the dial</div>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: 22 }}>Gaining momentum</h2>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>vs. prior period</span>
          </div>
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 24, borderRadius: 8, background: 'rgba(43,37,32,.06)', marginBottom: 8 }} />)
          ) : sorted.length === 0 ? (
            <p style={{ color: 'var(--ink-mute)', fontSize: 13 }}>Momentum data updates every 4 hours.</p>
          ) : sorted.map(s => {
            const w = Math.min(100, (s.momentum / max) * 100)
            const color = s.momentum >= 3 ? '#7CB518' : s.momentum >= 2 ? '#A88B4C' : '#B83A26'
            return (
              <button key={s.sector} onClick={() => onSelect(s.sector)} style={{
                appearance: 'none', border: 'none', background: 'transparent',
                display: 'grid', gridTemplateColumns: '160px 1fr 56px', alignItems: 'center', gap: 12,
                cursor: 'default', padding: '4px 0', textAlign: 'left', width: '100%',
              }}>
                <span style={{ font: '500 13px Instrument Sans', color: 'var(--ink)' }}>{s.sector}</span>
                <div style={{ position: 'relative', height: 14, background: 'rgba(43,37,32,.06)', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${w}%`, background: `linear-gradient(90deg, ${color}55, ${color}cc)`, borderRadius: 7, transition: 'width .4s cubic-bezier(.2,.9,.2,1.1)' }} />
                </div>
                <span className="mono" style={{ textAlign: 'right', fontSize: 12, color, fontWeight: 600 }}>{s.momentum}×</span>
              </button>
            )
          })}
        </div>
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

function PadNote({ note, onMove, onRemove }: { note: PadNote; onMove: (id: string, p: { x: number; y: number }) => void; onRemove: (id: string) => void }) {
  const [local, setLocal] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const startRef = useRef({ mx: 0, my: 0 })
  const colors = NOTE_COLORS[note.state] || NOTE_COLORS['QUIET']

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    setDragging(true)
    startRef.current = { mx: e.clientX, my: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    setLocal({ x: e.clientX - startRef.current.mx, y: e.clientY - startRef.current.my })
  }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    onMove(note.id, { x: note.x + local.x, y: note.y + local.y })
    setLocal({ x: 0, y: 0 })
  }

  return (
    <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      style={{
        position: 'absolute', left: note.x + local.x, top: note.y + local.y,
        width: 190, minHeight: 120, background: colors.bg, padding: '14px 14px 12px', borderRadius: 2,
        boxShadow: dragging ? '0 24px 40px -16px rgba(43,37,32,.4)' : '0 8px 18px -10px rgba(43,37,32,.3), 0 1px 0 rgba(255,255,255,.5) inset',
        transform: `rotate(${note.tilt}deg) ${dragging ? 'scale(1.02)' : ''}`,
        transition: dragging ? 'none' : 'transform .25s, box-shadow .25s',
        cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none',
        zIndex: dragging ? 30 : 1,
      }}>
      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%) rotate(-2deg)', width: 70, height: 18, background: colors.tape, boxShadow: '0 2px 4px rgba(0,0,0,.08)' }} />
      <div className="mono" style={{ fontSize: 9, letterSpacing: '.18em', color: 'rgba(43,37,32,.55)' }}>{note.state}</div>
      <div className="serif" style={{ fontSize: 16, lineHeight: 1.25, marginTop: 6, color: 'var(--ink)' }}>{note.text}</div>
      <div className="mono" style={{ marginTop: 10, fontSize: 10, color: 'rgba(43,37,32,.55)', letterSpacing: '.06em' }}>
        {note.deals30}d/30 · {note.deals90}d/90 · {note.media}m
      </div>
      <button onClick={() => onRemove(note.id)} style={{ position: 'absolute', top: 6, right: 6, appearance: 'none', border: 0, background: 'transparent', color: 'rgba(43,37,32,.4)', fontSize: 14, cursor: 'default', padding: 4 }}>×</button>
    </div>
  )
}

function ThesisPad({ notes, setNotes }: { notes: PadNote[]; setNotes: React.Dispatch<React.SetStateAction<PadNote[]>> }) {
  if (notes.length === 0) return null
  const onMove = (id: string, p: { x: number; y: number }) => setNotes(prev => prev.map(n => n.id === id ? { ...n, ...p } : n))
  const onRemove = (id: string) => setNotes(prev => prev.filter(n => n.id !== id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 className="serif" style={{ margin: 0, fontSize: 26 }}>Thesis Pad</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--ink-mute)' }}>Your pinned theses — drag to rearrange</p>
        </div>
        <button onClick={() => setNotes([])} style={{ appearance: 'none', border: '1px solid rgba(43,37,32,.18)', background: 'rgba(255,255,255,.5)', padding: '6px 12px', borderRadius: 999, font: '500 12px Instrument Sans', color: 'var(--ink-soft)', cursor: 'default' }}>Clear all</button>
      </div>
      <div style={{
        position: 'relative', height: 320, borderRadius: 14, background: '#3A2A1E',
        backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 2px, transparent 2px 6px), url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='c'><feTurbulence baseFrequency='1.4' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.13  0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23c)'/></svg>")`,
        boxShadow: '0 14px 30px -20px rgba(43,37,32,.5), 0 0 0 7px #5A3D24, 0 0 0 8px #2B1B0F',
        overflow: 'hidden',
      }}>
        <div className="pin brass" style={{ top: 14, left: 14 }} />
        <div className="pin brass" style={{ top: 14, right: 14 }} />
        <div className="pin brass" style={{ bottom: 14, left: 14 }} />
        <div className="pin brass" style={{ bottom: 14, right: 14 }} />
        <div className="mono" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, letterSpacing: '.24em', color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>THESIS PAD · drag freely</div>
        <div style={{ position: 'absolute', inset: 32 }}>
          {notes.map(n => <PadNote key={n.id} note={n} onMove={onMove} onRemove={onRemove} />)}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const [topSectors, setTopSectors] = useState<SectorData[]>([])
  const [underrated, setUnderrated] = useState<UnderratedData[]>([])
  const [sectorsLoading, setSectorsLoading] = useState(true)
  const [underratedLoading, setUnderratedLoading] = useState(true)
  const [padNotes, setPadNotes] = useState<PadNote[]>([])

  useEffect(() => {
    fetch('/api/top-sectors').then(r => r.json()).then(d => { setTopSectors(Array.isArray(d) ? d : []); setSectorsLoading(false) }).catch(() => setSectorsLoading(false))
    fetch('/api/underrated-sectors').then(r => r.json()).then(d => { setUnderrated(Array.isArray(d) ? d : []); setUnderratedLoading(false) }).catch(() => setUnderratedLoading(false))
    try { const s = localStorage.getItem('premia-pad-notes'); if (s) setPadNotes(JSON.parse(s)) } catch (_) {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('premia-pad-notes', JSON.stringify(padNotes)) } catch (_) {}
  }, [padNotes])

  const handleAnalyse = (thesis: string) => router.push(`/results?thesis=${encodeURIComponent(thesis)}`)

  const handlePin = (sector: string, geo: string) => {
    setPadNotes(prev => [...prev, {
      id: Date.now().toString(),
      text: `${sector} in ${geo}`,
      state: 'QUIET',
      x: 20 + (prev.length % 4) * 210,
      y: 30 + Math.floor(prev.length / 4) * 140,
      tilt: (Math.random() - 0.5) * 6,
      deals30: 0, deals90: 0, media: 0,
    }])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3' }}>
      <header style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="serif" style={{ fontSize: '1.5rem', color: 'var(--ink)' }}>Premia</span>
        <button onClick={() => router.push('/brief')} className="btn-glow"
          style={{ fontSize: '0.85rem', fontWeight: 600, padding: '6px 16px', borderRadius: 999, color: '#3B2F2F', backgroundColor: '#A3E635', border: 'none', cursor: 'default' }}>
          Intelligence Brief of the day!
        </button>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '8px 24px 60px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <SignalBoard onAnalyse={handleAnalyse} onPin={handlePin} />
          <SectorBoard data={topSectors} loading={sectorsLoading} onSelect={handleAnalyse} />
          <MomentumPanel data={underrated} loading={underratedLoading} onSelect={handleAnalyse} />
          <ThesisPad notes={padNotes} setNotes={setPadNotes} />
        </div>
      </main>

      <footer style={{ padding: '16px 32px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--ink-mute)' }}>
        Premia · Deal intelligence for deal professionals
        <span style={{ margin: '0 8px' }}>·</span>
        <a href="mailto:manishapoojari48@gmail.com" style={{ color: 'var(--ink-soft)', fontWeight: 600, textDecoration: 'none' }}>Contact</a>
      </footer>
    </div>
  )
}

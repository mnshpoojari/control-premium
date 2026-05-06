'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Brief { date: string; content: string; generated_at: string }

// ── Content parser ────────────────────────────────────────────────────────────

function parseContent(raw: string) {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Find URL for each headline (scan within 7 lines)
  const urlFor = new Map<number, string>()
  const urlLines = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    if (/^https?:\/\//.test(lines[i])) continue
    if (lines[i].length > 130) continue
    if (/^\*\*[^*]+\*\*$/.test(lines[i])) continue
    for (let j = i + 1; j < Math.min(i + 7, lines.length); j++) {
      if (/^https?:\/\//.test(lines[j])) { urlFor.set(i, lines[j]); urlLines.add(j); break }
    }
  }

  type Block = { type: 'section'; text: string } | { type: 'deal'; headline: string; url: string } | { type: 'para'; text: string }
  const blocks: Block[] = []

  for (let i = 0; i < lines.length; i++) {
    if (urlLines.has(i)) continue
    const line = lines[i]

    if (/^\*\*[^*]+\*\*$/.test(line)) {
      blocks.push({ type: 'section', text: line.slice(2, -2) })
      continue
    }
    if (/^https?:\/\//.test(line)) continue

    if (urlFor.has(i)) {
      blocks.push({ type: 'deal', headline: line, url: urlFor.get(i)! })
      continue
    }

    blocks.push({ type: 'para', text: line })
  }
  return blocks
}

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: 'var(--ink)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : part
  )
}

// ── Broadsheet renderer ───────────────────────────────────────────────────────

function BriefContent({ content }: { content: string }) {
  const blocks = parseContent(content)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {blocks.map((block, i) => {
        if (block.type === 'section') {
          return (
            <div key={i} style={{ margin: '2.5rem 0 1rem', paddingTop: '1.5rem', borderTop: '1.5px solid rgba(43,37,32,.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ font: `600 10px var(--font-mono, monospace)`, letterSpacing: '.2em', color: 'var(--ink-mute)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>§</span>
              <h2 style={{ fontFamily: `var(--font-serif, serif)`, color: 'var(--ink)', fontSize: '1.25rem', fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>{block.text}</h2>
            </div>
          )
        }

        if (block.type === 'deal') {
          let domain = block.url
          try { domain = new URL(block.url).hostname.replace('www.', '') } catch (_) {}
          return (
            <a key={i} href={block.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', textDecoration: 'none', margin: '0 0 10px', padding: '14px 16px', borderRadius: 10, background: 'rgba(43,37,32,.04)', border: '1px solid rgba(43,37,32,.10)', transition: 'all .15s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(43,37,32,.07)'; el.style.borderColor = 'rgba(43,37,32,.18)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(43,37,32,.04)'; el.style.borderColor = 'rgba(43,37,32,.10)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ margin: 0, font: '600 14px/1.4 Instrument Sans', color: 'var(--ink)' }}>{block.headline}</p>
                <span style={{ color: 'var(--accent-deep)', fontSize: 16, opacity: .7, flexShrink: 0, marginTop: 1 }}>↗</span>
              </div>
              <div style={{ marginTop: 6, font: `500 11px var(--font-mono, monospace)`, color: 'var(--ink-mute)', letterSpacing: '.04em' }}>{domain}</div>
            </a>
          )
        }

        // paragraph
        return (
          <p key={i} style={{ fontFamily: 'Instrument Sans, sans-serif', color: 'var(--ink-soft)', lineHeight: 1.8, fontSize: '0.94rem', margin: '0 0 0.85rem', opacity: .9 }}>
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}

function BriefSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[88, 72, 96, 80, 60, 90, 68, 84, 76, 95, 65, 78].map((w, i) => (
        <div key={i} className="shimmer" style={{ height: 14, width: `${w}%`, borderRadius: 4, background: 'rgba(43,37,32,.10)' }} />
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BriefPage() {
  const router = useRouter()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/brief/latest').then(r => r.json()).then(d => { setBrief(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const dateObj = brief?.date ? new Date(brief.date + 'T12:00:00') : null
  const dayName = dateObj?.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const dateFormatted = dateObj?.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeFormatted = brief?.generated_at
    ? new Date(brief.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    : null

  const today = new Date()
  const todayStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3' }}>

      {/* Masthead */}
      <div style={{ borderBottom: '3px solid var(--ink)', padding: '0 0 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 24px 0' }}>
          {/* Top rule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(43,37,32,.2)' }} />
            <span style={{ fontFamily: `var(--font-mono, monospace)`, fontSize: 9, letterSpacing: '.22em', color: 'var(--ink-mute)' }}>PRIVATE MARKETS INTELLIGENCE</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(43,37,32,.2)' }} />
          </div>

          {/* Wordmark row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, paddingBottom: 16 }}>
            <div>
              <div style={{ fontFamily: `var(--font-serif, serif)`, fontSize: 52, fontWeight: 400, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                Premia
                <span style={{ color: 'var(--terra)', fontSize: '0.5em', verticalAlign: 'super', marginLeft: 2 }}>·</span>
              </div>
              <div style={{ fontFamily: `var(--font-mono, monospace)`, fontSize: 11, letterSpacing: '.16em', color: 'var(--ink-mute)', marginTop: 4 }}>INTELLIGENCE BRIEF</div>
            </div>
            <div style={{ textAlign: 'right', paddingBottom: 6 }}>
              <div style={{ fontFamily: `var(--font-mono, monospace)`, fontSize: 11, letterSpacing: '.1em', color: 'var(--ink-mute)' }}>
                {dayName && <span>{dayName} · </span>}
                {dateFormatted || todayStr}
              </div>
              {timeFormatted && (
                <div style={{ fontFamily: `var(--font-mono, monospace)`, fontSize: 10, color: 'var(--ink-mute)', marginTop: 3, letterSpacing: '.06em' }}>
                  Published {timeFormatted}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 24px 0' }}>
        <button onClick={() => router.push('/')} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--ink-mute)', font: '500 13px Instrument Sans', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0 }}>
          ← Back to Premia
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 24px 60px' }}>
        <div style={{ background: 'var(--paper)', borderRadius: 14, border: '1px solid rgba(43,37,32,.10)', boxShadow: '0 10px 24px -18px rgba(43,37,32,.25), 0 1px 0 rgba(255,255,255,.6) inset', padding: '32px 36px', position: 'relative' }}>
          {/* Paper texture */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence baseFrequency='.85' numOctaves='1' seed='2'/><feColorMatrix values='0 0 0 0 0.18  0 0 0 0 0.14  0 0 0 0 0.10  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>")`,
            mixBlendMode: 'multiply', opacity: .5 }} />

          {loading ? <BriefSkeleton /> : !brief ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}>
              <div style={{ fontFamily: `var(--font-serif, serif)`, fontSize: '1.5rem', color: 'var(--ink-mute)', marginBottom: 12 }}>No brief today — yet.</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--ink-mute)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
                The Intelligence Brief publishes every morning at 9 AM IST. Check back shortly.
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Lede rule */}
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px dashed rgba(43,37,32,.18)' }}>
                <p style={{ fontFamily: `var(--font-serif, serif)`, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--ink-soft)', margin: 0 }}>
                  Today&rsquo;s edition covers confirmed transactions, emerging themes, and what the deal flow says about where capital is moving.
                </p>
              </div>
              <BriefContent content={brief.content} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-mute)', margin: 0, fontFamily: `var(--font-mono, monospace)`, letterSpacing: '.06em' }}>
            Premia · Deal intelligence for deal professionals
          </p>
          <button onClick={() => router.push('/')} style={{ appearance: 'none', border: '1px solid rgba(43,37,32,.18)', background: 'rgba(255,255,255,.5)', color: 'var(--ink-soft)', font: '500 12px Instrument Sans', padding: '7px 14px', borderRadius: 999, cursor: 'default' }}>
            Search a thesis →
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SERIF = 'var(--font-serif), serif'
const SANS = 'var(--font-sans), sans-serif'
const C = {
  bg: '#FAF8F3',
  card: '#ECE6DB',
  border: 'rgba(59,47,47,0.12)',
  text: '#3B2F2F',
  muted: 'rgba(59,47,47,0.55)',
  faint: 'rgba(59,47,47,0.35)',
  accent: '#A3E635',
}

interface Brief { date: string; content: string; generated_at: string }

// ── Prose renderer ─────────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function BriefRenderer({ content }: { content: string }) {
  const elements: React.ReactNode[] = []
  content.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return

    if (/^\*\*[^*]+\*\*$/.test(line)) {
      elements.push(
        <h2 key={`h-${i}`} style={{ fontFamily: SERIF, color: C.text, fontSize: '1.15rem', fontWeight: 400, marginTop: '2.25rem', marginBottom: '0.6rem', letterSpacing: '-0.01em' }}>
          {line.slice(2, -2)}
        </h2>
      )
      return
    }

    if (/^https?:\/\/\S+$/.test(line)) {
      const domain = (() => { try { return new URL(line).hostname.replace('www.', '') } catch { return line } })()
      elements.push(
        <a key={`url-${i}`} href={line} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', color: C.accent, fontSize: '0.78rem', marginBottom: '0.85rem', borderBottom: `1px solid rgba(216,30,91,0.3)`, textDecoration: 'none', fontFamily: SANS }}>
          {domain} ↗
        </a>
      )
      return
    }

    elements.push(
      <p key={`p-${i}`} style={{ color: C.text, lineHeight: 1.85, fontSize: '0.95rem', marginBottom: '0.9rem', opacity: 0.88, fontFamily: SANS }}>
        {renderInline(line)}
      </p>
    )
  })
  return <>{elements}</>
}

function BriefSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[90, 75, 100, 85, 60, 95, 70, 88, 65, 100, 80].map((w, i) => (
        <div key={i} className="rounded animate-pulse" style={{ height: 14, width: `${w}%`, backgroundColor: 'rgba(31,3,34,0.1)' }} />
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
    fetch('/api/brief/latest')
      .then(r => r.json())
      .then(d => { setBrief(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const formattedDate = brief?.date
    ? new Date(brief.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const formattedTime = brief?.generated_at
    ? new Date(brief.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, fontFamily: SANS }}>
      <div className="max-w-2xl mx-auto px-6 py-10">

        <div className="mb-10">
          <button onClick={() => router.push('/')} className="text-sm mb-4 block transition-opacity hover:opacity-60" style={{ color: C.muted }}>
            ← Premia
          </button>
          <h1 style={{ fontFamily: SERIF, color: C.text, fontSize: '2rem', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Intelligence Brief
          </h1>
          {formattedDate && <p className="mt-1.5 text-sm" style={{ color: C.muted }}>{formattedDate}</p>}
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          {loading ? (
            <BriefSkeleton />
          ) : !brief ? (
            <div className="py-8 text-center">
              <p style={{ color: C.muted, fontSize: '0.9rem' }}>Today&apos;s brief hasn&apos;t been published yet.</p>
              <p className="mt-2 text-sm" style={{ color: C.faint }}>The Intelligence Brief is published every day at 8AM IST.</p>
            </div>
          ) : (
            <BriefRenderer content={brief.content} />
          )}
        </div>

        {brief && !loading && (
          <p className="mt-5 text-center text-xs" style={{ color: C.faint }}>
            Published {formattedTime} · New brief every day at 8AM IST
          </p>
        )}

      </div>
    </div>
  )
}

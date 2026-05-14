'use client'

import { useRouter } from 'next/navigation'

const CREDIBILITY_SOURCES = [
  { name: 'Mordor Intelligence', tier: 'Primary' },
  { name: 'MarketsandMarkets', tier: 'Primary' },
  { name: 'Grand View Research', tier: 'Primary' },
  { name: 'Statista', tier: 'Primary' },
  { name: 'IMARC Group', tier: 'Primary' },
  { name: 'Allied Market Research', tier: 'Primary' },
  { name: 'Fortune Business Insights', tier: 'Primary' },
  { name: 'KPMG', tier: 'Advisory' },
  { name: 'PwC', tier: 'Advisory' },
  { name: 'EY', tier: 'Advisory' },
  { name: 'Deloitte', tier: 'Advisory' },
  { name: 'McKinsey & Company', tier: 'Advisory' },
  { name: 'BCG', tier: 'Advisory' },
  { name: 'Financial Times', tier: 'Press' },
  { name: 'Bloomberg', tier: 'Press' },
  { name: 'Reuters', tier: 'Press' },
  { name: 'Wall Street Journal', tier: 'Press' },
  { name: 'Economic Times', tier: 'Press' },
  { name: 'Mint', tier: 'Press' },
]

const TIER_COLOR: Record<string, string> = {
  Primary:  'rgba(124,181,24,.2)',
  Advisory: 'rgba(168,139,76,.2)',
  Press:    'rgba(43,37,32,.08)',
}

const TIER_TEXT: Record<string, string> = {
  Primary:  '#4a7a00',
  Advisory: '#7a5a00',
  Press:    'var(--ink-mute)',
}

export default function MethodologyPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F3' }}>
      <header style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(43,37,32,.08)' }}>
        <button onClick={() => router.push('/')} style={{ appearance: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'default', display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span className="serif" style={{ fontSize: '1.4rem', color: 'var(--ink)', lineHeight: 1 }}>
            Premia<span style={{ color: 'var(--terra)', fontSize: '0.6em', verticalAlign: 'super', marginLeft: 1 }}>·</span>
          </span>
        </button>
      </header>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px' }}>
        <button onClick={() => router.back()} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--ink-mute)', font: '500 12px Instrument Sans', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 24, padding: 0 }}>
          ← Back
        </button>

        <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.1, margin: '0 0 8px', fontWeight: 400 }}>How we source market data</h1>
        <p style={{ margin: '0 0 40px', fontSize: 15, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
          Every figure in the Market Context panel comes from a verifiable external source. Here is exactly how the data is retrieved and ranked.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          <section className="paper" style={{ padding: '22px 26px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 8 }}>STEP 1</div>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10, fontWeight: 400 }}>Live web retrieval via Tavily</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
              When you submit a thesis, Premia runs six parallel searches using <strong>Tavily</strong> — a search API built for structured data retrieval. The searches target CAGR figures, market size estimates, EV multiples, funding trends, competitive landscape, and emerging opportunities. Each search returns up to three results, filtered for relevance and deduplicated by URL.
            </p>
            <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
              A blocklist removes SEO content farms and press release wires — sources like PRNewswire, BusinessWire, and DataIntelo that republish unverified figures — before any numbers are extracted.
            </p>
          </section>

          <section className="paper" style={{ padding: '22px 26px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 8 }}>STEP 2</div>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10, fontWeight: 400 }}>Regex extraction — no LLM guessing</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
              CAGR, market size, and EV multiples are extracted using deterministic regex patterns — not a language model. The extractor looks for explicit numeric patterns such as <span className="mono" style={{ background: 'rgba(43,37,32,.06)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>CAGR of 14.5%</span> or <span className="mono" style={{ background: 'rgba(43,37,32,.06)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>$76.2 billion</span>. If the pattern is not present in the retrieved text, the field is returned as null rather than inferred.
            </p>
            <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
              This means: every number shown has a verbatim match in a real document. Premia does not interpolate or estimate market figures.
            </p>
          </section>

          <section className="paper" style={{ padding: '22px 26px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 8 }}>STEP 3</div>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10, fontWeight: 400 }}>Source credibility ranking</div>
            <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
              When multiple sources report different figures for the same metric, Premia picks the one from the most credible source using a fixed priority order. Primary market research firms rank highest, followed by advisory and consulting firms, then financial press. The source name and URL are always shown so you can verify the figure directly.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CREDIBILITY_SOURCES.map(s => (
                <span key={s.name} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: TIER_COLOR[s.tier], color: TIER_TEXT[s.tier], fontFamily: 'var(--font-mono, monospace)' }}>
                  {s.name}
                </span>
              ))}
            </div>
          </section>

          <section className="paper" style={{ padding: '22px 26px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 8 }}>STEP 4</div>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10, fontWeight: 400 }}>Key insight synthesis</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
              The quoted insight below the metrics is the one place where a language model (Gemini Flash Lite) is used. It reads the top retrieved snippets and writes a single sentence naming the most important market dynamic — a number, a company, a policy, or a structural shift. It is instructed to avoid generic phrases and to anchor to something specific in the text. If no credible insight can be written from the available snippets, the field is omitted.
            </p>
          </section>

          <section className="paper" style={{ padding: '22px 26px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-mute)', marginBottom: 8 }}>CACHING</div>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10, fontWeight: 400 }}>7-day result cache</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
              Market context results are cached per sector × geography for seven days. This reduces latency on repeat queries and limits unnecessary search API calls. After seven days, the next query for that sector and geography triggers a fresh retrieval run.
            </p>
          </section>

        </div>

        <div style={{ marginTop: 40, padding: '18px 22px', background: 'rgba(43,37,32,.04)', borderRadius: 12, border: '1px solid rgba(43,37,32,.08)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink-soft)' }}>Limitations:</strong> Market research figures vary significantly between reports due to different scope definitions and methodologies. Premia selects the most credible available figure, but sector boundaries are inherently fuzzy. EV multiples reflect listed peer medians where data is available — they may not reflect the specific sub-segment of your thesis. Always verify figures against the cited source before using them in client materials.
          </p>
        </div>
      </div>
    </div>
  )
}

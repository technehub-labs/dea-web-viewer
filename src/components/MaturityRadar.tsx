// MaturityRadar — the CR-MM-02 (Phase C consumer support) production component.
// Renders the dual-band v1+v2 maturity radar (Proposal C adopted by user on
// 2026-08-21). v1 legacy linear bands appear behind in teal/opacity; v2
// non-linear bands appear in front with canonical colours from the synced
// maturity-bands-v2.yaml.
//
// Layout discipline (vs the proposal C mock):
//   - SVG region: ONLY the radar + the score marker line. No labels.
//   - Top tab strip: 5 band-name chips with v1 → v2 mapping.
//   - Footer table: per-band detail (range, width, effort_multiplier).
//   - Worked example caption: outside the SVG (no more overlap).
//   - Colours come from the canonical registry, not hard-coded.
import { useEffect, useState } from 'react'
import { loadMaturityData, V2_BANDS, V1_BANDS, WORKED_EXAMPLE, type MaturityLevel, type V1Level } from '../lib/maturity-v2-loader'
import { flag } from '../lib/feature-flags'

interface Props {
  /** Optional pre-loaded data; if not provided, the component fetches via loadMaturityData(). */
  data?: { v2_bands: MaturityLevel[]; v1_bands: V1Level[] }
  /** Optional rendered score (0..100). Defaults to CR-014 worked example (80). */
  score?: number
}

export function MaturityRadar({ data: dataProp, score = WORKED_EXAMPLE.score }: Props) {
  const [data, setData] = useState(dataProp)
  useEffect(() => {
    if (dataProp) return
    let cancelled = false
    loadMaturityData().then(d => { if (!cancelled) setData(d) })
    return () => { cancelled = true }
  }, [dataProp])

  // If the maturityV2 flag is OFF, render nothing. App.tsx gates mounting on
  // this — defence in depth.
  if (!flag('maturityV2')) return null

  const v2 = data?.v2_bands ?? V2_BANDS
  const v1 = data?.v1_bands ?? V1_BANDS
  const safeScore = Math.max(0, Math.min(100, score))

  // ----- SVG layout constants -----
  // viewBox 0..480 x 0..420. Radar centered at cx=240, cy=240. Inner radius 80,
  // outer 220. Labels are OUTSIDE the SVG via the footer table; the SVG
  // carries only arcs + score marker.
  const cx = 240
  const cy = 240
  const innerR = 80
  const outerR = 220
  const strokeW = 12

  const rFor = (v: number) => innerR + (v / 100) * (outerR - innerR)
  const half = (i: number, total: number) => -Math.PI + (i / total) * 2 * Math.PI
  const end  = (i: number, total: number) => -Math.PI + ((i + 1) / total) * 2 * Math.PI

  const arcOf = (axisA: number, axisB: number, r: number) => {
    const x1 = cx + r * Math.cos(axisA), y1 = cy + r * Math.sin(axisA)
    const x2 = cx + r * Math.cos(axisB), y2 = cy + r * Math.sin(axisB)
    const large = Math.abs(axisB - axisA) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  // Find which v2 band holds the score; if exactly on a boundary (e.g. 70),
  // land on the higher band.
  const v2Hit = (() => {
    for (let i = v2.length - 1; i >= 0; i--) {
      if (safeScore >= v2[i].range[0]) return v2[i]
    }
    return v2[0]
  })()

  return (
    <div className="bg-[#161b22] border border-[rgba(45,212,191,0.18)] rounded-lg p-6 font-sans text-[#e6edf3]">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Maturity radar (v1 + v2 dual-band)
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] border border-[rgba(45,212,191,0.35)] px-2 py-1 rounded">
          Experimental · maturityV2
        </span>
      </div>

      {/* Top chip strip: 5 band names with v1 → v2 mapping. Labels are OUTSIDE
          the SVG region, so they can never overlap with title or score marker. */}
      <div className="flex flex-wrap gap-2 mb-4">
        {v2.map((b, i) => (
          <div key={b.id}
               className="flex items-center gap-2 px-3 py-1 rounded border"
               style={{
                 borderColor: b.colour,
                 background: 'rgba(255,255,255,0.02)',
               }}>
            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: b.colour }} />
            <span className="text-sm font-semibold" style={{ color: b.colour }}>{b.name}</span>
            <span className="text-xs text-[#8b949e]">(was {v1[i].name})</span>
          </div>
        ))}
      </div>

      {/* The SVG region — only radar geometry + score marker. No labels. */}
      <div className="bg-[#0d1117] rounded">
        <svg viewBox="0 0 480 420" className="w-full h-auto" role="img"
             aria-label={`Maturity radar — score ${safeScore} lands in ${v2Hit.name} (was ${v2Hit.legacy_name})`}>
          <defs>
            <radialGradient id="mrBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#161b22" />
              <stop offset="100%" stopColor="#0d1117" />
            </radialGradient>
          </defs>
          <rect width="480" height="420" fill="url(#mrBg)" rx="6" />

          {/* concentric reference rings: 0/25/50/75/100 */}
          {[0, 25, 50, 75, 100].map(g => (
            <g key={g}>
              <line x1={cx + rFor(g) * Math.cos(-Math.PI)} y1={cy + rFor(g) * Math.sin(-Math.PI)}
                    x2={cx + rFor(g) * Math.cos(0)}      y2={cy + rFor(g) * Math.sin(0)}
                    stroke="rgba(45,212,191,0.10)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={cx + rFor(g) * Math.cos(0) + 6} y={cy - 4} fill="#8b949e" fontSize="10">{g}</text>
            </g>
          ))}

          {/* v1 legacy bands — teal, BEHIND */}
          {v1.map((b, i) => (
            <path key={`v1-${b.id}`}
                  d={arcOf(half(i, v1.length), end(i, v1.length), rFor(b.range[1] - 0.5) - strokeW/2)}
                  stroke={b.colour}
                  strokeWidth={strokeW}
                  fill="none" strokeLinecap="butt" opacity="0.35" />
          ))}

          {/* v2 non-linear bands — canonical colours, FRONT */}
          {v2.map((b, i) => (
            <path key={`v2-${b.id}`}
                  d={arcOf(half(i, v2.length), end(i, v2.length), rFor(b.range[1] - 0.5) - strokeW/2 + 4)}
                  stroke={b.colour}
                  strokeWidth={strokeW}
                  fill="none" strokeLinecap="butt" opacity="0.9" />
          ))}

          {/* score marker — radial line from center to the score position.
              Anchored inside the SVG to the score radius; label sits OUTSIDE
              via a foreign rect in the footer. */}
          {(() => {
            // 80 lands at the v2 Adaptive band (i=3). For other scores, pick
            // the band that holds the score.
            const v2BandIndex = v2.findIndex(b => safeScore >= b.range[0])
            const angle = -Math.PI + (Math.max(0, v2BandIndex) + 0.5) * (2 * Math.PI / 5)
            const r = rFor(safeScore)
            return (
              <g>
                <line x1={cx} y1={cy}
                      x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
                      stroke="#e6edf3" strokeWidth="2" strokeDasharray="2 2" />
                <circle cx={cx + r * Math.cos(angle)} cy={cy + r * Math.sin(angle)}
                        r="5" fill="#e6edf3" />
              </g>
            )
          })()}
        </svg>
      </div>

      {/* Worked-example / current-score caption — outside the SVG */}
      <div className="mt-4 px-4 py-3 rounded bg-[rgba(45,212,191,0.06)] border border-[rgba(45,212,191,0.25)]">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold" style={{ color: v2Hit.colour }}>
            {v2Hit.name}
          </span>
          <span className="text-sm text-[#8b949e]">
            (was <span className="line-through text-[#8b949e]">{v2Hit.legacy_name}</span>)
          </span>
        </div>
        <div className="text-xs text-[#8b949e] mt-1">
          Score <span className="text-[#e6edf3] font-semibold">{safeScore}</span>
          {' '}· range {v2Hit.range[0]}–{v2Hit.range[1]}
          {' '}· width {v2Hit.width} pts
          {' '}· effort ×{v2Hit.effort_multiplier}
        </div>
      </div>

      {/* Footer table — per-band detail with v1 → v2 columns */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-[#8b949e] border-b border-[rgba(45,212,191,0.18)]">
              <th className="py-1 pr-3">v1 (legacy)</th>
              <th className="py-1 pr-3">v2 (canonical)</th>
              <th className="py-1 pr-3">Range</th>
              <th className="py-1 pr-3">Width</th>
              <th className="py-1 pr-3">×effort</th>
            </tr>
          </thead>
          <tbody>
            {v2.map((b, i) => (
              <tr key={b.id}
                  className={`border-b border-[rgba(45,212,191,0.06)] ${v2Hit.id === b.id ? 'bg-[rgba(45,212,191,0.06)]' : ''}`}>
                <td className="py-1 pr-3 text-[#8b949e]">{v1[i].name}</td>
                <td className="py-1 pr-3 font-semibold">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: b.colour }} />
                  {b.name}
                </td>
                <td className="py-1 pr-3 text-[#8b949e]">{b.range[0]}–{b.range[1]}</td>
                <td className="py-1 pr-3 text-[#8b949e]">{b.width}</td>
                <td className="py-1 pr-3 text-[#2dd4bf]">×{b.effort_multiplier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-[#484f58]">
        Source:{' '}
        <a className="underline text-[#8b949e]" href="https://github.com/technehub-labs/dea-metamodel/blob/main/assessment-models/maturity/maturity-bands-v2.yaml" target="_blank" rel="noreferrer">
          technehub-labs/dea-metamodel/assessment-models/maturity/maturity-bands-v2.yaml
        </a>
        {' '}· CR-MM-02 (Phase C consumer support)
      </p>
    </div>
  )
}

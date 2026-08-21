// Maturity v2 data loader — vendored YAMLs are the runtime source; inlined
// literals are the canonical single source of truth that the vendored files
// are drift-checked against.
// Source: technehub-labs/dea-metamodel/assessment-models/maturity/ (CR-014 +
// CR-MM-01 + CR-MM-01.1). The vendored YAML at /data/maturity/maturity-bands-v2.yaml
// is updated by `.github/workflows/sync-from-dea-metamodel.yml` on canonical
// release tags.
// CR-MM-02-VIEWER Stage 2.

export interface MaturityLevel {
  id: string                    // 'level-1-emergent'
  name: string                  // 'Emergent'
  legacy_name: string          // 'Ad Hoc' (the v1 equivalent name)
  range: [number, number]       // [lo, hi] inclusive
  width: number                 // number of points in the band
  effort_multiplier: number     // v2 bands only — narrower type below ensures this
  colour: string                // CSS hex from canonical maturity-bands-v2.yaml
}

/** v1-only attributes — no effort_multiplier. */
export interface V1Level {
  id: string                    // 'level-1-ad-hoc'
  name: string                  // 'Ad Hoc'
  legacy_name: ''               // v1 IS the legacy; legacy_name is empty
  range: [number, number]       // [lo, hi] inclusive
  width: number                 // number of points in the band
  colour: string                // CSS hex
}

/** Canonical v2 bands (non-linear; per CR-014 maturity-bands-v2.yaml). */
export const V2_BANDS: readonly MaturityLevel[] = [
  { id: 'level-1-emergent',         name: 'Emergent',          legacy_name: 'Ad Hoc',                 range: [0,  20], width: 20, effort_multiplier: 1.0, colour: '#f85149' },
  { id: 'level-2-structured',       name: 'Structured',        legacy_name: 'Defined',                range: [21, 45], width: 25, effort_multiplier: 1.5, colour: '#f0883e' },
  { id: 'level-3-systematic',       name: 'Systematic',        legacy_name: 'Managed',                range: [46, 70], width: 25, effort_multiplier: 2.5, colour: '#d29922' },
  { id: 'level-4-adaptive',         name: 'Adaptive',          legacy_name: 'Quantitatively Managed', range: [71, 88], width: 18, effort_multiplier: 4.0, colour: '#2dd4bf' },
  { id: 'level-5-self-optimising', name: 'Self-Optimising',   legacy_name: 'Optimising',             range: [89, 100], width: 12, effort_multiplier: 6.0, colour: '#3fb950' },
]

/**
 * Legacy v1 bands (linear 25/25/25/15/10) — historical/archived source.
 * v1 has no canonical artefact in the live sub-tree; this constant is the
 * codebase-level reference for what a v1 *would* look like at the same
 * boundaries if a v1 instrument were emitted. Colours are picked for the
 * "behind" v1 overlay in the dual-band radar.
 */
export const V1_BANDS: readonly V1Level[] = [
  { id: 'level-1-ad-hoc',                    name: 'Ad Hoc',                 legacy_name: '',  range: [0,  25], width: 26, colour: '#a371f7' },
  { id: 'level-2-defined',                   name: 'Defined',                legacy_name: '',  range: [26, 50], width: 25, colour: '#58a6ff' },
  { id: 'level-3-managed',                   name: 'Managed',                legacy_name: '',  range: [51, 75], width: 25, colour: '#d29922' },
  { id: 'level-4-quantitatively-managed',    name: 'Quantitatively Managed', legacy_name: '',  range: [76, 90], width: 15, colour: '#f0883e' },
  { id: 'level-5-optimising',                name: 'Optimising',             legacy_name: '',  range: [91, 100], width: 10, colour: '#3fb950' },
]

export interface MaturityData {
  v2_bands: MaturityLevel[]
  v1_bands: V1Level[]
  source: string
}

const DEFAULT_DATA: MaturityData = {
  v2_bands: [...V2_BANDS],
  v1_bands: [...V1_BANDS],
  source: 'https://github.com/technehub-labs/dea-metamodel/tree/main/assessment-models/maturity/',
}

/**
 * Fetch the vendored YAML from /data/maturity/maturity-bands-v2.yaml and
 * assert it agrees with the inlined canonical literal. Drift triggers a
 * console warning + falls back to the inlined canonical (the radar must
 * not silently render stale data).
 */
export async function loadMaturityData(fetchFn: typeof fetch = fetch): Promise<MaturityData> {
  try {
    const v2Text = await fetchFn('/data/maturity/maturity-bands-v2.yaml').then(r => r.ok ? r.text() : '')
    if (!v2Text) return DEFAULT_DATA
    const v2Parsed = parseV2BandsYaml(v2Text)
    if (v2Parsed.length !== V2_BANDS.length) {
      console.warn(`[maturity-v2-loader] YAML has ${v2Parsed.length} v2 bands; canonical has ${V2_BANDS.length}. Using canonical.`)
      return DEFAULT_DATA
    }
    for (let i = 0; i < V2_BANDS.length; i++) {
      const a = V2_BANDS[i]
      const b = v2Parsed[i]
      if (a.id !== b.id || a.name !== b.name || a.colour !== b.colour ||
          a.range[0] !== b.range[0] || a.range[1] !== b.range[1] ||
          a.width !== b.width || a.effort_multiplier !== b.effort_multiplier) {
        console.warn(`[maturity-v2-loader] YAML drift on band ${a.id}; falling back to canonical.`)
        return DEFAULT_DATA
      }
    }
    return {
      v2_bands: v2Parsed,
      v1_bands: [...V1_BANDS],
      source: 'https://github.com/technehub-labs/dea-metamodel/tree/main/assessment-models/maturity/',
    }
  } catch {
    return DEFAULT_DATA
  }
}

/** Minimal YAML parser for the v2 bands block (no js-yaml dep added). */
function parseV2BandsYaml(yamlText: string): MaturityLevel[] {
  const out: MaturityLevel[] = []
  const re = /^\s*-\s*id:\s*([\w-]+)\s*\n\s*name:\s*([\w\s-]+?)\s*\n\s*legacy_name:\s*([\w\s-]+?)\s*\n\s*range:\s*\[(\d+),\s*(\d+)\]\s*\n\s*width:\s*(\d+)\s*\n\s*effort_multiplier:\s*([\d.]+)\s*\n\s*colour:\s*"?#([0-9a-fA-F]{6})"?/gm
  let m
  while ((m = re.exec(yamlText)) !== null) {
    out.push({
      id: m[1], name: m[2].trim(), legacy_name: m[3].trim(),
      range: [Number(m[4]), Number(m[5])], width: Number(m[6]),
      effort_multiplier: Number(m[7]),
      colour: '#' + m[8].toLowerCase(),
    })
  }
  return out
}

/** CR-014 worked example: score 80 lands at Adaptive; effort-adjusted value 49.2. */
export const WORKED_EXAMPLE = {
  score: 80,
  band_v2: 'Adaptive',
  band_v2_legacy: 'Quantitatively Managed',  // v1-equivalent name
  band_v1: 'Quantitatively Managed',          // v1 (76-90 → same name)
  effort_adjusted_value: 49.2,
  formula: 'value_realised(S) = Σ points_earned_in(b) / effort_multiplier(b)',
}

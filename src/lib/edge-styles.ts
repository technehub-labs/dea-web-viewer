/* ------------------------------------------------------------------
 * edge-styles.ts
 *
 * Spec-driven edge visual encoding. The graph's relationships carry
 * `rel_type` (realization | composition | aggregation | dependency |
 * flow | governance | association | …) and the visualization profile
 * (CR-8 §67) defines edge styles. Until the profile's `edge_styles`
 * covers per-rel_type encodings (it currently covers lifecycle states:
 * planned/proposed/active/derived), this lib maps rel_types to a
 * stable, spec-compatible visual vocabulary:
 *
 *   - structural edges (composition, aggregation) → solid, warmer hue
 *   - behavioral edges (flow, realization)        → solid, blue
 *   - governance edges                              → dashed, violet
 *   - dependency / association / other              → dashed, slate
 *
 * CR-6 §22 rule (from the profile): "a planned edge must never render
 * as a current edge" — the profile's edge_styles note. The viewer honours
 * this by always drawing non-active semantics with a dashed stroke.
 *
 * Pure data — no React, no DOM; unit-testable.
 * ------------------------------------------------------------------ */

export interface EdgeStyle {
  stroke: string;
  /** CSS stroke-dasharray; undefined = solid. */
  dasharray?: string;
  /** Short legend label. */
  category: string;
}

const SOLID: string | undefined = undefined;

export const REL_TYPE_STYLES: Record<string, EdgeStyle> = {
  // structural — what the enterprise IS made of
  composition: { stroke: '#94a3b8', dasharray: SOLID, category: 'structural' },
  aggregation: { stroke: '#94a3b8', dasharray: SOLID, category: 'structural' },
  // behavioral — what it DOES
  realization: { stroke: '#38bdf8', dasharray: SOLID, category: 'behavioral' },
  flow:        { stroke: '#38bdf8', dasharray: SOLID, category: 'behavioral' },
  serving:     { stroke: '#38bdf8', dasharray: SOLID, category: 'behavioral' },
  execution:   { stroke: '#38bdf8', dasharray: SOLID, category: 'behavioral' },
  // governance — how it is STEERED (CR-7 causal chain)
  governance:  { stroke: '#a78bfa', dasharray: '5,5', category: 'governance' },
  contract:    { stroke: '#a78bfa', dasharray: '5,5', category: 'governance' },
  // weak coupling
  dependency:  { stroke: '#64748b', dasharray: '5,5', category: 'coupling' },
  association: { stroke: '#64748b', dasharray: '2,4', category: 'coupling' },
}

const DEFAULT_STYLE: EdgeStyle = {
  stroke: '#64748b',
  dasharray: '5,5',
  category: 'coupling',
}

/** Look up the visual style for a relationship type (falls back to default). */
export function edgeStyleFor(relType: string | undefined): EdgeStyle {
  if (!relType) return DEFAULT_STYLE;
  return REL_TYPE_STYLES[relType] ?? DEFAULT_STYLE;
}

/** Legend entries for the distinct styles in use (for a canvas legend). */
export function edgeStyleLegend(relTypes: string[]): { relType: string; style: EdgeStyle }[] {
  const seen = new Map<string, EdgeStyle>();
  for (const t of relTypes) {
    if (!seen.has(t)) seen.set(t, edgeStyleFor(t));
  }
  return [...seen.entries()].map(([relType, style]) => ({ relType, style }));
}

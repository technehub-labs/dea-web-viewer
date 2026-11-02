/* ------------------------------------------------------------------
 * viz-profile.ts
 *
 * CR-8 §47-§48 / §67 consumer: presentation hints come from the spec
 * (dea-metamodel/visualization/profile/visualization.yaml), never from
 * the viewer. The canonical profile is inlined here; loadVizProfile()
 * fetches the vendored copy (public/data/visualization/, kept fresh by
 * sync-viz-profile-from-dea-metamodel.yml) and asserts it agrees with
 * the inlined canonical. Drift → console warning + fall back to the
 * canonical (same pattern as maturity-v2-loader.ts).
 *
 * Minimal inline YAML parsing — no js-yaml dependency; the profile's
 * flat `key: {label: X, color: "Y", order: N}` shape is enough.
 * ------------------------------------------------------------------ */

export interface VizGroup {
  key: string;
  label: string;
  color: string;
  order: number;
}

export interface VizProfile {
  version: string;
  groups: VizGroup[];
}

/** Inlined canonical — mirrors dea-metamodel/visualization/profile @ v1.0.0 */
export const CANONICAL_PROFILE: VizProfile = {
  version: '1.0.0',
  groups: [
    { key: 'core',       label: 'OpenDEA Core',      color: '#1f6feb', order: 1 },
    { key: 'business',   label: 'Business',          color: '#8250df', order: 2 },
    { key: 'digital',    label: 'Digital & Services', color: '#0969da', order: 3 },
    { key: 'data',       label: 'Data & Information', color: '#1a7f37', order: 4 },
    { key: 'technology', label: 'Technology',        color: '#6e7781', order: 5 },
    { key: 'ai',         label: 'AI & Models',       color: '#bf3989', order: 6 },
    { key: 'ecosystem',  label: 'Ecosystem',         color: '#0a7ea4', order: 7 },
    { key: 'assessment', label: 'Assessment (CR-5)', color: '#9a6700', order: 8 },
    { key: 'dmm',        label: 'DMM Lens',          color: '#d4a72c', order: 9 },
    { key: 'lifecycle',  label: 'Lifecycle (CR-6)',  color: '#cf222e', order: 10 },
    { key: 'governance', label: 'Governance (CR-7)', color: '#8250df', order: 11 },
    { key: 'agentic',    label: 'Agentic (CR-7)',    color: '#bf3989', order: 12 },
  ],
};

/**
 * Map a profile id ('dea:business' → 'business') to its viz group.
 * Returns undefined when the profile has no canonical presentation
 * hint — callers fall back to their own styling.
 */
export function groupForProfile(profileId: string): VizGroup | undefined {
  const key = profileId.replace(/^dea:/, '');
  return CANONICAL_PROFILE.groups.find((g) => g.key === key);
}

/**
 * Fetch the vendored profile and assert it agrees with the inlined
 * canonical. On drift or fetch failure, warn and fall back.
 */
export async function loadVizProfile(
  fetchLike: (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>,
  url = 'data/visualization/visualization.yaml',
): Promise<{ profile: VizProfile; source: 'canonical' | 'remote' }> {
  try {
    const res = await fetchLike(url);
    if (!res.ok) {
      console.warn(`[viz-profile] ${url} not vendored yet — using inlined canonical. Run sync-viz-profile-from-dea-metamodel.yml.`);
      return { profile: CANONICAL_PROFILE, source: 'canonical' };
    }
    const text = await res.text();
    const parsed = parseVizProfileYaml(text);
    if (!parsed) {
      console.warn('[viz-profile] vendored profile failed to parse — using inlined canonical.');
      return { profile: CANONICAL_PROFILE, source: 'canonical' };
    }
    if (!profilesEquivalent(parsed, CANONICAL_PROFILE)) {
      console.warn(
        `[viz-profile] vendored profile v${parsed.version} drifted from the inlined canonical v${CANONICAL_PROFILE.version} — ` +
          'update CANONICAL_PROFILE in src/lib/viz-profile.ts. Using the vendored copy (spec wins).',
      );
    }
    return { profile: parsed, source: 'remote' };
  } catch (e) {
    console.warn('[viz-profile] fetch failed — using inlined canonical.', e);
    return { profile: CANONICAL_PROFILE, source: 'canonical' };
  }
}

/* ------------------- inline YAML parsing (flat) -------------------- */

export function parseVizProfileYaml(text: string): VizProfile | null {
  const lines = text.split('\n');
  const groups: VizGroup[] = [];
  let version = '';
  let inGroups = false;
  let inIcons = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#') || !line) continue;
    if (line.startsWith('version:')) {
      version = line.split(':', 2)[1].trim();
      continue;
    }
    if (line === 'groups:') { inGroups = true; inIcons = false; continue; }
    if (line === 'icons:') { inIcons = true; inGroups = false; continue; }
    if (/^[a-z_]+:$/.test(line)) { inGroups = false; inIcons = false; continue; }

    if (inGroups) {
      // key: {label: X, color: "Y", order: N}
      const m = line.match(/^([a-z-]+):\s*\{(.+)\}$/);
      if (m) {
        const inner = m[2];
        const label = inner.match(/label:\s*([^,}]+)/)?.[1]?.trim() ?? m[1];
        const color = inner.match(/color:\s*"?([^",}]+)"?/)?.[1]?.trim() ?? '#8b949e';
        const order = Number(inner.match(/order:\s*(\d+)/)?.[1] ?? groups.length + 1);
        groups.push({ key: m[1], label, color, order });
      }
    }
  }

  if (groups.length === 0) return null;
  groups.sort((a, b) => a.order - b.order);
  return { version: version || 'unknown', groups };
}

/** Structural equivalence check (keys + labels + colors). */
export function profilesEquivalent(a: VizProfile, b: VizProfile): boolean {
  if (a.groups.length !== b.groups.length) return false;
  for (const g of a.groups) {
    const other = b.groups.find((x) => x.key === g.key);
    if (!other || other.label !== g.label || other.color !== g.color) {
      return false;
    }
  }
  return true;
}

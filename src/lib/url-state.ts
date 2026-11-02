/* ------------------------------------------------------------------
 * url-state.ts
 *
 * Shareable, deep-linkable viewer state encoded in the URL query string:
 *
 *   ?view=interactive&entity=SO&layers=layer1,layer3&q=objective
 *     &membership=core
 *
 * The URL is the single source of truth on load; in-app mutations
 * replace the URL via history.replaceState so the back button is not
 * polluted with every keystroke (keystrokes are NOT synced to the URL;
 * only committed state — view, selected entity, layer/membership
 * filters — is).
 *
 * Pure parse/serialize functions so this is unit-testable without a DOM.
 * ------------------------------------------------------------------ */

import type { ViewMode, LayerId } from '../types';

export const VALID_VIEWS: ViewMode[] = [
  'canonical-svg',
  'interactive',
  'matrix',
  'traceability',
  'catalogs',
  'maturity-radar',
];

export const VALID_LAYERS: LayerId[] = [
  'layer1',
  'layer2',
  'layer3',
  'layer4',
  'layer5',
  'dim',
];

export interface UrlState {
  view?: ViewMode;
  entity?: string;          // entity alias, e.g. 'SO'
  layers?: LayerId[];       // subset of layers enabled; undefined = all
  membership?: string;      // 'core' | 'profile:<id>' | 'unassigned'; undefined = all
  q?: string;               // committed search term (not per-keystroke)
}

/** Parse a `?a=b` query string (with or without leading '?'). */
export function parseUrlState(search: string): UrlState {
  const qs = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  const state: UrlState = {};

  const view = params.get('view');
  if (view && (VALID_VIEWS as string[]).includes(view)) {
    state.view = view as ViewMode;
  }

  const entity = params.get('entity');
  if (entity) state.entity = entity;

  const layersRaw = params.get('layers');
  if (layersRaw) {
    const layers = layersRaw
      .split(',')
      .map((l) => l.trim())
      .filter((l) => (VALID_LAYERS as string[]).includes(l)) as LayerId[];
    // Only a strict subset is meaningful — "all layers listed" ≡ default.
    if (layers.length > 0 && layers.length < VALID_LAYERS.length) {
      state.layers = layers;
    }
  }

  const membership = params.get('membership');
  if (membership) state.membership = membership;

  const q = params.get('q');
  if (q) state.q = q;

  return state;
}

/** Serialize state back into a query string (no leading '?', may be ''). */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.view) params.set('view', state.view);
  if (state.entity) params.set('entity', state.entity);
  if (state.layers && state.layers.length > 0) {
    params.set('layers', state.layers.join(','));
  }
  if (state.membership) params.set('membership', state.membership);
  if (state.q) params.set('q', state.q);
  return params.toString();
}

/** True when a state carries anything worth putting in the URL. */
export function isDefaultState(state: UrlState): boolean {
  return (
    state.view === undefined &&
    state.entity === undefined &&
    state.layers === undefined &&
    state.membership === undefined &&
    (!state.q || state.q === '')
  );
}

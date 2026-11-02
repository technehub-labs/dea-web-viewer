/* ------------------------------------------------------------------
 * viewpoints.ts
 *
 * Viewpoint generator (dea-web-viewer issue #3): curated persona
 * presets that configure the viewer for a stakeholder concern.
 *
 * A viewpoint is pure, serializable viewer state — layers + membership
 * + a starting entity + a short rationale — so it deep-links via the
 * existing url-state.ts and can be shared as a URL. This mirrors the
 * metamodel's own `Viewpoint` entity semantics (dea:entity-viewpoint):
 * "a tailored perspective on the metamodel for a specific stakeholder
 * concern, rendering a curated subset of entities + relationships".
 *
 * Adding a viewpoint is a data change here, not a UI change.
 * ------------------------------------------------------------------ */

import type { LayerId } from '../types';
import type { UrlState } from './url-state';

export interface Viewpoint {
  id: string;
  label: string;
  audience: string;
  description: string;
  layers: LayerId[];
  /** Optional membership filter key ('core' | 'profile:<id>'). */
  membership?: string;
  /** Entity alias to open in the drawer on load. */
  focusEntity?: string;
}

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: 'cto',
    label: 'CTO',
    audience: 'Technology leadership',
    description:
      'Technology landscape: platforms, infrastructure, integration and the AI/automation surface. L4–L5 plus the governance profile.',
    layers: ['layer4', 'layer5', 'layer3'],
    membership: 'profile:dea:technology',
  },
  {
    id: 'sa',
    label: 'Solution Architect',
    audience: 'Solution & platform architecture',
    description:
      'Structural view: the OpenDEA Core anchors plus application components, system functions and integration interfaces.',
    layers: ['layer3', 'layer4'],
    membership: 'core',
  },
  {
    id: 'ba',
    label: 'Business Analyst',
    audience: 'Process & capability design',
    description:
      'Operating model: capabilities, processes, services and the business objects they exchange. L1–L3 business profile.',
    layers: ['layer1', 'layer2', 'layer3'],
    membership: 'profile:dea:business',
  },
  {
    id: 'data',
    label: 'Data Architect',
    audience: 'Data & information management',
    description:
      'Information layer: business objects, data subjects, concepts and the semantic dimension overlays.',
    layers: ['layer3', 'dim'],
    membership: 'profile:dea:data',
  },
  {
    id: 'gov',
    label: 'Governance Lead',
    audience: 'EA governance & assurance',
    description:
      'Causal/governance chain: guardrails, regulations, risks, controls and the governance profile membership.',
    layers: ['layer1', 'layer2', 'layer5'],
    membership: 'profile:dea:governance',
  },
  {
    id: 'ecosystem',
    label: 'Ecosystem Manager',
    audience: 'Partnerships & value networks',
    description:
      'Value network: actors, stakeholders, signals and the ecosystem agreements that bind them.',
    layers: ['layer1'],
    membership: 'profile:dea:ecosystem',
  },
  {
    id: 'core',
    label: 'OpenDEA Core',
    audience: 'Anyone learning the metamodel',
    description:
      'The stable semantic skeleton: the 9 core anchors across all layers — the minimal complete model.',
    layers: ['layer1', 'layer2', 'layer3', 'layer4', 'layer5'],
    membership: 'core',
  },
];

/** Look up a viewpoint by id (case-insensitive). */
export function getViewpoint(id: string): Viewpoint | null {
  const lower = id.toLowerCase();
  return VIEWPOINTS.find((v) => v.id.toLowerCase() === lower) ?? null;
}

/** Convert a viewpoint into shareable URL state. */
export function viewpointToUrlState(vp: Viewpoint): UrlState {
  return {
    view: 'interactive',
    layers: vp.layers,
    membership: vp.membership,
    ...(vp.focusEntity ? { entity: vp.focusEntity } : {}),
  };
}

/* ------------------------------------------------------------------
 * syncedMetamodel.ts
 *
 * The single source of truth for everything the viewer renders.
 * The artefacts are BAKED INTO THE BUNDLE AT BUILD TIME — no runtime
 * fetching, no base-path / 404 failure modes:
 *
 *   public/data/entity-graph.json — entities, classes, catalog linkage
 *   public/data/metamodel.puml    — PlantUML source (relationships,
 *                                   layer assignments, attributes)
 *   public/data/metamodel.svg     — the canonical SVG ("Official SVG"
 *                                   view)
 *
 * The chain when the metamodel changes upstream:
 *   dea-metamodel → technehub-labs.github.io (publish) →
 *   sync-from-dea-metamodel.yml commits public/data/* here →
 *   the push dispatches deploy-pages.yml → vite build inlines the new
 *   artefacts → the deployed site IS the new metamodel.
 *
 * Hand-edits to public/data/* are overwritten by the CI sync, so this
 * module never falls back to anything else. A missing/invalid artefact
 * fails the BUILD (vite/tsc import error), not the running app.
 *
 * The data shape we expose is intentionally compatible with the
 * MetamodelAST the components already expect, so the rest of the app
 * does not need to know that the source is now CI-driven.
 * ------------------------------------------------------------------ */

import type {
  MetamodelAST,
  MetamodelEntity,
  MetamodelLayer,
  MetamodelRelationship,
  LayerId,
} from '../types';

/* ------- Build-time artefact imports (inlined by vite) ------------ */

import graphJson from '../../public/data/entity-graph.json';
import pumlRaw from '../../public/data/metamodel.puml?raw';
import svgRaw from '../../public/data/metamodel.svg?raw';

/* ----------------------- Entity-graph shape ----------------------- */

export interface EntityGraphEntity {
  entity_id: string;        // dea:entity-strategic-objective
  class_alias: string;      // SO
  display_name: string;     // Strategic Objective
  layer?: string;           // L1 — absent for dimension entities (v0.2.0, e.g. MTR)
  layer_name?: string;      // Ecosystem & Value Network — absent for dimension entities
  dimension?: string;       // measurement-dimension (v0.2.0 dimension entities)
  color?: string;           // #2DD4BF
  catalog_repo: string | null;
  repo_url: string | null;  // https://github.com/...
  status?: 'existing' | 'existing-extended' | 'planned' | 'scaffold';
  description?: string;
  specializes?: string;     // parent class_alias (ADR-0002 D3)
  scope_layers?: string[];  // metric entities: which layers they may evaluate
  measured_by?: string[];   // measurable entities: metric aliases
}

export interface EntityGraphRelationship {
  from: string;
  to: string;
  label: string;
  rel_type: 'realization' | 'composition' | 'aggregation' | 'dependency' | 'flow' | 'governance' | 'association';
  cardinality: string;      // "1:0..N"
  style: 'solid' | 'dashed'; // derived from rel_type (deprecated, back-compat)
}

export interface EntityGraphLayer {
  id: string;               // L1
  name: string;             // Ecosystem & Value Network
  qualifier?: string;
  color?: string;
  dark_color?: string;
}

export interface EntityGraphDimension {
  id: string;               // measurement-dimension
  name: string;             // Measurement Dimension
  kind?: string;
}

export interface EntityGraph {
  metamodel_version: string;
  description?: string;
  viewer_route?: string;
  viewer_url?: string;
  layers?: EntityGraphLayer[];
  dimensions?: EntityGraphDimension[];
  entities: EntityGraphEntity[];
  relationships?: EntityGraphRelationship[];
}

/* ----------------------- Runtime loader --------------------------- */

let _graph: EntityGraph | null = null;
let _puml: string | null = null;
let _svg: string | null = null;
let _metaVersion: string | null = null;

export async function loadSyncedArtefacts(): Promise<void> {
  // Artefacts are baked into the bundle at build time — this just
  // publishes them into module state. Kept async so callers (App.tsx)
  // don't change. A missing artefact fails the vite build upstream,
  // so by the time this runs the data is guaranteed present.
  _graph = graphJson as EntityGraph;
  _puml = pumlRaw;
  _svg = svgRaw;
  _metaVersion = _graph.metamodel_version;
}

export function getMetaVersion(): string {
  return _metaVersion ?? 'unknown';
}

export function getSyncedSvg(): string {
  return _svg ?? '';
}

export function getSyncedPuml(): string {
  return _puml ?? '';
}

export function getEntityGraph(): EntityGraph {
  if (!_graph) {
    throw new Error(
      'Entity graph not loaded yet — call loadSyncedArtefacts() first.'
    );
  }
  return _graph;
}

/* ----------------------- PUML parser ------------------------------ */

/**
 * The synced PUML uses the same syntax the dea-metamodel bot renders:
 *   package "Layer 1: ..." #HEX { entity "Name" as ALIAS { + attr : type } }
 *   ALIAS --> ALIAS2 : "label"
 *
 * The parser deliberately mirrors the structure of the legacy
 * `parsePlantUML` in the old metamodelData.ts so the rest of the app
 * does not need to know the source changed.
 */
export function parseSyncedPuml(pumlText: string): {
  layers: MetamodelLayer[];
  entities: MetamodelEntity[];
  relationships: MetamodelRelationship[];
} {
  const layers: MetamodelLayer[] = [];
  const entities: MetamodelEntity[] = [];
  const relationships: MetamodelRelationship[] = [];

  // Pull the canonical layer defs from the GRAPH (entity-graph.json
  // is the source of truth for layer names and colors), not from the
  // PUML. The PUML is only used for topology + attributes.
  const graph = getEntityGraph();
  const layerOrder: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
  const layerColors: Record<string, string> = {};
  for (const e of graph.entities) {
    if (e.layer && !layerColors[e.layer]) {
      layerColors[e.layer] = e.color ?? '#E8F8F5';
    }
  }
  for (const [lid, num] of Object.entries(layerOrder)) {
    const sample = graph.entities.find((e) => e.layer === lid);
    if (!sample) continue;
    layers.push({
      id: `layer${num}` as LayerId,
      number: num,
      name: sample.layer_name ?? lid,
      subtitle: lid,
      color: layerColors[lid] ?? '#E8F8F5',
      borderColor: '#1ABC9C', // harmonised visual; see theme
      // ---- legacy bag (kept for components that still read it) ----
      badgeBg: '',
      textColor: '',
      description: `${sample.layer_name ?? lid} (${lid})`,
    });
  }

  // v0.2.0 (ADR-0002 D1): dimension entities (no home layer, e.g. MTR) get a
  // cross-cutting pseudo-layer so the canvas renders them below L5.
  const dimEntities = graph.entities.filter((e) => !e.layer);
  if (dimEntities.length) {
    const dimMeta = graph.dimensions?.find((d) => d.id === dimEntities[0].dimension);
    layers.push({
      id: 'dim' as LayerId,
      number: 6,
      name: dimMeta?.name ?? 'Measurement Dimension',
      subtitle: 'DIM',
      color: dimEntities[0].color ?? '#9CA3AF',
      borderColor: '#9CA3AF',
      badgeBg: '',
      textColor: '',
      description: `${dimMeta?.name ?? 'Measurement Dimension'} (cross-cutting — not an architecture layer)`,
    });
  }

  // Build the entity table from the graph (NOT the PUML). The graph
  // is the master record; the PUML is parsed only for attributes.
  const entityByAlias: Record<string, MetamodelEntity> = {};
  for (const e of graph.entities) {
    const isDim = !e.layer;
    const layerId = (isDim ? 'dim' : `layer${layerOrder[e.layer!] ?? 1}`) as LayerId;
    entityByAlias[e.class_alias] = {
      id: e.class_alias,
      name: e.display_name,
      entity_id: e.entity_id,
      layerId,
      layer_name: e.layer_name ?? 'Measurement Dimension',
      catalog_repo: e.catalog_repo ?? undefined,
      repo_url: e.repo_url ?? undefined,
      status: e.status,
      description: e.description,
      attributes: [],
    };
  }

  // Walk the PUML to pick up attribute definitions and relationships.
  const lines = pumlText.split('\n');
  let currentAlias: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("'") || line.startsWith('skinparam') || line.startsWith('!theme')) {
      continue;
    }

    // entity "Name" as ALIAS {
    const entityMatch = line.match(/^entity\s+"([^"]+)"\s+as\s+([A-Za-z0-9_]+)(\s*\{)?$/);
    if (entityMatch) {
      const alias = entityMatch[2];
      currentAlias = alias;
      // Push into the entities list if not already there.
      if (!entityByAlias[alias]) {
        entityByAlias[alias] = {
          id: alias,
          name: entityMatch[1],
          layerId: 'layer1',
          attributes: [],
        };
      }
      if (!entityMatch[3]) {
        // Single line entity
        currentAlias = null;
      }
      continue;
    }

    // + attr : type
    if (currentAlias && line.startsWith('+')) {
      const attrMatch = line.match(/^\+\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/);
      if (attrMatch) {
        entityByAlias[currentAlias].attributes.push({
          name: attrMatch[1],
          type: attrMatch[2],
        });
      }
      continue;
    }

    // End of entity body
    if (currentAlias && line === '}') {
      currentAlias = null;
      continue;
    }

    // ALIAS1 --> ALIAS2 : "label"   (only used for pre-v0.2.0 graphs —
    // v0.2.0 graphs carry relationships[] with rel_type + cardinality)
    if (!graph.relationships) {
      const relMatch = line.match(/^([A-Za-z0-9_]+)\s*(-->|--|\.->|\.\.|-)\s*([A-Za-z0-9_]+)(\s*:\s*"([^"]+)")?$/);
      if (relMatch) {
        relationships.push({
          from: relMatch[1],
          to: relMatch[3],
          label: relMatch[5] ?? '',
          type: relMatch[2].includes('.') ? 'dashed' : 'solid',
        });
        continue;
      }
    }
  }

  // v0.2.0: relationships come from the graph (typed, with cardinality)…
  if (graph.relationships) {
    for (const r of graph.relationships) {
      relationships.push({
        from: r.from,
        to: r.to,
        label: r.cardinality ? `${r.label} [${r.cardinality}]` : r.label,
        type: r.style,
      });
    }
  }
  // …plus specialization edges derived from entity.specializes (ADR-0002 D3).
  for (const e of graph.entities) {
    if (e.specializes) {
      relationships.push({
        from: e.class_alias,
        to: e.specializes,
        label: 'specializes',
        type: 'solid',
      });
    }
  }

  for (const id of Object.keys(entityByAlias)) {
    entities.push(entityByAlias[id]);
  }

  return { layers, entities, relationships };
}

/* --------------------- Public AST builder ------------------------ */

export async function buildMetamodelAst(): Promise<MetamodelAST> {
  if (!_graph || !_puml) {
    await loadSyncedArtefacts();
  }
  const parsed = parseSyncedPuml(_puml!);
  return {
    title: `DEA Metamodel ${_metaVersion}`,
    version: _metaVersion ?? 'unknown',
    layers: parsed.layers,
    entities: parsed.entities,
    relationships: parsed.relationships,
    rawPuml: _puml!,
  };
}

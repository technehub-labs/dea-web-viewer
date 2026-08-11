/* ------------------------------------------------------------------
 * syncedMetamodel.ts
 *
 * The single source of truth for everything the viewer renders.
 * At runtime we load the artefacts that the
 * `.github/workflows/sync-from-dea-metamodel.yml` workflow pulls from
 * `technehub-labs/dea-metamodel`:
 *
 *   /data/entity-graph.json — entities, classes, catalog linkage
 *   /data/metamodel.puml    — PlantUML source (relationships, layer
 *                             assignments, entity attributes)
 *   /data/metamodel.svg     — the canonical SVG (used for the
 *                             "Official SVG" view)
 *
 * Hand-edits to /public/data/* are overwritten by the CI sync, so this
 * module never falls back to baked-in copies. If the synced files are
 * missing we fail loudly — the app cannot operate without them.
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

/* ----------------------- Entity-graph shape ----------------------- */

export interface EntityGraphEntity {
  entity_id: string;        // dea:entity-strategic-objective
  class_alias: string;      // SO
  display_name: string;     // Strategic Objective
  layer: string;            // L1
  layer_name: string;       // Strategic & Investment
  color?: string;           // #E8F8F5
  catalog_repo: string;     // dea-catalog-strategic-objectives
  repo_url: string;         // https://github.com/...
  status?: 'existing' | 'existing-extended' | 'planned' | 'scaffold';
  description?: string;
}

export interface EntityGraph {
  metamodel_version: string;
  description?: string;
  viewer_route?: string;
  viewer_url?: string;
  entities: EntityGraphEntity[];
}

/* ----------------------- Runtime loader --------------------------- */

let _graph: EntityGraph | null = null;
let _puml: string | null = null;
let _svg: string | null = null;
let _metaVersion: string | null = null;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url);
  try {
    return JSON.parse(text) as T;
  } catch (e: any) {
    throw new Error(`Invalid JSON at ${url}: ${e.message}`);
  }
}

export async function loadSyncedArtefacts(): Promise<void> {
  // Load all three in parallel. If any of them 404s we want to surface
  // it immediately — the viewer cannot render without them.
  const [, , json] = await Promise.all([
    fetchText('/data/metamodel.svg').then((t) => (_svg = t)),
    fetchText('/data/metamodel.puml').then((t) => (_puml = t)),
    fetchJson<EntityGraph>('/data/entity-graph.json').then((g) => {
      _graph = g;
      _metaVersion = g.metamodel_version;
    }),
  ]);
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
    if (!layerColors[e.layer]) {
      layerColors[e.layer] = e.color ?? '#E8F8F5';
    }
  }
  for (const [lid, num] of Object.entries(layerOrder)) {
    const sample = graph.entities.find((e) => e.layer === lid);
    if (!sample) continue;
    layers.push({
      id: `layer${num}` as LayerId,
      number: num,
      name: sample.layer_name,
      subtitle: lid,
      color: layerColors[lid] ?? '#E8F8F5',
      borderColor: '#1ABC9C', // harmonised visual; see theme
      // ---- legacy bag (kept for components that still read it) ----
      badgeBg: '',
      textColor: '',
      description: `${sample.layer_name} (${lid})`,
    });
  }

  // Build the entity table from the graph (NOT the PUML). The graph
  // is the master record; the PUML is parsed only for attributes.
  const entityByAlias: Record<string, MetamodelEntity> = {};
  for (const e of graph.entities) {
    const layerId = `layer${layerOrder[e.layer] ?? 1}` as LayerId;
    entityByAlias[e.class_alias] = {
      id: e.class_alias,
      name: e.display_name,
      entity_id: e.entity_id,
      layerId,
      layer_name: e.layer_name,
      catalog_repo: e.catalog_repo,
      repo_url: e.repo_url,
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

    // ALIAS1 --> ALIAS2 : "label"
    const relMatch = line.match(/^([A-Za-z0-9_]+)\s*(-->|--|\.->|\.-)\s*([A-Za-z0-9_]+)(\s*:\s*"([^"]+)")?$/);
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

/* ------------------------------------------------------------------
 * export.ts
 *
 * Export the current viewer state (after layer + membership filters)
 * as:
 *   1. JSON — the scoped entities/relationships subset, with a
 *      provenance header (metamodel version, filter state, URL).
 *   2. PlantUML fragment — the same subset re-emitted as PUML entity
 *      + relationship lines, ready to paste into docs or re-render.
 *
 * Pure functions over the AST — no DOM, so unit-testable. The browser
 * download wiring lives in Header.tsx.
 * ------------------------------------------------------------------ */

import type { MetamodelAST, MetamodelEntity, MetamodelRelationship } from '../types';

export interface ExportOptions {
  /** Provenance: canonical metamodel version. */
  metamodelVersion: string;
  /** The URL the export was made from (deep-link round-trip). */
  url?: string;
  /** Membership filter key applied, if any ('core' | 'profile:<id>'). */
  membership?: string | null;
  /** Layer ids included. */
  layers?: string[];
}

export interface ScopedExport {
  schema: 'dea-web-viewer/export/v1';
  generated_at: string;
  metamodel_version: string;
  source_url?: string;
  filters: { membership?: string | null; layers?: string[] };
  counts: { entities: number; relationships: number };
  entities: ExportedEntity[];
  relationships: ExportedRelationship[];
}

interface ExportedEntity {
  id: string;         // alias, e.g. SO
  name: string;
  entity_id?: string; // dea:entity-strategic-objective
  layer: string;
  status?: string;
  catalog_repo?: string;
  attributes: { name: string; type: string }[];
}

interface ExportedRelationship {
  from: string;
  to: string;
  label: string;
}

export function buildJsonExport(
  ast: MetamodelAST,
  opts: ExportOptions,
): ScopedExport {
  return {
    schema: 'dea-web-viewer/export/v1',
    generated_at: new Date().toISOString(),
    metamodel_version: opts.metamodelVersion,
    source_url: opts.url,
    filters: { membership: opts.membership ?? null, layers: opts.layers },
    counts: {
      entities: ast.entities.length,
      relationships: ast.relationships.length,
    },
    entities: ast.entities.map(toExportedEntity),
    relationships: ast.relationships.map((r) => ({
      from: r.from,
      to: r.to,
      label: r.label,
    })),
  };
}

function toExportedEntity(e: MetamodelEntity): ExportedEntity {
  return {
    id: e.id,
    name: e.name,
    entity_id: e.entity_id,
    layer: e.layer_name ?? e.layerId,
    status: e.status,
    catalog_repo: e.catalog_repo,
    attributes: e.attributes.map((a) => ({ name: a.name, type: a.type })),
  };
}

/**
 * Re-emit a scoped subset as a PlantUML fragment:
 *   entity "Strategic Objective" as SO { + attr : type }
 *   SO --> BC : label
 */
export function buildPumlExport(ast: MetamodelAST, opts: ExportOptions): string {
  const lines: string[] = [];
  lines.push("' DEA Metamodel scoped export — dea-web-viewer");
  lines.push(`' metamodel ${opts.metamodelVersion} · ${ast.entities.length} entities · ${ast.relationships.length} relationships`);
  if (opts.membership) lines.push(`' membership filter: ${opts.membership}`);
  lines.push('');

  for (const e of ast.entities) {
    if (e.attributes.length === 0) {
      lines.push(`entity "${e.name}" as ${e.id}`);
    } else {
      lines.push(`entity "${e.name}" as ${e.id} {`);
      for (const a of e.attributes) {
        lines.push(`  + ${a.name} : ${a.type}`);
      }
      lines.push('}');
    }
  }
  lines.push('');
  for (const r of ast.relationships) {
    const arrow = r.type === 'dashed' ? '..>' : '-->';
    const label = r.label ? ` : "${r.label}"` : '';
    lines.push(`${r.from} ${arrow} ${r.to}${label}`);
  }
  return lines.join('\n') + '\n';
}

/** Turn a filename-safe label (used for download names). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

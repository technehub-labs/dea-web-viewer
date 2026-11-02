/* ------------------------------------------------------------------
 * coverage.ts
 *
 * Programme-health analytics over the synced entity graph. The viewer
 * is a consumer (CR-8 §47-48) — this lib only aggregates what the
 * graph already carries; it defines no new semantics.
 *
 * Answers four questions the catalog programme cares about:
 *   1. Catalog coverage — which entities have a catalog repo / live
 *      catalog summary, and which are still unplanned?
 *   2. Status distribution — existing / scaffold / proposed / planned.
 *   3. Layer coverage — which architecture layers are thin, and how
 *      many entities are still awaiting layer allocation (the CR-5/6/7
 *      upstream backlog)?
 *   4. ECF coordinates — how many entities carry ecf_coordinates (the
 *      domain×stage bridge to the metaframework)? Currently near-zero,
 *      which the dashboard surfaces instead of hiding.
 * ------------------------------------------------------------------ */

import type { MetamodelEntity, MetamodelLayer } from '../types';
import { getMembership, type MembershipGroup, buildMembershipGroups } from './membership';

export interface StatusCount {
  status: string;
  count: number;
}

export interface CoverageReport {
  total: number;
  cataloged: number;
  unplanned: number;
  statusCounts: StatusCount[];
  layerCounts: { layer: MetamodelLayer; count: number }[];
  /** Entities with no home layer (dimension entities or pending allocation). */
  unlayered: MetamodelEntity[];
  /** Entities with an ECF domain×stage coordinate (raw value from the graph). */
  withEcf: MetamodelEntity[];
  membershipGroups: MembershipGroup[];
  /** Entities with no catalog repo yet — the to-build backlog. */
  catalogBacklog: MetamodelEntity[];
  /** Catalog adopters with live summary data (CR-CATALOG-STRUCT-07b). */
  liveCatalogs: { entity: MetamodelEntity; count: number }[];
}

export function buildCoverageReport(
  entities: MetamodelEntity[],
  layers: MetamodelLayer[],
): CoverageReport {
  const statusCounts = new Map<string, number>();
  for (const e of entities) {
    const s = e.status ?? 'unknown';
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  }

  const layerCounts = layers.map((layer) => ({
    layer,
    count: entities.filter((e) => e.layerId === layer.id).length,
  }));

  const cataloged = entities.filter((e) => !!e.catalog_repo);
  const liveCatalogs = entities
    .filter((e) => e.catalog_summary && e.catalog_summary.entity_count > 0)
    .map((e) => ({ entity: e, count: e.catalog_summary!.entity_count }));

  return {
    total: entities.length,
    cataloged: cataloged.length,
    unplanned: entities.length - cataloged.length,
    statusCounts: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)),
    layerCounts,
    unlayered: entities.filter((e) => e.layerId === 'dim' && !e.layer_name),
    withEcf: entities.filter(
      (e) => (e as any).ecfCoordinatesRaw !== undefined,
    ),
    membershipGroups: buildMembershipGroups(entities),
    catalogBacklog: entities.filter((e) => !e.catalog_repo),
    liveCatalogs,
  };
}

/** Percentage helper (0-100), safe for zero totals. */
export function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

/** Compact status label for a group of entities. */
export function dominantStatus(entities: MetamodelEntity[]): string | null {
  if (entities.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of entities) {
    const s = e.status ?? 'unknown';
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Membership kind of an entity (thin re-export for dashboards). */
export { getMembership };

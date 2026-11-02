/* ------------------------------------------------------------------
 * search.ts
 *
 * Full-text entity search (dea-web-viewer issue #5).
 *
 * Scores matches across four fields, best first:
 *   1. display name       (exact prefix > substring > fuzzy subsequence)
 *   2. class alias        (exact / prefix)
 *   3. attribute names
 *   4. description        (substring)
 *
 * Pure functions — no React, no DOM — so they are unit-testable.
 * ------------------------------------------------------------------ */

import type { MetamodelEntity } from '../types';

export interface SearchHit {
  entity: MetamodelEntity;
  score: number;   // higher = better
  field: string;   // where the best match was found ('name' | 'alias' | 'attribute' | 'description')
}

/** Case-insensitive contains. */
function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

/** Starts-with, case-insensitive. */
function startsWith(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().startsWith(needle);
}

/**
 * Fuzzy subsequence match: every character of `needle` appears in
 * `haystack` in order. Returns the total character gap (lower = tighter
 * = better), or -1 if no match.
 */
function subsequenceGap(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let hi = 0;
  let gap = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return -1;
    gap += found - hi;
    hi = found + 1;
  }
  return gap;
}

/** Score one entity against a query across all fields; best hit wins. */
export function scoreEntity(entity: MetamodelEntity, query: string): SearchHit | null {
  const q = query.trim();
  if (!q) return null;

  const name = entity.name ?? '';
  const alias = entity.id ?? '';
  const candidates: SearchHit[] = [];

  // 1. Name — the strongest signal
  if (startsWith(name, q)) {
    candidates.push({ entity, score: 1000 - name.length, field: 'name' });
  } else if (contains(name, q)) {
    candidates.push({ entity, score: 800 - name.length, field: 'name' });
  } else {
    const nameGap = subsequenceGap(name, q);
    if (nameGap >= 0) {
      candidates.push({ entity, score: 600 - nameGap, field: 'name' });
    }
  }

  // 2. Class alias (e.g. typing "SO" should find Strategic Objective fast)
  if (alias.toLowerCase() === q.toLowerCase()) {
    candidates.push({ entity, score: 900, field: 'alias' });
  } else if (startsWith(alias, q)) {
    candidates.push({ entity, score: 700, field: 'alias' });
  }

  // 3. Attributes
  for (const attr of entity.attributes ?? []) {
    if (contains(attr.name, q)) {
      candidates.push({ entity, score: 500, field: 'attribute' });
      break;
    }
  }

  // 4. Description
  const desc = entity.description ?? '';
  if (contains(desc, q)) {
    candidates.push({ entity, score: 400, field: 'description' });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Rank entities against a query. Returns hits sorted best-first,
 * capped at `limit` (default 12).
 */
export function searchEntities(
  entities: MetamodelEntity[],
  query: string,
  limit = 12,
): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const entity of entities) {
    const hit = scoreEntity(entity, query);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name));
  return hits.slice(0, limit);
}

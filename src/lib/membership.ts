/* ------------------------------------------------------------------
 * membership.ts
 *
 * CR-4 consumer support: every entity carries
 *   membership: { kind: 'core' | 'profile', profile?: 'dea:business' }
 *
 * This lib extracts a stable membership label per entity and provides
 * the groups for the Core/Profile filter mode. Pure functions so this
 * is unit-testable without the app.
 * ------------------------------------------------------------------ */

import type { MetamodelEntity } from '../types';

export interface EntityMembership {
  kind: 'core' | 'profile' | 'unassigned';
  /** Full profile id (e.g. 'dea:business') when kind === 'profile'. */
  profile?: string;
  /** Short display label (e.g. 'business', 'data', 'ecosystem'). */
  label: string;
}

/** Extract a stable membership from an entity's raw graph fields. */
export function getMembership(entity: MetamodelEntity): EntityMembership {
  // MetamodelEntity carries the graph's membership object as
  // membershipRaw (wired in syncedMetamodel.ts during AST build).
  const raw = entity.membershipRaw;

  if (!raw || !raw.kind) {
    return { kind: 'unassigned', label: 'unassigned' };
  }
  if (raw.kind === 'core') {
    return { kind: 'core', label: 'core' };
  }
  if (raw.kind === 'profile') {
    const profile = raw.profile ?? 'unknown';
    return { kind: 'profile', profile, label: profile.replace(/^dea:/, '') };
  }
  return { kind: 'unassigned', label: 'unassigned' };
}

export interface MembershipGroup {
  /** Value for the filter state: 'core' | 'profile:<id>' | 'unassigned'. */
  key: string;
  label: string;
  count: number;
}

/** Build the ordered list of membership groups present in the graph. */
export function buildMembershipGroups(entities: MetamodelEntity[]): MembershipGroup[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const e of entities) {
    const m = getMembership(e);
    const key = m.kind === 'profile' ? `profile:${m.profile}` : m.kind;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { label: m.label, count: 1 });
  }

  const groups: MembershipGroup[] = [];
  // Core first, then profiles alphabetically, unassigned last.
  const sortedKeys = [...counts.keys()].sort((a, b) => {
    const rank = (k: string) => (k === 'core' ? 0 : k === 'unassigned' ? 2 : 1);
    const r = rank(a) - rank(b);
    return r !== 0 ? r : a.localeCompare(b);
  });
  for (const key of sortedKeys) {
    const { label, count } = counts.get(key)!;
    groups.push({ key, label, count });
  }
  return groups;
}

/** Filter value → predicate. `null` = all memberships (no filtering). */
export function membershipMatches(
  entity: MetamodelEntity,
  active: string | null,
): boolean {
  if (!active) return true;
  const m = getMembership(entity);
  if (active === 'core') return m.kind === 'core';
  if (active === 'unassigned') return m.kind === 'unassigned';
  if (active.startsWith('profile:')) return m.profile === active.slice('profile:'.length);
  return true;
}

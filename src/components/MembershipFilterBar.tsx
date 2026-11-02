import React from 'react';
import type { MetamodelEntity } from '../types';
import {
  buildMembershipGroups,
  membershipMatches,
  getMembership,
} from '../lib/membership';
import { groupForProfile } from '../lib/viz-profile';

interface MembershipFilterBarProps {
  entities: MetamodelEntity[];
  /** Active membership filter key ('core' | 'profile:<id>' | 'unassigned'), or null for all. */
  activeMembership: string | null;
  setActiveMembership: (key: string | null) => void;
}

/**
 * CR-4 consumer: Core/Profile membership filter chips.
 *
 * Every entity in the graph carries `membership: core | profile/<id>`
 * (CR-4, v0.9.0). This bar lets the user filter the canvas to a single
 * membership group — e.g. just the OpenDEA Core anchors, or one
 * profile viewpoint (business, data, ai, …). The 'unassigned' group
 * surfaces entities still awaiting upstream allocation (the CR-5/6/7
 * layers), which makes the coverage gap visible in the UI itself.
 */
export const MembershipFilterBar: React.FC<MembershipFilterBarProps> = ({
  entities,
  activeMembership,
  setActiveMembership,
}) => {
  const groups = buildMembershipGroups(entities);
  if (groups.length === 0) return null;

  return (
    <div
      className="membership-filter-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        padding: '6px 16px',
        borderBottom: '1px solid #21262d',
        fontSize: 12,
      }}
    >
      <span style={{ color: '#8b949e', marginRight: 4 }}>Membership:</span>

      <button
        className={`chip ${activeMembership === null ? 'chip-active' : ''}`}
        style={chipStyle(activeMembership === null)}
        onClick={() => setActiveMembership(null)}
      >
        All ({entities.length})
      </button>

      {groups.map((g) => {
        const active = activeMembership === g.key;
        const count = entities.filter((e) => membershipMatches(e, g.key)).length;
        // CR-8 §67: presentation hints come from the spec's visualization
        // profile (dea-metamodel/visualization/profile), not from here.
        const sample = entities.find((e) => membershipMatches(e, g.key));
        const profileId = sample ? getMembership(sample).profile : undefined;
        const vizGroup = profileId ? groupForProfile(profileId) : undefined;
        const color = g.key === 'core' ? '#1f6feb' : vizGroup?.color;
        const label = vizGroup?.label ?? g.label;
        return (
          <button
            key={g.key}
            className={`chip ${active ? 'chip-active' : ''}`}
            style={chipStyle(active, color)}
            title={g.key}
            onClick={() => setActiveMembership(active ? null : g.key)}
          >
            {label} ({count})
          </button>
        );
      })}
    </div>
  );
};

function chipStyle(active: boolean, color?: string): React.CSSProperties {
  const accent = color ?? '#2dd4bf';
  return {
    border: `1px solid ${active ? accent : '#30363d'}`,
    background: active ? `${accent}22` : 'transparent',
    color: active ? accent : '#c9d1d9',
    borderRadius: 999,
    padding: '2px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

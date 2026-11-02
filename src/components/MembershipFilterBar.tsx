import React from 'react';
import type { MetamodelEntity } from '../types';
import {
  buildMembershipGroups,
  membershipMatches,
} from '../lib/membership';

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
        return (
          <button
            key={g.key}
            className={`chip ${active ? 'chip-active' : ''}`}
            style={chipStyle(active)}
            title={g.key}
            onClick={() => setActiveMembership(active ? null : g.key)}
          >
            {g.label} ({count})
          </button>
        );
      })}
    </div>
  );
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? '#2dd4bf' : '#30363d'}`,
    background: active ? 'rgba(45,212,191,0.15)' : 'transparent',
    color: active ? '#2dd4bf' : '#c9d1d9',
    borderRadius: 999,
    padding: '2px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

import React from 'react';
import type { MetamodelAST } from '../types';
import { VIEWPOINTS, type Viewpoint } from '../lib/viewpoints';
import { membershipMatches } from '../lib/membership';

interface ViewpointGeneratorProps {
  ast: MetamodelAST;
  /** Called with the URL query string for the chosen viewpoint. */
  onApplyViewpoint: (queryParams: string) => void;
}

/**
 * Viewpoint generator (dea-web-viewer issue #3): persona presets that
 * configure the viewer (layers + membership + focus) for a stakeholder
 * concern, and produce a shareable deep link. Mirrors the metamodel's
 * own `Viewpoint` entity semantics: a curated subset for a specific
 * concern — not a new model.
 */
export const ViewpointGenerator: React.FC<ViewpointGeneratorProps> = ({
  ast,
  onApplyViewpoint,
}) => {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Viewpoints</h2>
      <p style={{ color: '#8b949e', fontSize: 13, marginTop: -8 }}>
        A viewpoint renders a curated subset of the metamodel for a specific
        stakeholder concern — per <code>dea:entity-viewpoint</code>. Pick a
        persona to apply its layer + membership scope; the URL becomes a
        shareable deep link.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {VIEWPOINTS.map((vp) => (
          <ViewpointCard
            key={vp.id}
            viewpoint={vp}
            ast={ast}
            onApply={onApplyViewpoint}
          />
        ))}
      </div>
    </div>
  );
};

const ViewpointCard: React.FC<{
  viewpoint: Viewpoint;
  ast: MetamodelAST;
  onApply: (queryParams: string) => void;
}> = ({ viewpoint, ast, onApply }) => {
  const entityCount = ast.entities.filter(
    (e) =>
      viewpoint.layers.includes(e.layerId) &&
      membershipMatches(e, viewpoint.membership ?? null),
  ).length;

  const params = new URLSearchParams();
  params.set('view', 'interactive');
  if (viewpoint.membership) params.set('membership', viewpoint.membership);
  if (viewpoint.layers.length < 6) params.set('layers', viewpoint.layers.join(','));
  if (viewpoint.focusEntity) params.set('entity', viewpoint.focusEntity);
  const qs = params.toString();

  return (
    <div
      style={{
        border: '1px solid #30363d',
        borderRadius: 10,
        padding: 14,
        background: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{viewpoint.label}</span>
        <span style={{ fontSize: 11, color: '#8b949e' }}>{viewpoint.audience}</span>
      </div>
      <p style={{ fontSize: 12, color: '#c9d1d9', margin: 0, flex: 1 }}>
        {viewpoint.description}
      </p>
      <div style={{ fontSize: 11, color: '#8b949e', fontFamily: 'var(--font-mono, monospace)' }}>
        {entityCount} entities · {viewpoint.membership ?? 'all memberships'}
      </div>
      <button
        onClick={() => onApply(qs)}
        style={{
          border: '1px solid #2dd4bf',
          background: 'rgba(45,212,191,0.12)',
          color: '#2dd4bf',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 12,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Apply viewpoint
      </button>
    </div>
  );
};

import React from 'react';
import type { MetamodelAST, MetamodelEntity, ImpactTrace } from '../types';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Compass,
  GitBranch,
  ExternalLink,
  Database,
} from 'lucide-react';

interface EntityDrawerProps {
  entity: MetamodelEntity | null;
  ast: MetamodelAST;
  onClose: () => void;
  onSelectEntity: (entityId: string) => void;
  impactTrace: ImpactTrace | null;
  onToggleImpactTrace: (entityId: string) => void;
}

const statusLabel: Record<string, string> = {
  existing: 'Existing',
  'existing-extended': 'Existing (extended)',
  planned: 'Planned',
  scaffold: 'Scaffold',
};

export const EntityDrawer: React.FC<EntityDrawerProps> = ({
  entity,
  ast,
  onClose,
  onSelectEntity,
  impactTrace,
  onToggleImpactTrace,
}) => {
  if (!entity) return null;

  const layer = ast.layers.find((l) => l.id === entity.layerId);
  const inboundRels = ast.relationships.filter((r) => r.to === entity.id);
  const outboundRels = ast.relationships.filter((r) => r.from === entity.id);
  const isTracingImpact = impactTrace?.sourceId === entity.id;

  return (
    <aside className="drawer" role="dialog" aria-label={`Entity ${entity.name}`}>
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div className="entity-id-badge">{entity.id}</div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 15, margin: 0, lineHeight: 1.25 }}>
              {entity.name}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {layer && (
                <span
                  className="layer-pill"
                  style={{
                    background: `${layer.color}33`,
                    color: layer.color,
                    borderColor: layer.color,
                  }}
                >
                  L{layer.number} · {layer.name}
                </span>
              )}
              {entity.status && (
                <span
                  className={`catalog-card-status ${entity.status}`}
                  style={{ padding: '2px 8px' }}
                >
                  {statusLabel[entity.status] ?? entity.status}
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="drawer-close" onClick={onClose} aria-label="Close drawer">
          <X size={16} />
        </button>
      </div>

      <div className="drawer-body">
        {/* Definition & scope */}
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>
            <Compass size={16} />
            <span>Definition & scope</span>
          </div>
          <p
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
              lineHeight: 1.55,
              color: 'var(--text)',
              fontSize: 13,
              margin: 0,
            }}
          >
            {entity.description ?? `${entity.name} (${entity.id}) is an architectural construct within ${layer?.name ?? 'the metamodel'}.`}
          </p>
        </div>

        {/* Catalog linkage */}
        {(entity.catalog_repo || entity.repo_url || entity.entity_id) && (
          <div>
            <div className="card-title" style={{ marginBottom: 8 }}>
              <GitBranch size={16} />
              <span>Catalog linkage</span>
            </div>
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 12,
              }}
            >
              {entity.entity_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--text-2)' }}>Entity ID</span>
                  <code style={{ color: 'var(--accent)' }}>{entity.entity_id}</code>
                </div>
              )}
              {entity.catalog_repo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--text-2)' }}>Catalog repo</span>
                  <code style={{ color: 'var(--accent)' }}>{entity.catalog_repo}</code>
                </div>
              )}
              {entity.repo_url && (
                <a
                  href={entity.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}
                >
                  Open in GitHub <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Impact trace */}
        <button
          onClick={() => onToggleImpactTrace(entity.id)}
          className={isTracingImpact ? 'btn btn-primary' : 'btn'}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Sparkles size={14} />
          <span>
            {isTracingImpact
              ? 'Clear impact trace'
              : 'Trace full impact chain'}
          </span>
        </button>
        {isTracingImpact && (
          <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: -8, textAlign: 'center' }}>
            Highlighting {impactTrace?.upstreamIds.size} upstream drivers and{' '}
            {impactTrace?.downstreamIds.size} downstream dependencies on the canvas.
          </p>
        )}

        {/* Attributes */}
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>
            <Database size={16} />
            <span>Attributes ({entity.attributes.length})</span>
          </div>
          {entity.attributes.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12, margin: 0 }}>
              No attributes declared in the canonical PlantUML source.
            </p>
          ) : (
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              {entity.attributes.map((attr, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--text)' }}>+ {attr.name}</span>
                  <span
                    style={{
                      color: 'var(--green)',
                      fontSize: 11,
                      background: 'rgba(63, 185, 80, 0.1)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(63, 185, 80, 0.3)',
                    }}
                  >
                    {attr.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upstream */}
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>
            <ArrowLeft size={16} />
            <span>Upstream drivers ({inboundRels.length})</span>
          </div>
          {inboundRels.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12, margin: 0 }}>
              Top of chain — no inbound drivers.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {inboundRels.map((rel, i) => {
                const source = ast.entities.find((e) => e.id === rel.from);
                return (
                  <button
                    key={i}
                    onClick={() => source && onSelectEntity(source.id)}
                    className="btn"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{source?.name ?? rel.from}</span>
                      <code style={{ color: 'var(--text-2)' }}>{rel.from}</code>
                    </span>
                    <span style={{ color: 'var(--text-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      "{rel.label || 'connects to'}"
                    </span>
                    <ArrowRight size={12} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Downstream */}
        <div>
          <div className="card-title" style={{ marginBottom: 8 }}>
            <ArrowRight size={16} />
            <span>Downstream consumers ({outboundRels.length})</span>
          </div>
          {outboundRels.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12, margin: 0 }}>
              Leaf node — no outbound dependencies.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outboundRels.map((rel, i) => {
                const target = ast.entities.find((e) => e.id === rel.to);
                return (
                  <button
                    key={i}
                    onClick={() => target && onSelectEntity(target.id)}
                    className="btn"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{target?.name ?? rel.to}</span>
                      <code style={{ color: 'var(--text-2)' }}>{rel.to}</code>
                    </span>
                    <span style={{ color: 'var(--text-2)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      "{rel.label || 'depends on'}"
                    </span>
                    <ArrowRight size={12} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

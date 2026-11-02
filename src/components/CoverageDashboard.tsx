import React, { useMemo } from 'react';
import type { MetamodelAST } from '../types';
import { buildCoverageReport, pct, type CoverageReport } from '../lib/coverage';

interface CoverageDashboardProps {
  ast: MetamodelAST;
  onSelectEntity: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  existing: '#2dd4bf',
  'existing-extended': '#22c55e',
  scaffold: '#f59e0b',
  proposed: '#8b949e',
  planned: '#f87171',
  unknown: '#666',
};

/**
 * Programme-health view over the synced graph: catalog coverage,
 * status distribution, layer coverage, and the allocation gaps
 * (unlayered entities, missing ECF coordinates) that the CR-5/6/7
 * upstream backlog currently produces.
 */
export const CoverageDashboard: React.FC<CoverageDashboardProps> = ({
  ast,
  onSelectEntity,
}) => {
  const report: CoverageReport = useMemo(
    () => buildCoverageReport(ast.entities, ast.layers),
    [ast],
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Coverage & programme health</h2>
      <p style={{ color: '#8b949e', fontSize: 13, marginTop: -8 }}>
        Aggregated from the synced entity graph — the viewer only reports what
        <code> dea-metamodel</code> publishes (CR-8 consumer rule).
      </p>

      {/* ---- headline cards ------------------------------------------ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Card
          title="Entities"
          value={report.total}
          sub="in the synced graph"
        />
        <Card
          title="Cataloged"
          value={report.cataloged}
          sub={`${pct(report.cataloged, report.total)}% have a catalog repo`}
          tone="#2dd4bf"
        />
        <Card
          title="Catalog backlog"
          value={report.unplanned}
          sub="entities without a catalog repo"
          tone="#f87171"
        />
        <Card
          title="Awaiting layer"
          value={report.unlayered.length}
          sub="dimension entities / pending CR-5/6/7 allocation"
          tone="#f59e0b"
        />
        <Card
          title="ECF coordinates"
          value={report.withEcf.length}
          sub="entities mapped to the 7×7 matrix"
          tone="#8b949e"
        />
      </div>

      {/* ---- status distribution ------------------------------------- */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
          Status distribution
        </h3>
        <div style={{ display: 'flex', gap: 2, height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid #30363d' }}>
          {report.statusCounts.map((s) => (
            <div
              key={s.status}
              title={`${s.status}: ${s.count}`}
              style={{
                flex: s.count,
                background: STATUS_COLORS[s.status] ?? '#666',
                opacity: 0.85,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6, fontSize: 12 }}>
          {report.statusCounts.map((s) => (
            <span key={s.status}>
              <span
                style={{
                  display: 'inline-block',
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: STATUS_COLORS[s.status] ?? '#666',
                  marginRight: 5,
                }}
              />
              {s.status} ({s.count})
            </span>
          ))}
        </div>
      </section>

      {/* ---- per-layer coverage ------------------------------------- */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
          Layer coverage
        </h3>
        {report.layerCounts.map(({ layer, count }) => (
          <div key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ width: 220, fontSize: 12, textAlign: 'right' }}>
              {layer.name} <span style={{ color: '#8b949e' }}>({layer.subtitle})</span>
            </span>
            <div style={{ flex: 1, height: 16, background: '#161b22', borderRadius: 4, border: '1px solid #21262d' }}>
              <div
                style={{
                  width: `${pct(count, report.total)}%`,
                  height: '100%',
                  background: layer.color,
                  opacity: 0.8,
                  borderRadius: 3,
                }}
              />
            </div>
            <span style={{ width: 60, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{count}</span>
          </div>
        ))}
      </section>

      {/* ---- live catalogs (CR-CATALOG-STRUCT-07b) ------------------ */}
      {report.liveCatalogs.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
            Live catalog content
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
            {report.liveCatalogs.map(({ entity, count }) => (
              <li key={entity.id} style={{ padding: '4px 0', borderBottom: '1px solid #21262d' }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectEntity(entity.id);
                  }}
                  style={{ color: '#2dd4bf', textDecoration: 'none' }}
                >
                  {entity.name}
                </a>
                <span style={{ color: '#8b949e' }}> — {count} entries</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- catalog backlog ---------------------------------------- */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
          Catalog backlog ({report.catalogBacklog.length})
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {report.catalogBacklog.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelectEntity(e.id)}
              title={e.description}
              style={{
                border: '1px solid #30363d',
                borderRadius: 999,
                background: 'transparent',
                color: '#c9d1d9',
                padding: '2px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {e.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

const Card: React.FC<{ title: string; value: number; sub: string; tone?: string }> = ({
  title,
  value,
  sub,
  tone,
}) => (
  <div
    style={{
      border: '1px solid #30363d',
      borderRadius: 10,
      padding: '12px 14px',
      background: '#0d1117',
    }}
  >
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8b949e' }}>
      {title}
    </div>
    <div style={{ fontSize: 26, fontFamily: 'var(--font-mono, monospace)', color: tone ?? '#c9d1d9' }}>
      {value}
    </div>
    <div style={{ fontSize: 11, color: '#8b949e' }}>{sub}</div>
  </div>
);

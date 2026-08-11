import React, { useState, useMemo, useEffect } from 'react';
import type { MetamodelAST } from '../types';
import { Route, ArrowRight, Sparkles, AlertCircle, Compass } from 'lucide-react';

interface TraceabilityPathFinderProps {
  ast: MetamodelAST;
  onSelectEntity: (entityId: string) => void;
}

export const TraceabilityPathFinder: React.FC<TraceabilityPathFinderProps> = ({ ast, onSelectEntity }) => {
  // Default to the first entity as source and the last as target so the
  // view is never empty when the synced graph changes.
  const [sourceId, setSourceId] = useState<string>(ast.entities[0]?.id ?? '');
  const [targetId, setTargetId] = useState<string>(ast.entities[ast.entities.length - 1]?.id ?? '');

  useEffect(() => {
    // If the synced graph swaps and the previous selection no longer
    // exists, fall back to safe defaults.
    if (!ast.entities.find((e) => e.id === sourceId)) {
      setSourceId(ast.entities[0]?.id ?? '');
    }
    if (!ast.entities.find((e) => e.id === targetId)) {
      setTargetId(ast.entities[ast.entities.length - 1]?.id ?? '');
    }
  }, [ast.entities, sourceId, targetId]);

  const paths = useMemo(() => {
    if (!sourceId || !targetId || sourceId === targetId) return [];

    const adj: Record<string, { to: string; label: string }[]> = {};
    ast.relationships.forEach((rel) => {
      if (!adj[rel.from]) adj[rel.from] = [];
      adj[rel.from].push({ to: rel.to, label: rel.label });
    });

    const resultPaths: { nodes: string[]; labels: string[] }[] = [];
    const maxDepth = 7;

    function dfs(curr: string, pathNodes: string[], pathLabels: string[], visited: Set<string>) {
      if (curr === targetId) {
        resultPaths.push({ nodes: [...pathNodes], labels: [...pathLabels] });
        return;
      }
      if (pathNodes.length >= maxDepth) return;
      const neighbors = adj[curr] || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          pathNodes.push(edge.to);
          pathLabels.push(edge.label);
          dfs(edge.to, pathNodes, pathLabels, visited);
          pathNodes.pop();
          pathLabels.pop();
          visited.delete(edge.to);
        }
      }
    }

    const visited = new Set<string>([sourceId]);
    dfs(sourceId, [sourceId], [], visited);

    return resultPaths;
  }, [sourceId, targetId, ast.relationships]);

  const sourceEntity = ast.entities.find((e) => e.id === sourceId);
  const targetEntity = ast.entities.find((e) => e.id === targetId);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <Route />
          <span>Architectural Traceability &amp; Lineage Path Finder</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          Trace directional dependency chains across layers. Driven by the
          relationships in the synced <code>metamodel.puml</code>.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Source entity (origin)
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="chip"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)' }}
            >
              {ast.entities.map((e) => {
                const l = ast.layers.find((ly) => ly.id === e.layerId);
                return (
                  <option key={e.id} value={e.id} style={{ background: 'var(--bg)' }}>
                    [{e.id}] {e.name} (L{l?.number})
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Target entity (destination)
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="chip"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)' }}
            >
              {ast.entities.map((e) => {
                const l = ast.layers.find((ly) => ly.id === e.layerId);
                return (
                  <option key={e.id} value={e.id} style={{ background: 'var(--bg)' }}>
                    [{e.id}] {e.name} (L{l?.number})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <Sparkles />
          <span>
            {paths.length === 0 ? 'No paths' : `Found ${paths.length} lineage path${paths.length === 1 ? '' : 's'}`}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--accent)' }}>{sourceEntity?.name}</span>
            <ArrowRight size={12} style={{ margin: '0 6px', verticalAlign: 'middle' }} />
            <span style={{ color: 'var(--pink)' }}>{targetEntity?.name}</span>
          </span>
        </div>

        {paths.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-2)',
            }}
          >
            <AlertCircle size={24} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
            <p style={{ fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              No direct or transitive paths found
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 480, margin: '8px auto 0' }}>
              No directional relationship flows from {sourceEntity?.name ?? '—'} to{' '}
              {targetEntity?.name ?? '—'}. Try selecting a different source or target.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paths.map((p, pathIdx) => (
              <div key={pathIdx} className="card" style={{ background: 'var(--bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                  <Compass size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Path #{pathIdx + 1} ({p.nodes.length - 1} hop{p.nodes.length - 1 === 1 ? '' : 's'})
                </div>
                <div className="path-chain">
                  {p.nodes.map((nodeId, nIdx) => {
                    const entity = ast.entities.find((e) => e.id === nodeId);
                    const layer = ast.layers.find((l) => l.id === entity?.layerId);
                    const label = p.labels[nIdx];
                    return (
                      <React.Fragment key={nIdx}>
                        <button
                          onClick={() => onSelectEntity(nodeId)}
                          className="path-node"
                          style={
                            layer
                              ? {
                                  background: `${layer.color}33`,
                                  borderColor: layer.color,
                                  color: layer.color,
                                }
                              : undefined
                          }
                        >
                          <span>{entity?.name ?? nodeId}</span>
                          <code style={{ fontSize: 10, opacity: 0.7 }}>{nodeId}</code>
                        </button>
                        {nIdx < p.nodes.length - 1 && (
                          <span className="path-arrow">
                            <span>"{label || 'leads to'}"</span>
                            <ArrowRight size={14} />
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

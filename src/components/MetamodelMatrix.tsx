import React, { useState } from 'react';
import type { MetamodelAST, LayerId } from '../types';
import { Grid3X3, ArrowRight, Filter } from 'lucide-react';

interface MetamodelMatrixProps {
  ast: MetamodelAST;
  onSelectEntity: (entityId: string) => void;
}

/**
 * Layer-to-layer relationship count matrix. The grid is built
 * dynamically from `ast.layers` so the layout follows whatever layer
 * schema the synced graph declares. It does not assume 5 or 6 layers.
 */
export const MetamodelMatrix: React.FC<MetamodelMatrixProps> = ({ ast, onSelectEntity }) => {
  const [selectedCell, setSelectedCell] = useState<{ from: LayerId; to: LayerId } | null>(null);

  const layerIds: LayerId[] = ast.layers.map((l) => l.id);

  // Pre-initialise the cell counter.
  const matrixData: Record<LayerId, Record<LayerId, number>> = {} as any;
  for (const fromId of layerIds) {
    matrixData[fromId] = {} as any;
    for (const toId of layerIds) {
      matrixData[fromId][toId] = 0;
    }
  }

  ast.relationships.forEach((rel) => {
    const fromEnt = ast.entities.find((e) => e.id === rel.from);
    const toEnt = ast.entities.find((e) => e.id === rel.to);
    if (fromEnt && toEnt) {
      const fc = matrixData[fromEnt.layerId];
      if (fc && fc[toEnt.layerId] !== undefined) fc[toEnt.layerId]++;
    }
  });

  const filteredRelationships = selectedCell
    ? ast.relationships.filter((rel) => {
        const fromEnt = ast.entities.find((e) => e.id === rel.from);
        const toEnt = ast.entities.find((e) => e.id === rel.to);
        return fromEnt?.layerId === selectedCell.from && toEnt?.layerId === selectedCell.to;
      })
    : ast.relationships;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <Grid3X3 />
          <span>Cross-Layer Traceability Matrix</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          Counts of architectural relationships connecting enterprise layers.
          Rows = source layer, columns = target layer. Click a cell to inspect
          the relationships it represents.
        </p>
        {selectedCell && (
          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() => setSelectedCell(null)}
          >
            <Filter size={12} />
            Clear cell filter
          </button>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Source / Target</th>
              {ast.layers.map((l) => (
                <th key={l.id} style={{ color: l.color }}>
                  L{l.number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ast.layers.map((fromLayer) => (
              <tr key={fromLayer.id}>
                <th style={{ textAlign: 'left', color: fromLayer.color, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  L{fromLayer.number}: {fromLayer.name}
                </th>
                {ast.layers.map((toLayer) => {
                  const count = matrixData[fromLayer.id][toLayer.id];
                  const isSelected =
                    selectedCell?.from === fromLayer.id && selectedCell?.to === toLayer.id;
                  const isEmpty = count === 0;
                  return (
                    <td
                      key={toLayer.id}
                      className={
                        isEmpty
                          ? 'matrix-cell-empty'
                          : isSelected
                          ? 'matrix-cell matrix-cell-selected'
                          : 'matrix-cell'
                      }
                      onClick={() => !isEmpty && setSelectedCell({ from: fromLayer.id, to: toLayer.id })}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">
          <ArrowRight />
          <span>
            {selectedCell
              ? `Relationships: L${ast.layers.find((l) => l.id === selectedCell.from)?.number} → L${ast.layers.find((l) => l.id === selectedCell.to)?.number}`
              : 'All relationships'}
            {' '}
            <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>({filteredRelationships.length})</span>
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 8,
          }}
        >
          {filteredRelationships.map((rel, idx) => {
            const fromEnt = ast.entities.find((e) => e.id === rel.from);
            const toEnt = ast.entities.find((e) => e.id === rel.to);
            const fLayer = ast.layers.find((l) => l.id === fromEnt?.layerId);
            const tLayer = ast.layers.find((l) => l.id === toEnt?.layerId);
            return (
              <button
                key={idx}
                onClick={() => fromEnt && onSelectEntity(fromEnt.id)}
                className="btn"
                style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ color: fLayer?.color }}>{fromEnt?.name ?? rel.from}</span>
                  <code style={{ color: 'var(--text-2)' }}>{rel.from}</code>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                  "{rel.label || 'links'}"
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <code style={{ color: 'var(--text-2)' }}>{rel.to}</code>
                  <span style={{ color: tLayer?.color }}>{toEnt?.name ?? rel.to}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

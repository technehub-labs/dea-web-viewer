import React from 'react';
import type { MetamodelLayer, LayerId } from '../types';
import { Filter, Layers } from 'lucide-react';

interface LayerFilterBarProps {
  layers: MetamodelLayer[];
  activeLayers: Set<LayerId>;
  toggleLayer: (layerId: LayerId) => void;
  selectAllLayers: () => void;
  entityCountsByLayer: Record<LayerId, number>;
}

export const LayerFilterBar: React.FC<LayerFilterBarProps> = ({
  layers,
  activeLayers,
  toggleLayer,
  selectAllLayers,
  entityCountsByLayer,
}) => {
  const allSelected = layers.every((l) => activeLayers.has(l.id));

  return (
    <div className="filter-bar" role="toolbar" aria-label="Layer filter">
      <span className="filter-bar-label">
        <Filter size={12} /> Filter layers
      </span>

      <button
        className={`chip ${allSelected ? 'active' : ''}`}
        onClick={selectAllLayers}
        aria-pressed={allSelected}
      >
        <span className="chip-dot" />
        All ({layers.length})
      </button>

      {layers.map((layer) => {
        const isActive = activeLayers.has(layer.id);
        const count = entityCountsByLayer[layer.id] ?? 0;
        return (
          <button
            key={layer.id}
            className={`chip ${isActive ? 'active' : ''}`}
            onClick={() => toggleLayer(layer.id)}
            aria-pressed={isActive}
            style={
              isActive
                ? {
                    background: `${layer.color}33`,
                    borderColor: layer.color,
                    color: layer.color,
                  }
                : undefined
            }
          >
            <span
              className="chip-dot"
              style={{ background: layer.color }}
            />
            <span>L{layer.number} · {layer.name}</span>
            <span className="chip-count">{count}</span>
          </button>
        );
      })}

      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
        <Layers size={12} /> Click a chip to toggle
      </span>
    </div>
  );
};

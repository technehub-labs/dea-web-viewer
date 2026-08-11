import React, { useMemo, useState } from 'react';
import type { EntityGraph, EntityGraphEntity } from '../data/syncedMetamodel';
import { ExternalLink, Search, BookOpen, Filter } from 'lucide-react';

interface CatalogBrowserProps {
  graph: EntityGraph;
  onSelectEntity: (alias: string) => void;
}

const statusOrder: Record<string, number> = {
  existing: 0,
  'existing-extended': 1,
  scaffold: 2,
  planned: 3,
};

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({ graph, onSelectEntity }) => {
  const [layerFilter, setLayerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const layers = useMemo(() => {
    const set = new Set<string>();
    for (const e of graph.entities) set.add(e.layer);
    return Array.from(set).sort();
  }, [graph]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return [...graph.entities]
      .filter((e) => {
        if (layerFilter !== 'all' && e.layer !== layerFilter) return false;
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (t === '') return true;
        return (
          e.display_name.toLowerCase().includes(t) ||
          e.class_alias.toLowerCase().includes(t) ||
          (e.description ?? '').toLowerCase().includes(t) ||
          e.catalog_repo.toLowerCase().includes(t)
        );
      })
      .sort((a, b) => {
        const sa = statusOrder[a.status ?? 'planned'] ?? 99;
        const sb = statusOrder[b.status ?? 'planned'] ?? 99;
        if (sa !== sb) return sa - sb;
        return a.display_name.localeCompare(b.display_name);
      });
  }, [graph, layerFilter, statusFilter, search]);

  return (
    <div>
      <div className="filter-bar" role="toolbar">
        <span className="filter-bar-label">
          <BookOpen size={12} /> Catalogs
        </span>

        <div className="nav-search" style={{ width: 280 }}>
          <Search />
          <input
            type="text"
            placeholder="Search catalogs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="chip"
          value={layerFilter}
          onChange={(e) => setLayerFilter(e.target.value)}
          style={{ padding: '6px 12px' }}
        >
          <option value="all">All layers</option>
          {layers.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          className="chip"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 12px' }}
        >
          <option value="all">All statuses</option>
          <option value="existing">Existing</option>
          <option value="existing-extended">Existing (extended)</option>
          <option value="scaffold">Scaffold</option>
          <option value="planned">Planned</option>
        </select>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-2)' }}>
          <Filter size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {filtered.length} of {graph.entities.length}
        </span>
      </div>

      <div className="catalog-grid">
        {filtered.map((e) => (
          <CatalogCard key={e.entity_id} entry={e} onOpen={() => onSelectEntity(e.class_alias)} />
        ))}
      </div>
    </div>
  );
};

const CatalogCard: React.FC<{ entry: EntityGraphEntity; onOpen: () => void }> = ({ entry, onOpen }) => {
  return (
    <div className="catalog-card" onClick={onOpen} role="button" tabIndex={0}>
      <div className="catalog-card-head">
        <span className="catalog-card-title">{entry.class_alias}</span>
        {entry.status && (
          <span className={`catalog-card-status ${entry.status}`}>
            {entry.status.replace('-', ' ')}
          </span>
        )}
      </div>

      <h3 className="catalog-card-name">{entry.display_name}</h3>

      {entry.description && <p className="catalog-card-desc">{entry.description}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span style={{ color: 'var(--text-2)' }}>
          <strong style={{ color: 'var(--text)' }}>{entry.layer}</strong> · {entry.layer_name}
        </span>
        <a
          href={entry.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          repo <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
};

import React from 'react';
import type { ViewMode } from '../types';
import { Network, FileCode, Grid3X3, Route, Search, RotateCcw, Layers, BookOpen } from 'lucide-react';

interface HeaderProps {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onReset: () => void;
  entityCount: number;
  relCount: number;
  metamodelVersion: string;
}

const tabs: { id: ViewMode; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'canonical-svg', label: 'Canonical SVG', Icon: FileCode },
  { id: 'interactive',    label: 'Interactive',  Icon: Network },
  { id: 'matrix',         label: 'Matrix',       Icon: Grid3X3 },
  { id: 'traceability',   label: 'Traceability', Icon: Route },
  { id: 'catalogs',       label: 'Catalogs',     Icon: BookOpen },
];

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  searchTerm,
  setSearchTerm,
  onReset,
  entityCount,
  relCount,
  metamodelVersion,
}) => {
  return (
    <nav className="navbar">
      <div className="nav-inner">
        <div className="nav-brand">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#0d1117" />
            <path
              d="M8 8h4l8 10.5L28 8h4v4l-9 6.5v5L8 24v-4l9-6.5z"
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span>DEA Web Viewer</span>
          <span className="meta-tag">{metamodelVersion}</span>
        </div>

        <div className="nav-tabs" role="tablist">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeView === id}
              onClick={() => setActiveView(id)}
              className={`nav-tab ${activeView === id ? 'active' : ''}`}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="nav-search">
          <Search />
          <input
            type="text"
            placeholder="Search entity, attribute, or relationship…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="btn btn-ghost" onClick={onReset} title="Reset selection">
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>

      <div className="banner">
        <span>
          <span className="banner-strong">{entityCount} entities</span> ·{' '}
          {relCount} relationships · synced automatically from the
          canonical <code>dea-metamodel</code> repository
        </span>
        <span>
          <Layers size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Press <kbd>Esc</kbd> to close the entity drawer
        </span>
      </div>
    </nav>
  );
};

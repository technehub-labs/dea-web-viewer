import React from 'react';
import type { ViewMode } from '../types';
import { RotateCcw, Layers, Download } from 'lucide-react';
import { buildJsonExport, buildPumlExport, slugify } from '../lib/export';
import type { MetamodelAST } from '../types';

interface HeaderProps {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  /** Rendered by App.tsx: SearchPalette with fuzzy results dropdown. */
  searchPalette: React.ReactNode;
  onReset: () => void;
  entityCount: number;
  relCount: number;
  metamodelVersion: string;
  /** Tab list, supplied by App.tsx so it can hide experimental tabs when flags are off. */
  tabs: { id: ViewMode; label: string; Icon: React.ComponentType<any> }[];
  /** Scoped AST for exports (after layer + membership filters). */
  scopedAst: MetamodelAST | null;
  /** Membership filter applied (for export provenance). */
  activeMembership: string | null;
}


export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  searchPalette,
  onReset,
  entityCount,
  relCount,
  metamodelVersion,
  tabs,
  scopedAst,
  activeMembership,
}) => {
  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    if (!scopedAst) return;
    const data = buildJsonExport(scopedAst, {
      metamodelVersion,
      url: window.location.href,
      membership: activeMembership,
    });
    download(
      JSON.stringify(data, null, 2),
      `dea-scope-${slugify(activeMembership ?? 'all')}.json`,
      'application/json',
    );
  };

  const exportPuml = () => {
    if (!scopedAst) return;
    const puml = buildPumlExport(scopedAst, { metamodelVersion, membership: activeMembership });
    download(
      puml,
      `dea-scope-${slugify(activeMembership ?? 'all')}.puml`,
      'text/plain',
    );
  };
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

        {searchPalette}

        <button className="btn btn-ghost" onClick={exportPuml} title="Export current scope as PlantUML fragment">
          <Download size={14} />
          <span>PUML</span>
        </button>
        <button className="btn btn-ghost" onClick={exportJson} title="Export current scope as JSON">
          <Download size={14} />
          <span>JSON</span>
        </button>
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MetamodelEntity, ViewMode } from '../types';
import { searchEntities, type SearchHit } from '../lib/search';

interface SearchPaletteProps {
  entities: MetamodelEntity[];
  /** Current committed search term (controlled by App). */
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSelectEntity: (id: string) => void;
  /** Jump to this view when a hit is picked (defaults to 'interactive'). */
  selectInView?: ViewMode;
}

/**
 * Header search input + results dropdown (dea-web-viewer issue #5).
 *
 * - Full-text fuzzy search across name / alias / attributes / description
 *   (see src/lib/search.ts for the scoring rules).
 * - Keyboard navigation: ↑/↓ to move, Enter to open, Esc to close.
 * - Global shortcuts: '/' focuses the input, ⌘K / Ctrl+K focuses + selects.
 * - Selecting a hit opens the entity drawer in the parent App state; the
 *   entity id and view are synced to the URL by App.tsx (url-state.ts).
 */
export const SearchPalette: React.FC<SearchPaletteProps> = ({
  entities,
  searchTerm,
  setSearchTerm,
  onSelectEntity,
  selectInView = 'interactive',
}) => {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hits: SearchHit[] = useMemo(
    () => (searchTerm.trim() ? searchEntities(entities, searchTerm) : []),
    [entities, searchTerm],
  );

  /* -- global shortcuts: '/' and Cmd/Ctrl+K focus the search ------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* -- close on outside click ------------------------------------ */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (hit: SearchHit) => {
    onSelectEntity(hit.entity.id);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hits.length > 0) {
        setOpen(true);
        setCursor((c) => Math.min(c + 1, hits.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && hits[cursor]) {
        e.preventDefault();
        pick(hits[cursor]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="nav-search" ref={wrapRef} style={{ position: 'relative' }}>
      <SearchIcon />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label="Search entities"
        placeholder="Search entities… (press / to focus)"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && hits.length > 0 && (
        <ul
          className="search-results"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 100,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 10,
            maxHeight: 360,
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          }}
        >
          {hits.map((hit, i) => (
            <li
              key={hit.entity.id}
              role="option"
              aria-selected={i === cursor}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === cursor ? 'rgba(45,212,191,0.12)' : 'transparent',
                borderBottom: '1px solid #21262d',
              }}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep input focus
                pick(hit);
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 11,
                  color: '#2dd4bf',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '1px 6px',
                  minWidth: 30,
                  textAlign: 'center',
                }}
              >
                {hit.entity.id}
              </span>
              <span style={{ flex: 1, fontSize: 13 }}>{hit.entity.name}</span>
              <span
                style={{
                  fontSize: 10,
                  color: '#8b949e',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {hit.field}
              </span>
            </li>
          ))}
          <li
            style={{ padding: '6px 12px', fontSize: 10, color: '#8b949e' }}
          >
            {hits.length} match{hits.length === 1 ? '' : 'es'} · ↑↓ to navigate · Enter opens
          </li>
        </ul>
      )}
    </div>
  );
};

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

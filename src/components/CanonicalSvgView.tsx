import React, { useEffect, useMemo, useRef } from 'react';
import type { MetamodelAST } from '../types';
import { getSyncedSvg, getEntityGraph } from '../data/syncedMetamodel';
import { ZoomIn, ZoomOut, RotateCcw, Download, ExternalLink, Info } from 'lucide-react';

interface CanonicalSvgViewProps {
  ast: MetamodelAST;
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  searchTerm: string;
}

/**
 * Embeds the canonical metamodel.svg that the dea-metamodel bot
 * publishes. PlantUML 1.2024.x emits `<g id="elem_<ALIAS>">` markers
 * for each entity class — we hook into those to wire click and hover
 * handlers that drive the parent app's selection state.
 *
 * If the synced SVG ever stops emitting those markers, the bot's
 * `inject_svg_attributes.py` step adds them back. Either way, the
 * viewer does not have to know — it just listens for them.
 */
export const CanonicalSvgView: React.FC<CanonicalSvgViewProps> = ({
  ast,
  selectedEntityId,
  onSelectEntity,
  searchTerm,
}) => {
  const svgHostRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const svg = getSyncedSvg();
  const graph = getEntityGraph();

  // Build an alias -> entity lookup so the click handlers can resolve
  // PlantUML's "elem_<ALIAS>" markers to a real entity record.
  const aliasToEntity = useMemo(() => {
    const map: Record<string, (typeof ast.entities)[number]> = {};
    for (const e of ast.entities) map[e.id] = e;
    return map;
  }, [ast]);

  // Bind interactivity once the SVG mounts.
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;

    const applySelection = (alias: string | null) => {
      onSelectEntity(alias);
    };

    const applyHighlight = (alias: string | null) => {
      host.querySelectorAll<SVGGElement>('g.entity').forEach((g) => {
        g.classList.toggle('selected', alias !== null && g.getAttribute('data-alias') === alias);
      });
    };

    const applySearch = (term: string) => {
      const t = term.trim().toLowerCase();
      host.querySelectorAll<SVGGElement>('g.entity').forEach((g) => {
        const alias = (g.getAttribute('data-alias') ?? '').toLowerCase();
        const name = (g.getAttribute('data-name') ?? '').toLowerCase();
        const match = t === '' || alias.includes(t) || name.includes(t);
        g.style.opacity = match ? '1' : '0.25';
      });
    };

    // Make every entity group interactive.
    const groups = host.querySelectorAll<SVGGElement>('g[id^="elem_"]');
    groups.forEach((g) => {
      g.classList.add('entity');
      const alias = g.id.replace(/^elem_/, '');
      g.setAttribute('data-alias', alias);
      const ent = aliasToEntity[alias];
      if (ent) g.setAttribute('data-name', ent.name);
      g.addEventListener('click', () => applySelection(alias));
    });

    applyHighlight(selectedEntityId);
    applySearch(searchTerm);

    return () => {
      groups.forEach((g) => {
        g.classList.remove('entity', 'selected');
        g.replaceWith(g.cloneNode(true));
      });
    };
  }, [svg, aliasToEntity, onSelectEntity, selectedEntityId, searchTerm]);

  // Pan support: drag the SVG to move it.
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    const onDown = (e: MouseEvent) => {
      dragState.current = { startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y };
    };
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      setPan({
        x: dragState.current.baseX + (e.clientX - dragState.current.startX),
        y: dragState.current.baseY + (e.clientY - dragState.current.startY),
      });
    };
    const onUp = () => {
      dragState.current = null;
    };
    host.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      host.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pan]);

  const handleDownload = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dea-metamodel-${ast.version}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="canvas-host" style={{ background: '#0d1117' }}>
      <div className="canvas-controls">
        <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.min(z * 1.2, 4))} title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.max(z / 1.2, 0.3))} title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          title="Reset view"
        >
          <RotateCcw size={14} />
        </button>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', padding: '0 6px' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="btn btn-ghost" onClick={handleDownload} title="Download SVG">
          <Download size={14} />
        </button>
        <a
          className="btn btn-ghost"
          href="https://github.com/technehub-labs/dea-metamodel/blob/main/viewer/metamodel.svg"
          target="_blank"
          rel="noopener noreferrer"
          title="View source on GitHub"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="canvas-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Info size={12} />
          <span className="banner-strong">Canonical SVG</span>
        </div>
        <div>
          {ast.entities.length} entities · {ast.relationships.length} relationships ·{' '}
          {graph.entities.length} catalog entries
        </div>
        <div style={{ marginTop: 4, color: 'var(--text-3)' }}>
          Drag to pan · click any entity to inspect
        </div>
      </div>

      <div
        className="svg-view-host"
        ref={svgHostRef}
        style={{
          background: '#ffffff',
          cursor: dragState.current ? 'grabbing' : 'grab',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
};

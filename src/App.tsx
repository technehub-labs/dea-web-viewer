import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  ViewMode,
  LayerId,
  ImpactTrace,
  MetamodelAST,
} from './types';
import {
  loadSyncedArtefacts,
  buildMetamodelAst,
  getMetaVersion,
  getEntityGraph,
} from './data/syncedMetamodel';
import { Header } from './components/Header';
import { LayerFilterBar } from './components/LayerFilterBar';
import { InteractiveCanvas } from './components/InteractiveCanvas';
import { EntityDrawer } from './components/EntityDrawer';
import { CanonicalSvgView } from './components/CanonicalSvgView';
import { MetamodelMatrix } from './components/MetamodelMatrix';
import { TraceabilityPathFinder } from './components/TraceabilityPathFinder';
import { CatalogBrowser } from './components/CatalogBrowser';
import { MaturityRadar } from './components/MaturityRadar';
import { SearchPalette } from './components/SearchPalette';
import { MembershipFilterBar } from './components/MembershipFilterBar';
import { flag } from './lib/feature-flags';
import { parseUrlState, serializeUrlState, isDefaultState } from './lib/url-state';
import { membershipMatches } from './lib/membership';
import type { UrlState } from './lib/url-state';
import { Network, FileCode, Grid3X3, Route, BookOpen, Radar } from 'lucide-react';

export default function App() {
  // CR-MM-02-VIEWER: MaturityRadar is gated behind the `dea.experimental.maturityV2`
  // feature flag. Default = OFF. To preview locally, open browser devtools
  // console: setExperimentalFlag('maturityV2', true). The flag also gates the
  // "maturity-radar" nav option so the tab is hidden by default.
  const maturityV2Enabled = flag('maturityV2')
  const tabs = maturityV2Enabled
    ? [
        { id: 'canonical-svg'   as const, label: 'Canonical SVG',   Icon: FileCode },
        { id: 'interactive'     as const, label: 'Interactive',     Icon: Network },
        { id: 'matrix'          as const, label: 'Matrix',          Icon: Grid3X3 },
        { id: 'traceability'    as const, label: 'Traceability',    Icon: Route },
        { id: 'catalogs'        as const, label: 'Catalogs',        Icon: BookOpen },
        { id: 'maturity-radar'  as const, label: 'Maturity radar',  Icon: Radar },
      ]
    : [
        { id: 'canonical-svg'   as const, label: 'Canonical SVG',   Icon: FileCode },
        { id: 'interactive'     as const, label: 'Interactive',     Icon: Network },
        { id: 'matrix'          as const, label: 'Matrix',          Icon: Grid3X3 },
        { id: 'traceability'    as const, label: 'Traceability',    Icon: Route },
        { id: 'catalogs'        as const, label: 'Catalogs',        Icon: BookOpen },
      ]
  const availableViews = tabs.map(t => t.id)
const [ast, setAst] = useState<MetamodelAST | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metamodelVersion, setMetamodelVersion] = useState<string>('…');

  const [activeView, setActiveView] = useState<ViewMode>('canonical-svg');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeLayers, setActiveLayers] = useState<Set<LayerId> | null>(null);
  const [activeMembership, setActiveMembership] = useState<string | null>(null);
  const [impactTrace, setImpactTrace] = useState<ImpactTrace | null>(null);

  /* ---------------------------------------------------------------
   * Deep-linking (shareable URLs): the URL query string is hydrated
   * into app state on mount, and committed state mutations are
   * written back via history.replaceState (no back-button pollution:
   * per-keystroke search input is NOT synced, only committed state —
   * view, selected entity, layer + membership filters).
   *   ?view=interactive&entity=SO&layers=layer1,layer3&membership=core
   * --------------------------------------------------------------- */
  const initialUrlState = useMemo(() => parseUrlState(window.location.search), []);
  useEffect(() => {
    if (initialUrlState.view) setActiveView(initialUrlState.view);
    if (initialUrlState.q) setSearchTerm(initialUrlState.q);
    // entity/layers/membership are applied after the AST loads (see below).
  }, [initialUrlState]);

  const urlEntityRef = useRef(initialUrlState.entity);
  const urlLayersRef = useRef(initialUrlState.layers);
  const urlMembershipRef = useRef(initialUrlState.membership);

  // Committed-state → URL. Runs on every relevant state change.
  useEffect(() => {
    const state: UrlState = { view: activeView };
    if (selectedEntityId) state.entity = selectedEntityId;
    if (activeLayers && ast) {
      const allIds = ast.layers.map((l) => l.id);
      const enabled = allIds.filter((id) => activeLayers.has(id));
      if (enabled.length > 0 && enabled.length < allIds.length) {
        state.layers = enabled;
      }
    }
    if (activeMembership) state.membership = activeMembership;
    const qs = serializeUrlState(state);
    const nextUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [activeView, selectedEntityId, activeLayers, activeMembership, ast]);

  // Close the drawer with Esc (delegated; canvas also listens).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEntityId(null);
        setImpactTrace(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------------------------------------------------------
   * Load the synced artefacts once at startup. The artefacts live in
   * public/data/* (owned by the CI sync workflow) and are baked into
   * the JS bundle at build time — there is no runtime fetching.
   * --------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSyncedArtefacts();
        const next = await buildMetamodelAst();
        if (cancelled) return;
        setAst(next);
        setMetamodelVersion(getMetaVersion());
        // Deep-link hydration: layer set from the URL if present.
        const allLayerIds = new Set(next.layers.map((l) => l.id));
        if (urlLayersRef.current && urlLayersRef.current.length > 0) {
          setActiveLayers(new Set(urlLayersRef.current));
        } else {
          setActiveLayers(allLayerIds);
        }
        // Deep-link hydration: selected entity + membership filter.
        if (urlEntityRef.current) {
          setSelectedEntityId(urlEntityRef.current);
        }
        if (urlMembershipRef.current) {
          setActiveMembership(urlMembershipRef.current);
        }
      } catch (e: any) {
        if (cancelled) return;
        setLoadError(
          e?.message ??
            'Failed to initialise the metamodel viewer. Artefacts are baked in at build time — a failure here means the deployed bundle is stale or corrupt; re-run the Deploy to GitHub Pages workflow.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------------------------------------------
   * Layer toggle handlers
   * --------------------------------------------------------------- */
  const toggleLayer = useCallback((layerId: LayerId) => {
    setActiveLayers((prev) => {
      if (!prev) return new Set([layerId]);
      const next = new Set(prev);
      if (next.has(layerId)) {
        if (next.size > 1) next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  const selectAllLayers = useCallback(() => {
    if (!ast) return;
    setActiveLayers(new Set(ast.layers.map((l) => l.id)));
  }, [ast]);

  const handleReset = useCallback(() => {
    setSelectedEntityId(null);
    setSearchTerm('');
    setImpactTrace(null);
    setActiveMembership(null);
    selectAllLayers();
  }, [selectAllLayers]);

  /* ---------------------------------------------------------------
   * Compute entity counts per layer (drives the filter bar)
   * --------------------------------------------------------------- */
  const entityCountsByLayer = useMemo(() => {
    const counts: Record<LayerId, number> = {
      layer1: 0,
      layer2: 0,
      layer3: 0,
      layer4: 0,
      layer5: 0,
      dim: 0,
    };
    if (!ast) return counts;
    ast.entities.forEach((ent) => {
      if (counts[ent.layerId] !== undefined) counts[ent.layerId]++;
    });
    return counts;
  }, [ast]);

  /* ---------------------------------------------------------------
   * Impact trace (BFS upstream + downstream)
   * --------------------------------------------------------------- */
  const handleToggleImpactTrace = useCallback(
    (entityId: string) => {
      if (!ast) return;
      if (impactTrace?.sourceId === entityId) {
        setImpactTrace(null);
        return;
      }

      const upstreamIds = new Set<string>();
      const downstreamIds = new Set<string>();
      const connectedEdgeKeys = new Set<string>();

      const queueDown = [entityId];
      const visitedDown = new Set<string>([entityId]);
      while (queueDown.length > 0) {
        const curr = queueDown.shift()!;
        ast.relationships.forEach((rel) => {
          if (rel.from === curr && !visitedDown.has(rel.to)) {
            visitedDown.add(rel.to);
            downstreamIds.add(rel.to);
            connectedEdgeKeys.add(`${rel.from}->${rel.to}`);
            queueDown.push(rel.to);
          }
        });
      }

      const queueUp = [entityId];
      const visitedUp = new Set<string>([entityId]);
      while (queueUp.length > 0) {
        const curr = queueUp.shift()!;
        ast.relationships.forEach((rel) => {
          if (rel.to === curr && !visitedUp.has(rel.from)) {
            visitedUp.add(rel.from);
            upstreamIds.add(rel.from);
            connectedEdgeKeys.add(`${rel.from}->${rel.to}`);
            queueUp.push(rel.from);
          }
        });
      }

      setImpactTrace({
        sourceId: entityId,
        upstreamIds,
        downstreamIds,
        connectedEdgeKeys,
      });
    },
    [ast, impactTrace]
  );

  /* ---------------------------------------------------------------
   * CR-4: scoped AST — entities/relationships after the membership
   * filter. Interactive/Matrix/Traceability views receive this scoped
   * graph; relationships whose endpoints fall outside the membership
   * filter are dropped too.
   * --------------------------------------------------------------- */
  const scopedAst = useMemo(() => {
    if (!ast) return null;
    if (!activeMembership) return ast;
    const entities = ast.entities.filter((e) =>
      membershipMatches(e, activeMembership),
    );
    const visible = new Set(entities.map((e) => e.id));
    const relationships = ast.relationships.filter(
      (r) => visible.has(r.from) && visible.has(r.to),
    );
    return { ...ast, entities, relationships };
  }, [ast, activeMembership]);

  /* ---------------------------------------------------------------
   * Render
   * --------------------------------------------------------------- */
  if (loadError) {
    return (
      <div className="app-shell">
        <div className="loading-shell">
          <div className="error-shell">
            {`Failed to load synced metamodel.\n\n${loadError}\n\n` +
              `Run the sync workflow:\n` +
              `  gh workflow run sync-from-dea-metamodel.yml --repo technehub-labs/dea-web-viewer`}
          </div>
        </div>
      </div>
    );
  }

  if (!ast || !activeLayers || !scopedAst) {
    return (
      <div className="app-shell">
        <div className="loading-shell">
          <div className="spinner" />
          <div>Loading canonical metamodel…</div>
          <div className="banner-strong" style={{ fontFamily: 'var(--font-mono)' }}>
            {metamodelVersion}
          </div>
        </div>
      </div>
    );
  }

  const selectedEntity = selectedEntityId
    ? ast.entities.find((e) => e.id === selectedEntityId) ?? null
    : null;

  return (
    <div className="app-shell">
      <Header
        tabs={tabs}
        activeView={activeView}
        setActiveView={(v) => {
          if (!availableViews.includes(v)) return
          setActiveView(v)
        }}
        searchTerm={searchTerm}
        onReset={handleReset}
        entityCount={scopedAst.entities.length}
        relCount={scopedAst.relationships.length}
        metamodelVersion={metamodelVersion}
        searchPalette={
          <SearchPalette
            entities={ast.entities}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSelectEntity={(id) => {
              setSelectedEntityId(id);
              // Open the drawer on a view that shows it; from catalogs
              // (alias ids differ) jump to canonical-svg.
              setActiveView(activeView === 'catalogs' ? 'canonical-svg' : 'interactive');
            }}
          />
        }
      />

      {(activeView === 'interactive' || activeView === 'matrix') && (
        <MembershipFilterBar
          entities={ast.entities}
          activeMembership={activeMembership}
          setActiveMembership={setActiveMembership}
        />
      )}

      {(activeView === 'interactive' || activeView === 'matrix') && (
        <LayerFilterBar
          layers={ast.layers}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
          selectAllLayers={selectAllLayers}
          entityCountsByLayer={entityCountsByLayer}
        />
      )}

      <main className="app-main">
        {activeView === 'canonical-svg' && (
          <CanonicalSvgView
            ast={ast}
            selectedEntityId={selectedEntityId}
            onSelectEntity={(id) => setSelectedEntityId(id)}
            searchTerm={searchTerm}
          />
        )}

        {activeView === 'interactive' && (
          <InteractiveCanvas
            ast={scopedAst}
            selectedEntityId={selectedEntityId}
            onSelectEntity={(id) => setSelectedEntityId(id)}
            activeLayers={activeLayers}
            searchTerm={searchTerm}
            impactTrace={impactTrace}
          />
        )}

        {activeView === 'matrix' && (
          <MetamodelMatrix
            ast={scopedAst}
            onSelectEntity={(id) => {
              setSelectedEntityId(id);
              setActiveView('interactive');
            }}
          />
        )}

        {activeView === 'traceability' && (
          <TraceabilityPathFinder
            ast={scopedAst}
            onSelectEntity={(id) => {
              setSelectedEntityId(id);
              setActiveView('interactive');
            }}
          />
        )}

        {activeView === 'catalogs' && (
          <CatalogBrowser
            graph={getEntityGraph()}
            onSelectEntity={(alias) => {
              setSelectedEntityId(alias);
              setActiveView('canonical-svg');
            }}
          />
        )}

        {activeView === 'maturity-radar' && maturityV2Enabled && (
          <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
            <MaturityRadar />
          </div>
        )}

        {selectedEntity && (
          <EntityDrawer
            entity={selectedEntity}
            ast={ast}
            onClose={() => setSelectedEntityId(null)}
            onSelectEntity={(id) => setSelectedEntityId(id)}
            impactTrace={impactTrace}
            onToggleImpactTrace={handleToggleImpactTrace}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>
          Synced from <code>technehub-labs/dea-metamodel@{metamodelVersion}</code>
          {' · '}
          {ast.entities.length} entities · {ast.relationships.length} relationships
        </span>
        <span>
          <a href="https://github.com/technehub-labs/dea-web-viewer">dea-web-viewer</a>
          {' · '}
          <a href="https://github.com/technehub-labs/dea-metamodel">dea-metamodel</a>
        </span>
      </footer>
    </div>
  );
}

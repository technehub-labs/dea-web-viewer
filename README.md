# dea-web-viewer

Interactive web viewer for the [TechNeHub Labs](https://github.com/technehub-labs) DEA
(Digital Enterprise Architecture) Metamodel. Renders the canonical metamodel as a
clickable, filterable, multi-view canvas.

**Live site:** <https://technehub-labs.github.io/dea-web-viewer/>

## What it is

A React 19 + Vite + TypeScript single-page app with five modes:

| Mode | Purpose |
| --- | --- |
| **Canonical SVG** | The bot-rendered `metamodel.svg` from `dea-metamodel`, with click + hover binding on `id="elem_<ALIAS>"` markers |
| **Interactive** | Hand-routed SVG topology — layer-aware layout, entity search, impact tracing (BFS upstream + downstream) |
| **Matrix** | Entity × relationship grid view |
| **Traceability** | Path finder between any two entities via BFS shortest path |
| **Catalogs** | Card grid of every entity in the synced graph, filterable by layer and status, with one-click link to its catalog repo |

## Source of truth

This viewer **does not** hand-author metamodel data. All entities, relationships,
layer assignments, and the rendered SVG are pulled from
[`technehub-labs/technehub-labs.github.io`](https://github.com/technehub-labs/technehub-labs.github.io)
(the **publication point** of the metamodel viewer) by a CI workflow and
committed under `public/data/`:

```
public/data/entity-graph.json   # entities, classes, catalog linkage
public/data/metamodel.svg       # canonical PlantUML render
public/data/metamodel.puml      # optional — only if upstream publishes it
```

The sync source is the Pages repo (not `dea-metamodel`, which is private)
because the Pages repo is what users actually see at
`https://technehub-labs.github.io/metamodel/` and is publicly fetchable
from CI without any PAT secret.

These files are **owned by the bot** — see [`.github/workflows/sync-from-dea-metamodel.yml`](.github/workflows/sync-from-dea-metamodel.yml).
Hand-edits will be overwritten on the next sync (the workflow detects the drift
and emits a `::warning::` annotation).

To change the metamodel, edit it in `dea-metamodel`, run its regeneration bot
to publish the new artefacts to `technehub-labs.github.io@main`, then trigger the
sync:

```bash
gh workflow run sync-from-dea-metamodel.yml --repo technehub-labs/dea-web-viewer
```

## Sync schedule

The bot runs:

- **Every 6 hours** via `cron: '0 */6 * * *'`
- **On `workflow_dispatch`** with an optional `ref` input (defaults to `main`)
- **On push to `public/data/*`** — fails the build to flag hand-edits as drift

## Local development

```bash
npm install
npm run dev       # vite dev server on http://localhost:3000
npm run lint      # tsc --noEmit (type check)
npm run build     # vite build → dist/
```

> The viewer requires `public/data/{entity-graph.json,metamodel.svg,metamodel.puml}`
> to exist. If you cloned a fresh copy and these are missing, run the sync
> workflow or copy them from the latest CI run.

## Architecture

```
src/
├── App.tsx                       # top-level state, view routing, error/loading UI
├── components/
│   ├── Header.tsx                # toolbar (view switch, search, export, version)
│   ├── LayerFilterBar.tsx        # per-layer toggle chips with entity counts
│   ├── InteractiveCanvas.tsx     # hand-routed SVG topology (1207 lines)
│   ├── CanonicalSvgView.tsx      # embeds synced SVG, wires elem_* click/hover
│   ├── MetamodelMatrix.tsx       # entity × relationship grid
│   ├── TraceabilityPathFinder.tsx# BFS shortest path between two entities
│   ├── CatalogBrowser.tsx        # card grid filterable by layer/status
│   └── EntityDrawer.tsx          # side-panel with selected entity detail
├── data/
│   ├── syncedMetamodel.ts        # runtime loader + PUML parser + AST builder
│   └── metamodelData.ts          # legacy re-export shim (kept for back-compat)
├── types.ts                      # shared TS interfaces
├── utils/                        # (reserved; no current utils)
└── main.tsx                      # React root
```

The runtime contract:

1. On mount, `App.tsx` calls `loadSyncedArtefacts()` which fetches all three files in parallel
2. `buildMetamodelAst()` parses the PUML for attributes and relationships, layers come from the graph
3. Components consume the resulting `MetamodelAST` — they never see the wire format
4. If the synced files are missing or invalid, the app surfaces an actionable error with the gh CLI command to fix it

## CI

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `sync-from-dea-metamodel.yml` | cron (6h), `workflow_dispatch`, push to `public/data/*` | Pull canonical artefacts from `dea-metamodel` and commit |
| `ci.yml` | push to `main`, pull request | `npm ci` + type check + build to catch regressions |
| `deploy-pages.yml` | push to `main`, after `ci.yml` succeeds | Build `dist/` and deploy to GitHub Pages |

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

```
TechNeHub Labs — dea-web-viewer
Copyright 2026 TechNeHub Labs
```
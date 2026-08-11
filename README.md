# dea-web-viewer

Interactive viewer for the [DEA Metamodel](https://github.com/technehub-labs/dea-metamodel).
The viewer is **mandatorily CI-driven** — its data layer never hand-edits its source.

## What this repo is

A React + Vite + Tailwind app that renders the canonical DEA Metamodel in five views:

| View | Source | What you see |
| --- | --- | --- |
| **Canonical SVG** | `public/data/metamodel.svg` (synced) | The metamodel bot's PlantUML render — click any entity to inspect it. |
| **Interactive** | `public/data/metamodel.puml` (synced) | Drag-and-drop topology canvas, BFS impact tracing, hover neighbour focus. |
| **Matrix** | `public/data/metamodel.puml` (synced) | Cross-layer relationship counts; click a cell to filter the relationship list. |
| **Traceability** | `public/data/metamodel.puml` (synced) | DFS path finder between any two entities. |
| **Catalogs** | `public/data/entity-graph.json` (synced) | Card grid of every catalog repo the metamodel points at. |

The visual language is borrowed from the TechNeHub Labs landing page: dark
theme, `#2dd4bf` accent, Space Grotesk + Inter typography. See
`src/index.css` for the design tokens.

## The sync contract

Everything under `public/data/` is **CI-managed**. The
`.github/workflows/sync-from-dea-metamodel.yml` workflow pulls three
artefacts from [`technehub-labs/dea-metamodel`](https://github.com/technehub-labs/dea-metamodel):

| Local path | Source |
| --- | --- |
| `public/data/entity-graph.json` | `dea-metamodel/viewer/entity-graph.json` |
| `public/data/metamodel.svg`     | `dea-metamodel/viewer/metamodel.svg` |
| `public/data/metamodel.puml`    | `dea-metamodel/metamodel-puml/metamodel-v2.puml` |

The workflow:

- **Runs on a schedule** (every 6 hours) so the viewer follows
  `dea-metamodel` automatically.
- **Runs on `workflow_dispatch`** so a human can force a sync from a
  specific ref (branch or tag).
- **Validates** the artefacts before committing — the JSON must match
  the schema, the SVG must contain `id="elem_<ALIAS>"` markers.
- **Commits and pushes** the diff to `main` with a `chore(sync):` prefix
  so reviewers can see at a glance that it was machine-generated.
- **Surfaces the metamodel version** in the commit message and in the
  navbar so it is always clear which pin of the metamodel the viewer
  is rendering.

If you push a hand-edit to `public/data/*`, the next sync run will
overwrite it and the workflow will log a warning explaining why.

## Local development

```bash
bun install
bun run dev      # vite dev server on :3000
bun run build    # production build
bun run preview  # preview the production build
```

The dev server reads the artefacts directly from `public/data/`. After
pulling new artefacts from `dea-metamodel`, restart the dev server to
see them.

To force a sync locally:

```bash
gh workflow run sync-from-dea-metamodel.yml --repo technehub-labs/dea-web-viewer
```

## How the data flow works

```
technehub-labs/dea-metamodel
   ├── viewer/entity-graph.json
   ├── viewer/metamodel.svg
   └── metamodel-puml/metamodel-v2.puml
                │
                │  (CI sync)
                ▼
   public/data/*.json|svg|puml
                │
                │  (fetched at runtime)
                ▼
   src/data/syncedMetamodel.ts
   ├── parseSyncedPuml() → entities + relationships
   ├── getEntityGraph()  → catalog_repo linkage
   └── getSyncedSvg()    → raw SVG for embedding
                │
                ▼
   Components (Header, CanonicalSvgView, InteractiveCanvas, …)
```

The `syncedMetamodel` module is the **only** place that knows the
artefacts are CI-managed. If the upstream format changes, only this
file and the workflow's validator need to change — the components
above keep working.

## Why this design

`dea-metamodel` is the canonical source of truth. The viewer is one of
many consumers (along with future `dea-cli`, `dea-pages`, etc.). If
the viewer were to hand-edit its data, the two repos would drift
silently and the framework's "single source of truth" promise would
break. By making the sync mandatory and CI-driven, every consumer
sees the same metamodel at the same version, and changes propagate
the moment `dea-metamodel` lands on `main`.

## License

Apache 2.0 — same as `dea-metamodel`.

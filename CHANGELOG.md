# Changelog

All notable changes to `dea-web-viewer` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.6.0] — spec-driven edge styling on the canvas

### Added
- `src/lib/edge-styles.ts` — spec-driven edge visual vocabulary aligned
  with the visualization profile (CR-8 §67) and the CR-6 §22 rule
  ("a planned edge must never render as a current edge" → non-active
  semantics always dashed). rel_type → stroke colour + dash pattern:
  structural (composition/aggregation) solid slate, behavioral
  (realization/flow/serving/execution) solid sky, governance
  (governance/contract) dashed violet, coupling (dependency/association)
  dashed/dotted slate.
- `InteractiveCanvas` — edge strokes now derive from `rel.relType`
  (passthrough added to `MetamodelRelationship` + the graph loader);
  a compact in-canvas EDGE TYPES legend shows the vocabulary.
- `tests/edgeStyles.test.ts` — 5 tests, including a guard that every
  rel_type present in the live graph has an explicit style.

## [0.5.0] — presentation-hints consumption + scoped exports

### Added
- **Visualization profile consumption (CR-8 §47-§48/§67)** —
  `src/lib/viz-profile.ts` + a new sync workflow
  (`sync-viz-profile-from-dea-metamodel.yml`) vendoring
  `dea-metamodel/visualization/profile/visualization.yaml` into
  `public/data/visualization/`. Group colors/labels shown in the
  MembershipFilterBar now come from the spec (core → #1f6feb,
  business → #8250df, …) instead of viewer-side hardcoding. Loader asserts
  drift against the inlined canonical; fallback = canonical (same pattern
  as the maturity loader).
- **Scoped exports (issue #4 follow-on)** — `src/lib/export.ts` + Header
  buttons: **JSON** (the filtered subset with provenance: metamodel version,
  membership filter, source URL, schema `dea-web-viewer/export/v1`) and
  **PUML** (the same subset re-emitted as a PlantUML fragment with
  attributes and solid/dashed arrows) — ready to paste into docs or
  re-render.
- `tests/vizProfileExport.test.ts` — 9 tests (profile parsing against the
  real upstream YAML shape, drift fallback, JSON/PUML export shape).

## [0.4.0] — coverage dashboard + viewpoint generator

### Added
- **Coverage & programme health view** (`src/lib/coverage.ts` +
  `src/components/CoverageDashboard.tsx`) — aggregates the synced graph:
  catalog coverage (cataloged vs backlog), status distribution bar,
  per-layer coverage, live catalog content (CR-CATALOG-STRUCT-07b), and
  the allocation gaps the programme cares about: unlayered entities and
  ECF 7×7 coordinate presence (currently near-zero — surfaced, not hidden).
  Turns the viewer into a programme-management instrument.
- **Viewpoints view** (issue #3) (`src/lib/viewpoints.ts` +
  `src/components/ViewpointGenerator.tsx`) — persona presets (CTO, Solution
  Architect, Business Analyst, Data Architect, Governance Lead, Ecosystem
  Manager, OpenDEA Core) that apply a curated layer + membership scope and
  produce a shareable deep link. Mirrors the metamodel's own
  `dea:entity-viewpoint` semantics: a tailored subset for a stakeholder
  concern, never a new model. Also accepts `?viewpoint=cto` URL sugar that
  expands into the canonical `?view=&layers=&membership=` params.
- `tests/coverageViewpoints.test.ts` — 10 tests for the new libs.

### Fixed
- `types.ts` status union was missing `proposed` — 31 entities in the live
  graph carry it. Added to the union (`MetamodelEntity.status`, graph entity
  type) and to `CatalogBrowser`'s status order + filter dropdown.
- `syncedMetamodel.ts` passes `ecf_coordinates` through the AST as
  `ecfCoordinatesRaw` (consumed by coverage.ts).

## [0.3.0] — quick-wins enrichment (deep-linking, search, Core/Profile mode)

### Added
- **Shareable deep links** (`src/lib/url-state.ts`) — the URL query string now
  encodes committed viewer state:
  `?view=interactive&entity=SO&layers=layer1,layer3&membership=core&q=…`.
  State hydrates on load and writes back via `history.replaceState` (no
  back-button pollution; per-keystroke search input is not synced). Invalid
  values (unknown views/layers) are silently dropped.
- **Full-text entity search** (issue #5) (`src/lib/search.ts` +
  `src/components/SearchPalette.tsx`) — fuzzy search across name / class
  alias / attributes / description with a ranked dropdown: ↑↓ to navigate,
  Enter to open the entity drawer, Esc to close. Global shortcuts: `/`
  focuses search, ⌘K / Ctrl+K focuses + selects.
- **Core/Profile membership mode** (CR-4 consumer) (`src/lib/membership.ts` +
  `src/components/MembershipFilterBar.tsx`) — a membership chip bar on the
  Interactive and Matrix views filters the canvas to the OpenDEA Core
  anchors, a single profile viewpoint (business, data, technology, ai,
  ecosystem, governance, digital), or the `unassigned` group — which
  surfaces the entities still awaiting upstream CR-5/6/7 allocation.
  Relationships whose endpoints fall outside the filter are dropped too.
- `tests/quickWins.test.ts` — 15 tests for the three new libs (URL
  parse/serialize round-trip, search ranking, membership grouping/filtering).

### Changed
- `Header.tsx` — search input is now a slot (`searchPalette`) so App.tsx can
  mount the richer SearchPalette without Header knowing its internals.
- `syncedMetamodel.ts` — the AST now carries `membershipRaw` (the CR-4
  `membership` object from `entity-graph.json`) as a passthrough.
- Reset button also clears the membership filter.

## [0.2.0] — 2026-08-21 — CR-MM-02 (Phase C consumer support, viewer half)

Adds the viewer half of the Maturity v2 consumer support (paired with
[CR-MM-02-CLI on `dea-cli`](https://github.com/technehub-labs/dea-cli/pull/10)).
The CR-014 and CR-MM-01 work — maturity v2 bands, effort multipliers, v2-beta
model files — gets an in-app visualisation here, gated behind a feature flag.

### Added
- `src/components/MaturityRadar.tsx` — production dual-band maturity radar
  (Proposal C from the mock preview; v1 legacy bands behind in teal, v2
  canonical bands in front, CR-014 worked-example score 80 / effort-adjusted
  value 49.2 rendered).
- `src/lib/feature-flags.ts` — pluggable feature-flag system. Default
  `maturityV2 = false`. Three-tier resolution:
  in-memory override → `localStorage` → build-time env (`VITE_MATURITY_V2`).
- `src/lib/maturity-v2-loader.ts` — fetches the vendored
  `public/data/maturity/maturity-bands-v2.yaml` and asserts it agrees with the
  inlined `V2_BANDS` canonical literal. Drift → console warning + fall back to
  canonical.
- `src/components/Header.tsx` — tabs list is now a prop (computed in `App.tsx`)
  so the "Maturity radar" tab hides when the flag is off.
- `src/types.ts` — `ViewMode` union gains `'maturity-radar'`.
- `tests/maturityV2.test.ts` — 10 tests, Node's built-in `node:test` runner via
  `tsx`. Covers the loader (drift detection, fallback on 404, parser happy-path)
  and the feature-flag API.
- `.github/workflows/sync-maturity-from-dea-metamodel.yml` — new sync
  workflow that pulls the canonical maturity YAMLs from
  `technehub-labs/dea-metamodel@main` (assessment-models/maturity/) into
  `public/data/maturity/`. Mirrors the design of the existing
  `sync-from-dea-metamodel.yml` (one-way, hand-edits overwritten on next sync,
  schedule + manual + push-to-this-repo triggers).
- `.github/workflows/ci.yml` — adds an `npm test` step after `tsc --noEmit`.

### Behaviour
- **Default = no change.** All 5 existing view modes still work; the
  "Maturity radar" tab is hidden by default. No `localStorage` write happens
  until the user actively opts in.
- **No new runtime dependencies.** Tests use Node's built-in `node:test`; loader
  parses YAML inline (no `js-yaml` dep added); viewer still builds on
  Vite/React/Tailwind unchanged.

### Known limitations
- Until `sync-maturity-from-dea-metamodel.yml` runs and commits the vendored
  YAMLs to `main`, the radar loads no remote data — it uses the inlined
  `V2_BANDS` literal. This is graceful (the inlined literal matches the
  canonical exactly), but a future CR can extend `loadMaturityData()` to also
  vendor v2-beta model files.

## [0.1.0] — initial release

- 5 view modes: Canonical SVG, Interactive, Matrix, Traceability, Catalogs.
- LayerFilter bar with per-layer counts.
- Synced artefacts: `entity-graph.json`, `metamodel.svg`, `metamodel.puml` (from
  the `sync-from-dea-metamodel.yml` workflow).
- Page deployed to <https://technehub-labs.github.io/dea-web-viewer/> via
  the `deploy-pages.yml` workflow.

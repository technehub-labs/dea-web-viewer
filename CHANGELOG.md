# Changelog

All notable changes to `dea-web-viewer` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

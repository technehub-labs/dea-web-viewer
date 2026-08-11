/* ------------------------------------------------------------------
 * metamodelData.ts (legacy shim)
 *
 * The hardcoded CANONICAL_PUML / LAYERS_DEF / ENTITY_DESCRIPTORS that
 * used to live here have been removed. The viewer now reads its data
 * from the CI-synced artefacts at /public/data/* via syncedMetamodel.ts.
 *
 * This file remains so existing imports keep compiling, but it now
 * only re-exports the synced loader. New code should import from
 * `syncedMetamodel` directly.
 * ------------------------------------------------------------------ */

export {
  loadSyncedArtefacts,
  buildMetamodelAst,
  getMetaVersion,
  getSyncedSvg,
  getSyncedPuml,
  getEntityGraph,
  parseSyncedPuml,
  type EntityGraph,
  type EntityGraphEntity,
} from './syncedMetamodel';

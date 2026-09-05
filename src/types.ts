export type LayerId = 'layer1' | 'layer2' | 'layer3' | 'layer4' | 'layer5' | 'dim';

export interface MetamodelAttribute {
  name: string;
  type: string;
}

export interface MetamodelEntity {
  id: string; // e.g., 'SO'
  name: string; // e.g., 'Strategic Objective'
  entity_id?: string; // e.g., 'dea:entity-strategic-objective' (from the synced graph)
  layerId: LayerId;
  layer_name?: string;
  catalog_repo?: string;
  repo_url?: string;
  status?: 'existing' | 'existing-extended' | 'planned' | 'scaffold';
  // CR-CATALOG-STRUCT-07b: live CATALOG.yaml summary (built-time data).
  catalog_summary?: CatalogSummary;
  attributes: MetamodelAttribute[];
  x?: number;
  y?: number;
  description?: string;
}

// CR-CATALOG-STRUCT-07b: live CATALOG.yaml summary for one conformant
// adopter. Populated at build time by .github/scripts/generate_entity_graph.py
// from each adopter's CATALOG.yaml (via the cross-repo consumer).
export interface CatalogSummary {
  entity_count: number;
  canonical: number;
  candidates: number;
  retired: number;
  research_files: number;
  latest_modified: string | null;
  met_version: string;
  abbreviation: string;
  catalog_name: string;
  generated_at: string; // ISO 8601
}

export interface MetamodelLayer {
  id: LayerId;
  number: number;
  name: string;
  subtitle: string;
  color: string;
  borderColor: string;
  badgeBg?: string; // legacy field; ignored by the new theme
  textColor?: string;
  description?: string;
}

export interface MetamodelRelationship {
  from: string;
  to: string;
  label: string;
  type?: 'solid' | 'dashed';
  cardinality?: string;
}

export interface MetamodelAST {
  title: string;
  version: string;
  layers: MetamodelLayer[];
  entities: MetamodelEntity[];
  relationships: MetamodelRelationship[];
  rawPuml: string;
}

export type ViewMode =
  | 'interactive'
  | 'canonical-svg'
  | 'matrix'
  | 'traceability'
  | 'catalogs';

export interface ImpactTrace {
  sourceId: string;
  upstreamIds: Set<string>;
  downstreamIds: Set<string>;
  connectedEdgeKeys: Set<string>;
}

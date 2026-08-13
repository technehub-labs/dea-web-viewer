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
  attributes: MetamodelAttribute[];
  x?: number;
  y?: number;
  description?: string;
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

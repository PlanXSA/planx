import type { Feature, Patch, Reject, Surface } from "../schema/index.ts";

export interface QueryFilter {
  project_id?: string;
  kind?: Feature["kind"];
  use?: string;
  surface?: Surface;
  source?: Feature["source"];
}

export interface Store {
  put(feature: Feature): Promise<void>;
  get(id: string, surface?: Surface): Promise<Feature | null>;
  delete(id: string, surface: Surface): Promise<void>;
  query(filter?: QueryFilter): Promise<Feature[]>;
  slice(boundary: GeoJSON.Polygon, surface: Surface): Promise<Feature[]>;
  apply(patches: Patch[]): Promise<Patch[] | Reject>;
}

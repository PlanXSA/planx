export type FeatureKind =
  | "street"
  | "parcel"
  | "amenity"
  | "path"
  | "green"
  | "utility"
  | "other";

export type Source = "osm" | "balady" | "planx" | "user";
export type CodeStatus = "ok" | "violate" | "unknown";
export type Surface = "base" | "project" | "snapshot";
export type Cardinal = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type Phase =
  | "select"
  | "import"
  | "reconcile"
  | "code"
  | "draw"
  | "classify"
  | "schedule"
  | "check"
  | "export";

export interface Feature {
  id: string;
  project_id: string;
  surface: Surface;
  geom: GeoJSON.Geometry;
  kind: FeatureKind;
  use?: string;
  source: Source;
  source_ref?: string;
  confidence?: number;
  code_status: CodeStatus;
  props: Record<string, unknown>;
  row_geom?: GeoJSON.Polygon;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  boundary: GeoJSON.Polygon;
  phase: Phase;
  codepack_id?: string;
  utm_epsg?: number;
  created_at: string;
  updated_at: string;
}

export interface Patch {
  op: "upsert" | "delete";
  feature: Feature;
}

export type RejectReason =
  | "self_intersection"
  | "overlap_parcel"
  | "unclosed"
  | "below_min_area";

export interface Reject {
  ok: false;
  reason: RejectReason;
  message: string;
}

export function isReject(v: unknown): v is Reject {
  return Boolean(v && typeof v === "object" && (v as Reject).ok === false);
}

export type {
  StreetProps,
  ParcelProps,
  ParcelVertex,
  ParcelEdge,
  ParcelNeighbor,
} from "./props.ts";


import type { Feature, UseDef } from "../schema/index.ts";
import { deriveParcel } from "./parcel.ts";
import { deriveStreet } from "./street.ts";
import { epsgForGeom } from "../geo/crs.ts";

export const DEFAULT_MIN_AREA_M2 = 1;
export const MIN_STREET_M = 0.05;

export function minAreaFor(feature: Feature, defs: Iterable<UseDef> = []): number {
  if (!feature.use) return DEFAULT_MIN_AREA_M2;
  for (const d of defs) {
    if (d.project_id === feature.project_id && d.key === feature.use) {
      return d.min_area_m2 ?? DEFAULT_MIN_AREA_M2;
    }
  }
  return DEFAULT_MIN_AREA_M2;
}

export function applyMeasures(feature: Feature, utmEpsg?: number): Feature {
  const row: Feature = { ...feature, props: { ...feature.props } };
  const now = new Date().toISOString();
  const epsg = utmEpsg ?? epsgForGeom(row.geom);

  const parcel = deriveParcel(row, epsg);
  if (parcel) {
    row.area_m2 = parcel.area_m2;
    row.frontage_m = parcel.frontage_m;
    delete row.length_m;
    row.measure_epsg = epsg;
    row.measure_at = now;
    const next: Record<string, unknown> = { ...row.props };
    delete next.area_m2;
    delete next.frontage_m;
    delete next.length_m;
    next.vertices = parcel.vertices;
    next.edges = parcel.edges;
    next.frontage_estimated = parcel.frontage_estimated;
    row.props = next;
  }

  const street = deriveStreet(row, epsg);
  if (street) {
    row.length_m = street.length_m;
    delete row.area_m2;
    delete row.frontage_m;
    row.measure_epsg = epsg;
    row.measure_at = now;
    const next: Record<string, unknown> = { ...row.props };
    delete next.area_m2;
    delete next.frontage_m;
    delete next.length_m;
    if (street.name) next.name = street.name;
    if (street.width_m != null) next.width_m = street.width_m;
    if (street.highway) next.highway = street.highway;
    if (street.section_id) next.section_id = street.section_id;
    row.props = next;
  }

  return row;
}

export function belowMinArea(feature: Feature, minAreaM2 = DEFAULT_MIN_AREA_M2): boolean {
  if (feature.kind !== "parcel") return false;
  if (feature.area_m2 === undefined) return true;
  return feature.area_m2 < minAreaM2;
}

export function streetTooShort(feature: Feature): boolean {
  if (feature.kind !== "street" && feature.kind !== "path") return false;
  if (feature.geom.type !== "LineString") return true;
  if (feature.geom.coordinates.length < 2) return true;
  if (feature.length_m === undefined) return true;
  return feature.length_m < MIN_STREET_M;
}

import type { Feature, Surface } from "../schema/index.ts";
import type { QueryFilter } from "./types.ts";

export function upsertFeatureSql(f: Feature): { sql: string; args: unknown[] } {
  return {
    sql: `
INSERT INTO features (
  id, project_id, surface, geom, kind, use, source, source_ref,
  confidence, code_status, props, length_m, area_m2, frontage_m,
  measure_epsg, measure_at, created_at, updated_at
) VALUES (
  ?, ?, ?, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326), ?, ?, ?, ?,
  ?, ?, ?::JSON, ?, ?, ?, ?, ?, ?, ?
)
ON CONFLICT (surface, id) DO UPDATE SET
  geom = excluded.geom,
  kind = excluded.kind,
  use = excluded.use,
  source = excluded.source,
  source_ref = excluded.source_ref,
  props = excluded.props,
  length_m = excluded.length_m,
  area_m2 = excluded.area_m2,
  frontage_m = excluded.frontage_m,
  measure_epsg = excluded.measure_epsg,
  measure_at = excluded.measure_at,
  updated_at = excluded.updated_at
`,
    args: [
      f.id,
      f.project_id,
      f.surface,
      JSON.stringify(f.geom),
      f.kind,
      f.use ?? null,
      f.source,
      f.source_ref ?? null,
      f.confidence ?? null,
      f.code_status,
      JSON.stringify(f.props ?? {}),
      f.length_m ?? null,
      f.area_m2 ?? null,
      f.frontage_m ?? null,
      f.measure_epsg ?? null,
      f.measure_at ?? null,
      f.created_at,
      f.updated_at,
    ],
  };
}

export function deleteFeatureSql(id: string, surface: Surface): { sql: string; args: unknown[] } {
  return { sql: `DELETE FROM features WHERE surface = ? AND id = ?`, args: [surface, id] };
}

export function getFeatureSql(id: string, surface: Surface): { sql: string; args: unknown[] } {
  return {
    sql: `SELECT *, ST_AsGeoJSON(geom) AS geom_json FROM features WHERE surface = ? AND id = ?`,
    args: [surface, id],
  };
}

export function queryFeatureSql(filter: QueryFilter = {}): { sql: string; args: unknown[] } {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.project_id) {
    where.push("project_id = ?");
    args.push(filter.project_id);
  }
  if (filter.kind) {
    where.push("kind = ?");
    args.push(filter.kind);
  }
  if (filter.use) {
    where.push("use = ?");
    args.push(filter.use);
  }
  if (filter.surface) {
    where.push("surface = ?");
    args.push(filter.surface);
  }
  if (filter.source) {
    where.push("source = ?");
    args.push(filter.source);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return {
    sql: `SELECT *, ST_AsGeoJSON(geom) AS geom_json FROM features ${clause}`,
    args,
  };
}

export function replaceOsmSql(projectId: string, sourceRef: string): { sql: string; args: unknown[] } {
  return {
    sql: `DELETE FROM features WHERE project_id = ? AND surface = 'base' AND source = 'osm' AND source_ref = ?`,
    args: [projectId, sourceRef],
  };
}

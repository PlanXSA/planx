import type { Feature, Patch, Reject, Surface } from "../schema/index.ts";
import { deriveParcel } from "../engines/parcel.ts";
import { deriveStreet } from "../engines/street.ts";
import { topology } from "./memory.ts";
import {
  deleteFeatureSql,
  getFeatureSql,
  queryFeatureSql,
  replaceOsmSql,
  upsertFeatureSql,
} from "./sql.ts";
import type { QueryFilter, Store } from "./types.ts";

export type SqlExec = (sql: string, args?: unknown[]) => Promise<Record<string, unknown>[]>;

function rowToFeature(row: Record<string, unknown>): Feature {
  const geom =
    typeof row.geom_json === "string" ? (JSON.parse(row.geom_json) as GeoJSON.Geometry) : row.geom;
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    surface: row.surface as Surface,
    geom: geom as GeoJSON.Geometry,
    kind: row.kind as Feature["kind"],
    use: (row.use as string) || undefined,
    source: row.source as Feature["source"],
    source_ref: (row.source_ref as string) || undefined,
    confidence: row.confidence as number | undefined,
    code_status: row.code_status as Feature["code_status"],
    props: typeof row.props === "string" ? JSON.parse(row.props) : (row.props as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Same Store contract as MemoryStore. Requires a live DuckDB Spatial exec. */
export class DuckStore implements Store {
  constructor(private exec: SqlExec) {}

  async put(feature: Feature): Promise<void> {
    if (feature.source_ref && feature.source === "osm") {
      const drop = replaceOsmSql(feature.project_id, feature.source_ref);
      await this.exec(drop.sql, drop.args);
    }
    const q = upsertFeatureSql(feature);
    await this.exec(q.sql, q.args);
  }

  async get(id: string, surface: Surface = "project"): Promise<Feature | null> {
    const q = getFeatureSql(id, surface);
    const rows = await this.exec(q.sql, q.args);
    return rows[0] ? rowToFeature(rows[0]) : null;
  }

  async delete(id: string, surface: Surface): Promise<void> {
    const q = deleteFeatureSql(id, surface);
    await this.exec(q.sql, q.args);
  }

  async query(filter: QueryFilter = {}): Promise<Feature[]> {
    const q = queryFeatureSql(filter);
    const rows = await this.exec(q.sql, q.args);
    return rows.map(rowToFeature);
  }

  async slice(boundary: GeoJSON.Polygon, surface: Surface): Promise<Feature[]> {
    const rows = await this.exec(
      `SELECT *, ST_AsGeoJSON(geom) AS geom_json FROM features
       WHERE surface = ? AND ST_Intersects(geom, ST_GeomFromGeoJSON(?))`,
      [surface, JSON.stringify(boundary)],
    );
    return rows.map(rowToFeature);
  }

  async apply(patches: Patch[]): Promise<Patch[] | Reject> {
    for (const p of patches) {
      if (p.op === "upsert") {
        const reject = topology(p.feature);
        if (reject) return reject;
      }
    }
    for (const p of patches) {
      if (p.op === "delete") {
        await this.delete(p.feature.id, p.feature.surface);
        continue;
      }
      const row = { ...p.feature, props: { ...p.feature.props } };
      const parcel = deriveParcel(row);
      const street = deriveStreet(row);
      if (parcel) Object.assign(row.props, parcel);
      if (street) Object.assign(row.props, street);
      const q = upsertFeatureSql(row);
      await this.exec(q.sql, q.args);
    }
    return patches;
  }
}

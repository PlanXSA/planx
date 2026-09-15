import type { Feature, Patch, Reject, Surface } from "../schema/index.ts";
import { isReject } from "../schema/index.ts";
import type { QueryFilter, Store } from "./types.ts";
import { deriveParcel } from "../engines/parcel.ts";

export type { QueryFilter, Store } from "./types.ts";


function ringClosed(geom: GeoJSON.Geometry): boolean {
  if (geom.type !== "Polygon") return true;
  const ring = geom.coordinates[0];
  if (!ring || ring.length < 4) return false;
  const a = ring[0];
  const b = ring[ring.length - 1];
  return a[0] === b[0] && a[1] === b[1];
}

function selfIntersects(geom: GeoJSON.Geometry): boolean {
  if (geom.type !== "Polygon") return false;
  const ring = geom.coordinates[0];
  if (!ring || ring.length < 5) return false;
  // naive segment cross, ignore shared vertices
  const segs = ring.slice(0, -1);
  const orient = (p: number[], q: number[], r: number[]) =>
    (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  const onSeg = (p: number[], q: number[], r: number[]) =>
    Math.min(p[0], r[0]) <= q[0] &&
    q[0] <= Math.max(p[0], r[0]) &&
    Math.min(p[1], r[1]) <= q[1] &&
    q[1] <= Math.max(p[1], r[1]);
  const inter = (p1: number[], p2: number[], q1: number[], q2: number[]) => {
    const o1 = orient(p1, p2, q1);
    const o2 = orient(p1, p2, q2);
    const o3 = orient(q1, q2, p1);
    const o4 = orient(q1, q2, p2);
    if (o1 === 0 && onSeg(p1, q1, p2)) return false;
    return o1 * o2 < 0 && o3 * o4 < 0;
  };
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === segs.length - 1)) continue;
      if (inter(segs[i], segs[(i + 1) % segs.length], segs[j], segs[(j + 1) % segs.length])) {
        return true;
      }
    }
  }
  return false;
}

export function topology(feature: Feature): Reject | null {
  if (feature.kind === "parcel") {
    if (!ringClosed(feature.geom)) {
      return { ok: false, reason: "unclosed", message: "parcel ring is not closed" };
    }
    if (selfIntersects(feature.geom)) {
      return { ok: false, reason: "self_intersection", message: "parcel self-intersects" };
    }
  }
  return null;
}

export class MemoryStore implements Store {
  private features = new Map<string, Feature>();

  private key(surface: Surface, id: string) {
    return `${surface}:${id}`;
  }

  async put(feature: Feature): Promise<void> {
    this.features.set(this.key(feature.surface, feature.id), structuredClone(feature));
  }

  async get(id: string, surface: Surface = "project"): Promise<Feature | null> {
    return this.features.get(this.key(surface, id)) ?? null;
  }

  async delete(id: string, surface: Surface): Promise<void> {
    this.features.delete(this.key(surface, id));
  }

  async query(filter: QueryFilter = {}): Promise<Feature[]> {
    return [...this.features.values()].filter((f) => {
      if (filter.project_id && f.project_id !== filter.project_id) return false;
      if (filter.kind && f.kind !== filter.kind) return false;
      if (filter.use && f.use !== filter.use) return false;
      if (filter.surface && f.surface !== filter.surface) return false;
      if (filter.source && f.source !== filter.source) return false;
      return true;
    });
  }

  async slice(boundary: GeoJSON.Polygon, surface: Surface): Promise<Feature[]> {
    // v0: return all on that surface; spatial clip is DuckDB ST_Intersects
    void boundary;
    return this.query({ surface });
  }

  async apply(patches: Patch[]): Promise<Patch[] | Reject> {
    const snapshot = new Map(this.features);
    // Validate all patches before writing any.
    for (const p of patches) {
      if (p.op === "upsert") {
        const reject = topology(p.feature);
        if (reject) {
          this.features = snapshot;
          return reject;
        }
      }
    }
    // All validation passed; write patches and derive parcel properties.
    for (const p of patches) {
      if (p.op === "delete") {
        this.features.delete(this.key(p.feature.surface, p.feature.id));
      } else {
        const feature = structuredClone(p.feature);
        // Merge derived parcel properties into props on upsert.
        if (feature.kind === "parcel") {
          const derived = deriveParcel(feature);
          feature.props = { ...feature.props, ...derived };
        }
        this.features.set(this.key(feature.surface, feature.id), feature);
      }
    }
    return patches;
  }
}

export { isReject };

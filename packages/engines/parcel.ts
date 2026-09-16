import type { Feature } from "../schema/index.ts";
import type { ParcelEdge, ParcelProps, ParcelVertex } from "../schema/props.ts";
import { lonLatToUtm, utmEpsgFromLon } from "../geo/crs.ts";

export function deriveParcel(feature: Feature, utmEpsg?: number): ParcelProps | null {
  if (feature.kind !== "parcel" || feature.geom.type !== "Polygon") return null;
  const ring = feature.geom.coordinates[0];
  if (!ring || ring.length < 4) return null;

  const verts: ParcelVertex[] = ring.slice(0, -1).map((p, i) => ({
    i,
    lon: p[0],
    lat: p[1],
    z: p[2],
  }));
  if (verts.length < 3) return null;

  const epsg = utmEpsg ?? utmEpsgFromLon(verts[0].lon);
  const xy = verts.map((v) => lonLatToUtm(v.lon, v.lat, epsg));

  const edges: ParcelEdge[] = [];
  let maxLen = -1;
  let maxI = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % verts.length];
    const length_m = Math.hypot(b.e - a.e, b.n - a.n);
    edges.push({ i, length_m, frontage: false });
    if (length_m > maxLen) {
      maxLen = length_m;
      maxI = i;
    }
  }
  edges[maxI].frontage = true;

  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    area += a.e * b.n - b.e * a.n;
  }

  return {
    vertices: verts,
    edges,
    frontage_estimated: true,
    area_m2: Math.abs(area) / 2,
    frontage_m: edges[maxI].length_m,
  };
}

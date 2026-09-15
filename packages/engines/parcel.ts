import type { Feature } from "../schema/index.ts";
import type { ParcelEdge, ParcelProps, ParcelVertex } from "../schema/props.ts";

const M_PER_DEG_LAT = 111_320;

function meters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const mid = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lon2 - lon1) * M_PER_DEG_LAT * Math.cos(mid);
  const dy = (lat2 - lat1) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

export function deriveParcel(feature: Feature): ParcelProps | null {
  if (feature.kind !== "parcel" || feature.geom.type !== "Polygon") return null;
  const ring = feature.geom.coordinates[0];
  if (!ring || ring.length < 4) return null;

  const verts: ParcelVertex[] = ring.slice(0, -1).map((p, i) => ({
    i,
    lon: p[0],
    lat: p[1],
    z: p[2],
  }));

  const edges: ParcelEdge[] = [];
  let maxLen = -1;
  let maxI = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const length_m = meters(a.lon, a.lat, b.lon, b.lat);
    edges.push({ i, length_m, frontage: false });
    if (length_m > maxLen) {
      maxLen = length_m;
      maxI = i;
    }
  }
  edges[maxI].frontage = true;

  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const mid = (a.lat * Math.PI) / 180;
    const ax = a.lon * M_PER_DEG_LAT * Math.cos(mid);
    const ay = a.lat * M_PER_DEG_LAT;
    const bx = b.lon * M_PER_DEG_LAT * Math.cos(mid);
    const by = b.lat * M_PER_DEG_LAT;
    area += ax * by - bx * ay;
  }

  return {
    area_m2: Math.abs(area) / 2,
    vertices: verts,
    edges,
    frontage_m: edges[maxI].length_m,
    frontage_estimated: true,
  };
}

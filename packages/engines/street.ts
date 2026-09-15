import type { Feature } from "../schema/index.ts";
import type { StreetProps } from "../schema/props.ts";

const M_PER_DEG_LAT = 111_320;

function meters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const mid = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lon2 - lon1) * M_PER_DEG_LAT * Math.cos(mid);
  const dy = (lat2 - lat1) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

export function deriveStreet(feature: Feature): StreetProps | null {
  if (feature.kind !== "street" && feature.kind !== "path") return null;
  if (feature.geom.type !== "LineString") return null;
  const coords = feature.geom.coordinates;
  if (coords.length < 2) return null;
  let length_m = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    length_m += meters(a[0], a[1], b[0], b[1]);
  }
  return { length_m };
}

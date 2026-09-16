import type { Feature } from "../schema/index.ts";
import type { StreetProps } from "../schema/props.ts";
import { lonLatToUtm, utmEpsgFromLon } from "../geo/crs.ts";

export function deriveStreet(feature: Feature, utmEpsg?: number): StreetProps | null {
  if (feature.kind !== "street" && feature.kind !== "path") return null;
  if (feature.geom.type !== "LineString") return null;
  const coords = feature.geom.coordinates;
  if (coords.length < 2) return null;
  const epsg = utmEpsg ?? utmEpsgFromLon(coords[0][0]);
  let length_m = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = lonLatToUtm(coords[i][0], coords[i][1], epsg);
    const b = lonLatToUtm(coords[i + 1][0], coords[i + 1][1], epsg);
    length_m += Math.hypot(b.e - a.e, b.n - a.n);
  }
  return { length_m };
}

import type { Feature } from "../schema/index.ts";
import type { ParcelProps } from "../schema/props.ts";

/**
 * Derive parcel properties from geometry on local-plane (meters).
 * Computes area, frontage, and vertices/edges in UTM projection.
 * frontage_estimated = true when computed without explicit boundary.
 */
export function deriveParcel(feature: Feature, utm_epsg?: number): ParcelProps {
  if (feature.kind !== "parcel" || feature.geom.type !== "Polygon") {
    return {};
  }

  const ring = feature.geom.coordinates[0];
  if (!ring || ring.length < 4) {
    return {};
  }

  // Local-plane approximation: use meters per degree at the centroid latitude.
  // For KSA (20–32°N), ~111 km/degree latitude, ~73–93 km/degree longitude.
  // This is a v0 placeholder; production would use proper UTM projection.
  const centroidLat = ring.reduce((sum, pt) => sum + pt[1], 0) / ring.length;
  const metersPerDegreeLat = 111_000;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos((centroidLat * Math.PI) / 180);

  // Compute closed ring (remove last point if it's a duplicate of the first).
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;

  // Shoelace formula for area (in square degrees), then convert to m².
  let areaDegrees2 = 0;
  for (let i = 0; i < closed.length; i++) {
    const j = (i + 1) % closed.length;
    areaDegrees2 +=
      (closed[j][0] - closed[i][0]) * (closed[j][1] + closed[i][1]);
  }
  const areaM2 = Math.abs(areaDegrees2 / 2) * metersPerDegreeLat * metersPerDegreeLon;

  // Compute vertices and edges.
  const vertices = closed.map((pt, i) => ({
    i,
    lon: pt[0],
    lat: pt[1],
  }));

  let frontageMTotal = 0;
  const edges = closed.map((pt, i) => {
    const next = closed[(i + 1) % closed.length];
    const dLat = (next[1] - pt[1]) * metersPerDegreeLat;
    const dLon = (next[0] - pt[0]) * metersPerDegreeLon;
    const length_m = Math.sqrt(dLat * dLat + dLon * dLon);
    frontageMTotal += length_m;
    return {
      i,
      length_m,
      frontage: false, // Mark as unknown; caller may annotate with boundary data.
    };
  });

  return {
    area_m2: areaM2,
    vertices,
    edges,
    frontage_m: frontageMTotal,
    frontage_estimated: true,
  };
}

import type { Feature } from "../schema/index.ts";

/**
 * Detect if two polygons overlap in their interior.
 * Shared edges or vertices are NOT considered overlap.
 * Returns true only if polygons have interior intersection.
 */
export function polygonsOverlap(geom1: GeoJSON.Geometry, geom2: GeoJSON.Geometry): boolean {
  if (geom1.type !== "Polygon" || geom2.type !== "Polygon") {
    return false;
  }

  const coords1 = geom1.coordinates[0];
  const coords2 = geom2.coordinates[0];

  if (!coords1 || !coords2) return false;

  // Check if any vertex of polygon 1 is strictly inside polygon 2
  for (const vertex of coords1) {
    if (pointStrictlyInside(vertex, coords2)) {
      return true;
    }
  }

  // Check if any vertex of polygon 2 is strictly inside polygon 1
  for (const vertex of coords2) {
    if (pointStrictlyInside(vertex, coords1)) {
      return true;
    }
  }

  return false;
}

/**
 * Ray casting algorithm to detect if point is strictly inside polygon.
 * Points on the boundary return false.
 */
function pointStrictlyInside(point: number[], polygon: number[][]): boolean {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    // Check if point is exactly on a vertex
    if (px === xi && py === yi) {
      return false;
    }

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if any two parcels in a list overlap (excluding self-comparison).
 * Returns the IDs of overlapping pair, or null if none overlap.
 */
export function findOverlapingParcels(features: Feature[]): [string, string] | null {
  const parcels = features.filter((f) => f.kind === "parcel");

  for (let i = 0; i < parcels.length; i++) {
    for (let j = i + 1; j < parcels.length; j++) {
      const p1 = parcels[i];
      const p2 = parcels[j];

      // Only check same surface and project
      if (p1.surface !== p2.surface || p1.project_id !== p2.project_id) {
        continue;
      }

      if (polygonsOverlap(p1.geom, p2.geom)) {
        return [p1.id, p2.id];
      }
    }
  }

  return null;
}

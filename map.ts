import type { FeatureKind } from "../../schema/index.ts";

/** Conservative OSM → Plan X kind. Buildings and landuse are not parcels. */
export function kindFromOsmTags(tags: Record<string, string>): FeatureKind | null {
  const highway = tags.highway;
  if (highway && HIGHWAYS.has(highway)) return "street";
  if (tags.place === "plot") return "parcel";
  if (GREEN.has(tags.leisure) || GREEN.has(tags.landuse)) return "green";
  if (tags.highway === "path" || tags.highway === "footway" || tags.highway === "cycleway") {
    return "path";
  }
  if (AMENITY.has(tags.amenity)) return "amenity";
  if (tags.power || tags.utility) return "utility";
  return null;
}

const HIGHWAYS = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "service",
  "living_street",
]);

const GREEN = new Set(["park", "garden", "playground", "grass", "recreation_ground"]);

const AMENITY = new Set([
  "place_of_worship",
  "hospital",
  "clinic",
  "school",
  "police",
  "marketplace",
]);

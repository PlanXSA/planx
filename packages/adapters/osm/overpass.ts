import type { Feature } from "../../schema/index.ts";
import { kindFromOsmTags } from "./map.ts";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export type BBox = { south: number; west: number; north: number; east: number };

type OsmTags = Record<string, string>;
type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: OsmTags };
type OsmWay = { type: "way"; id: number; nodes: number[]; tags?: OsmTags };
type OsmJson = { elements: Array<OsmNode | OsmWay | { type: string }> };

const QUERY = (b: BBox) => `
[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|footway|path|cycleway)$"](${b.south},${b.west},${b.north},${b.east});
  node["amenity"~"^(place_of_worship|hospital|clinic|school|police|marketplace)$"](${b.south},${b.west},${b.north},${b.east});
  way["place"="plot"](${b.south},${b.west},${b.north},${b.east});
  way["leisure"~"^(park|garden|playground)$"](${b.south},${b.west},${b.north},${b.east});
  way["landuse"~"^(grass|recreation_ground)$"](${b.south},${b.west},${b.north},${b.east});
);
out body; >; out skel qt;
`;

export function featuresFromOverpass(
  raw: OsmJson,
  projectId: string,
): Feature[] {
  const now = new Date().toISOString();
  const nodes = new Map<number, OsmNode>();
  for (const el of raw.elements) {
    if (el.type === "node") nodes.set(el.id, el as OsmNode);
  }

  const out: Feature[] = [];

  for (const el of raw.elements) {
    if (el.type === "node") {
      const n = el as OsmNode;
      const tags = n.tags ?? {};
      const kind = kindFromOsmTags(tags);
      if (!kind) continue;
      out.push(row(projectId, `node/${n.id}`, kind, {
        type: "Point",
        coordinates: [n.lon, n.lat],
      }, tags, now));
      continue;
    }
    if (el.type !== "way") continue;
    const w = el as OsmWay;
    const tags = w.tags ?? {};
    const kind = kindFromOsmTags(tags);
    if (!kind) continue;
    const coords: number[][] = [];
    for (const id of w.nodes ?? []) {
      const n = nodes.get(id);
      if (n) coords.push([n.lon, n.lat]);
    }
    if (coords.length < 2) continue;
    const closed =
      kind === "parcel" || kind === "green"
        ? coords.length >= 4 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]
        : false;
    const geom: GeoJSON.Geometry = closed
      ? { type: "Polygon", coordinates: [coords] }
      : { type: "LineString", coordinates: coords };
    if (kind === "parcel" && geom.type !== "Polygon") continue;
    out.push(row(projectId, `way/${w.id}`, kind, geom, tags, now));
  }
  return out;
}

function row(
  projectId: string,
  ref: string,
  kind: Feature["kind"],
  geom: GeoJSON.Geometry,
  tags: OsmTags,
  now: string,
): Feature {
  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    surface: "base",
    geom,
    kind,
    source: "osm",
    source_ref: ref,
    code_status: "unknown",
    props: { osm_tags: tags },
    created_at: now,
    updated_at: now,
  };
}

export async function fetchOverpass(bbox: BBox, projectId: string): Promise<Feature[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: "data=" + encodeURIComponent(QUERY(bbox)),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as OsmJson;
  return featuresFromOverpass(json, projectId);
}

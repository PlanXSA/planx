import type { Feature, FeatureKind } from "../schema/index.ts";

export type Draft = { kind: FeatureKind; vertices: [number, number][] };

export function addVertex(draft: Draft, lon: number, lat: number): Draft {
  return { ...draft, vertices: [...draft.vertices, [lon, lat]] };
}

export function closeDraft(draft: Draft, projectId: string): Feature | null {
  if (draft.kind === "parcel") {
    if (draft.vertices.length < 3) return null;
    const ring = [...draft.vertices, draft.vertices[0]];
    return feature(projectId, "parcel", { type: "Polygon", coordinates: [ring] });
  }
  if (draft.kind === "street" || draft.kind === "path") {
    if (draft.vertices.length < 2) return null;
    return feature(projectId, draft.kind, {
      type: "LineString",
      coordinates: draft.vertices,
    });
  }
  return null;
}

function feature(
  projectId: string,
  kind: FeatureKind,
  geom: GeoJSON.Geometry,
): Feature {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    surface: "project",
    geom,
    kind,
    source: "user",
    code_status: "unknown",
    props: {},
    created_at: now,
    updated_at: now,
  };
}

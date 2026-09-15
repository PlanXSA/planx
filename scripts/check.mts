import { MemoryStore } from "../packages/store/memory.ts";
import { isReject, type Feature } from "../packages/schema/index.ts";
import { kindFromOsmTags } from "../packages/adapters/osm/map.ts";
import { featuresFromOverpass } from "../packages/adapters/osm/overpass.ts";
import { addVertex, closeDraft } from "../packages/engines/draft.ts";

const closed: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[[46.6, 24.7], [46.61, 24.7], [46.61, 24.71], [46.6, 24.71], [46.6, 24.7]]],
};
const open: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[[46.6, 24.7], [46.61, 24.7], [46.61, 24.71], [46.6, 24.71]]],
};

function parcel(id: string, geom: GeoJSON.Polygon): Feature {
  const now = new Date().toISOString();
  return {
    id,
    project_id: "p1",
    surface: "project",
    geom,
    kind: "parcel",
    source: "user",
    code_status: "unknown",
    props: {},
    created_at: now,
    updated_at: now,
  };
}

const store = new MemoryStore();
const ok = await store.apply([{ op: "upsert", feature: parcel("a", closed) }]);
if (isReject(ok) || !(await store.get("a"))) throw new Error("closed parcel must write");

const bad = await store.apply([{ op: "upsert", feature: parcel("bad", open) }]);
if (!isReject(bad) || bad.reason !== "unclosed") throw new Error("open parcel must reject");
if (await store.get("bad")) throw new Error("reject must write nothing");

if (kindFromOsmTags({ highway: "residential" }) !== "street") throw new Error("highway map");
if (kindFromOsmTags({ building: "yes" }) !== null) throw new Error("no building parcels");
if (kindFromOsmTags({ place: "plot" }) !== "parcel") throw new Error("plot map");

const store2 = new MemoryStore();
const batch = await store2.apply([
  { op: "upsert", feature: parcel("g1", closed) },
  { op: "upsert", feature: parcel("b1", open) },
]);
if (!isReject(batch)) throw new Error("mixed batch must reject");
if (await store2.get("g1")) throw new Error("batch reject must write nothing");

const store3 = new MemoryStore();
await store3.apply([{ op: "upsert", feature: parcel("m1", closed) }]);
const row = await store3.get("m1");
const area = Number(row?.props.area_m2);
if (!(area > 0)) throw new Error("closed parcel must get area_m2");
if (row?.props.frontage_estimated !== true) throw new Error("frontage must be marked estimated");

const osmRows = featuresFromOverpass(
  {
    elements: [
      { type: "node", id: 1, lat: 24.7, lon: 46.6 },
      { type: "node", id: 2, lat: 24.71, lon: 46.61 },
      { type: "way", id: 10, nodes: [1, 2], tags: { highway: "residential" } },
      { type: "way", id: 99, nodes: [1, 2], tags: { building: "yes" } },
    ],
  },
  "p1",
);
if (!osmRows.some((r) => r.source_ref === "way/10" && r.kind === "street")) {
  throw new Error("overpass parser must emit street");
}
if (osmRows.some((r) => r.source_ref === "way/99")) {
  throw new Error("overpass parser must skip buildings");
}

let d = { kind: "parcel" as const, vertices: [] as [number, number][] };
d = addVertex(d, 46.6, 24.7);
d = addVertex(d, 46.61, 24.7);
d = addVertex(d, 46.61, 24.71);
const closedDraft = closeDraft(d, "p1");
if (!closedDraft || closedDraft.geom.type !== "Polygon") throw new Error("draft must close parcel");
const two = closeDraft({ kind: "parcel", vertices: [[46.6, 24.7], [46.61, 24.7]] }, "p1");
if (two) throw new Error("two vertices must not close a parcel");

const stStore = new MemoryStore();
const streetFeat: Feature = {
  ...parcel("st1", closed),
  kind: "street",
  geom: { type: "LineString", coordinates: [[46.6, 24.7], [46.61, 24.7]] },
};
const stOut = await stStore.apply([{ op: "upsert", feature: streetFeat }]);
if (isReject(stOut)) throw new Error("street line must apply");
const stRow = await stStore.get("st1");
if (!(Number(stRow?.props.length_m) > 0)) throw new Error("street must get length_m");

const once: Feature = {
  ...streetFeat,
  id: "osm1",
  surface: "base",
  source: "osm",
  source_ref: "way/10",
};
await stStore.put(once);
await stStore.put({ ...once, id: "osm1b" });
const osmOnly = (await stStore.query({ source: "osm", surface: "base" })).filter(
  (r) => r.source_ref === "way/10",
);
if (osmOnly.length !== 1) throw new Error("re-import same source_ref must not duplicate");

console.log("workbench draft + store checks passed");

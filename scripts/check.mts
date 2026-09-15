import { MemoryStore } from "../packages/store/memory.ts";
import { isReject, type Feature } from "../packages/schema/index.ts";
import { kindFromOsmTags } from "../packages/adapters/osm/map.ts";

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

console.log("slice 1 checks passed");

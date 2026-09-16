import { MemoryStore } from "../packages/store/memory.ts";
import { isReject, type Feature } from "../packages/schema/index.ts";
import { kindFromOsmTags } from "../packages/adapters/osm/map.ts";
import { featuresFromOverpass } from "../packages/adapters/osm/overpass.ts";
import { addVertex, closeDraft } from "../packages/engines/draft.ts";
import { upsertFeatureSql, queryFeatureSql } from "../packages/store/sql.ts";
import { lonLatToUtm, utmEpsgFromLon, utmToLonLat } from "../packages/geo/crs.ts";
import { deriveStreet } from "../packages/engines/street.ts";
import { deriveParcel } from "../packages/engines/parcel.ts";
import { parseStore, serializeStore } from "../packages/store/snapshot.ts";
import { bootStore } from "../packages/store/runtime.ts";

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
const area = Number(row?.area_m2 ?? row?.props.area_m2);
if (!(area > 0)) throw new Error("closed parcel must get area_m2");
if (row?.area_m2 !== area) throw new Error("area_m2 must live on the row");
if (row?.props.area_m2 != null) throw new Error("area_m2 must not be mirrored in props");
if (row?.props.frontage_estimated !== true) throw new Error("frontage must be marked estimated");
if (row?.measure_epsg !== 32638) throw new Error("Riyadh parcel must stamp UTM 38N");

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
if (!(Number(stRow?.length_m) > 0)) throw new Error("street must get length_m");
if (stRow?.props.length_m != null) throw new Error("length_m must not be mirrored in props");

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

const sql = upsertFeatureSql(parcel("q1", closed));
if (!sql.sql.includes("ON CONFLICT")) throw new Error("upsert sql must be idempotent");
const qsql = queryFeatureSql({ surface: "base", source: "osm" });
if (qsql.args.length !== 2) throw new Error("query sql must bind filters");
if (utmEpsgFromLon(46.7) !== 32638) throw new Error("Riyadh lon must map to UTM 38N");

const edge = deriveStreet({
  ...parcel("edge", closed),
  kind: "street",
  geom: { type: "LineString", coordinates: [[46.6, 24.7], [46.601, 24.7]] },
});
if (!edge || Math.abs((edge.length_m ?? 0) - 101.186) > 0.1) {
  throw new Error(`0.001° edge must be ~101.186 m, got ${edge?.length_m}`);
}

const origin = lonLatToUtm(46.6, 24.7, 32638);
const c1 = utmToLonLat(origin.e, origin.n, 32638);
const c2 = utmToLonLat(origin.e + 100, origin.n, 32638);
const c3 = utmToLonLat(origin.e + 100, origin.n + 100, 32638);
const c4 = utmToLonLat(origin.e, origin.n + 100, 32638);
const ha = deriveParcel({
  ...parcel("ha", {
    type: "Polygon",
    coordinates: [[c1, c2, c3, c4, c1]],
  }),
});
if (!ha || Math.abs((ha.area_m2 ?? 0) - 10000) > 20) {
  throw new Error(`100 m UTM square must be ~10000 m², got ${ha?.area_m2}`);
}

const dictStore = new MemoryStore();
dictStore.putUseDef({ project_id: "p1", key: "villa", label: "villa", min_area_m2: 200 });
const mystery = parcel("mystery", closed);
mystery.use = "no-such-use";
const mysteryOut = await dictStore.apply([{ op: "upsert", feature: mystery }]);
if (isReject(mysteryOut)) throw new Error("missing use key must not fail the row");

const speck: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [[[46.6, 24.7], [46.60001, 24.7], [46.60001, 24.70001], [46.6, 24.70001], [46.6, 24.7]]],
};
const villa = parcel("villa1", speck);
villa.use = "villa";
const villaOut = await dictStore.apply([{ op: "upsert", feature: villa }]);
if (!isReject(villaOut) || villaOut.reason !== "below_min_area") {
  throw new Error("use_defs min_area_m2 must reject undersized villa");
}

const snap = parseStore(serializeStore([parcel("s1", closed)], "memory"));
if (snap.features.length !== 1 || snap.kind !== "planx-store-snapshot") {
  throw new Error("snapshot round-trip");
}
try {
  parseStore("{}");
  throw new Error("bad snapshot must throw");
} catch (e) {
  if (e instanceof Error && e.message === "bad snapshot must throw") throw e;
}
const rt = await bootStore();
if (rt.engine !== "memory") throw new Error("node boot must be memory");

console.log("workbench draft + store checks passed");

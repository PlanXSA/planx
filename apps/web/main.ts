import maplibregl from "maplibre-gl";
import { MemoryStore } from "../../packages/store/memory.ts";
import { bootStore } from "../../packages/store/runtime.ts";
import { parseStore, serializeStore } from "../../packages/store/snapshot.ts";
import type { Store } from "../../packages/store/types.ts";
import { isReject, type Feature } from "../../packages/schema/index.ts";
import { fetchOverpass } from "../../packages/adapters/osm/overpass.ts";
import { addVertex, closeDraft, type Draft } from "../../packages/engines/draft.ts";
import { deriveParcel } from "../../packages/engines/parcel.ts";
import { deriveStreet } from "../../packages/engines/street.ts";
import { lonLatToUtm, utmEpsgFromLon } from "../../packages/geo/crs.ts";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  OPENFREEMAP_STYLE,
  OSM_RASTER_STYLE,
} from "../../packages/maps/basemap.ts";

const PROJECT = "demo-riyadh";
const BBOX = { south: 24.69, west: 46.685, north: 24.71, east: 46.705 };

let store: Store = new MemoryStore();
let engine: "memory" | "duckdb" = "memory";
const statusEl = document.getElementById("status")!;
const rowsEl = document.getElementById("rows")!;
const totalsEl = document.getElementById("totals")!;
const hudLl = document.getElementById("hud-ll")!;
const hudUtm = document.getElementById("hud-utm")!;
const hudDraft = document.getElementById("hud-draft")!;
let draft: Draft | null = null;

const map = new maplibregl.Map({
  container: "map",
  style: OPENFREEMAP_STYLE,
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
});
map.on("error", () => {
  if (!map.getSource("osm")) map.setStyle(OSM_RASTER_STYLE);
});
map.addControl(new maplibregl.NavigationControl(), "top-left");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: "metric" }));

function asFc(features: Feature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      geometry: f.geom,
      properties: {
        id: f.id,
        kind: f.kind,
        use: f.use ?? "",
        source: f.source,
        area_m2: f.area_m2 ?? null,
        length_m: f.length_m ?? null,
        frontage_m: f.frontage_m ?? null,
        label:
          f.kind === "parcel" && f.area_m2 != null
            ? `${f.area_m2.toFixed(0)} م²`
            : f.length_m != null
              ? `${f.length_m.toFixed(1)} م`
              : "",
      },
    })),
  };
}

function ensureLayers(fc: GeoJSON.FeatureCollection) {
  if (map.getSource("planx")) {
    (map.getSource("planx") as maplibregl.GeoJSONSource).setData(fc);
    return;
  }
  if (!map.isStyleLoaded()) return;
  map.addSource("planx", { type: "geojson", data: fc });
  map.addLayer({
    id: "planx-line",
    type: "line",
    source: "planx",
    filter: ["==", "$type", "LineString"],
    paint: { "line-color": "#f97316", "line-width": 3 },
  });
  map.addLayer({
    id: "planx-fill",
    type: "fill",
    source: "planx",
    filter: ["==", "$type", "Polygon"],
    paint: { "fill-color": "#22c55e", "fill-opacity": 0.45 },
  });
  map.addLayer({
    id: "planx-fill-line",
    type: "line",
    source: "planx",
    filter: ["==", "$type", "Polygon"],
    paint: { "line-color": "#15803d", "line-width": 2 },
  });
  map.addLayer({
    id: "planx-pt",
    type: "circle",
    source: "planx",
    filter: ["==", "$type", "Point"],
    paint: { "circle-color": "#2563eb", "circle-radius": 5 },
  });
  map.addLayer({
    id: "planx-label",
    type: "symbol",
    source: "planx",
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
    },
    paint: { "text-color": "#111", "text-halo-color": "#fff", "text-halo-width": 1 },
  });
}

async function refresh() {
  const all = await store.query({ project_id: PROJECT });
  ensureLayers(asFc(all));
  rowsEl.innerHTML = all
    .map((f) => {
      const area = f.area_m2 != null ? Number(f.area_m2).toFixed(1) : "—";
      const front = f.frontage_m != null ? Number(f.frontage_m).toFixed(1) : "—";
      const len = f.length_m != null ? Number(f.length_m).toFixed(1) : "—";
      return `<tr><td>${f.kind}</td><td>${f.use ?? "—"}</td><td>${area}</td><td>${front}</td><td>${len}</td><td>${f.measure_epsg ?? "—"}</td></tr>`;
    })
    .join("");
  const areaSum = all.reduce((s, f) => s + (f.area_m2 ?? 0), 0);
  const lenSum = all.reduce((s, f) => s + (f.length_m ?? 0), 0);
  totalsEl.textContent = `قطع ${areaSum.toFixed(0)} م² · شبكة ${lenSum.toFixed(0)} م · ${all.length} معلم · ${engine}`;
}

function draftPreview(): string {
  if (!draft || draft.vertices.length < 2) return "مسودة —";
  const now = new Date().toISOString();
  const base = {
    id: "draft",
    project_id: PROJECT,
    surface: "project" as const,
    source: "user" as const,
    code_status: "unknown" as const,
    props: {},
    created_at: now,
    updated_at: now,
  };
  if (draft.kind === "parcel" && draft.vertices.length >= 3) {
    const ring = [...draft.vertices, draft.vertices[0]];
    const p = deriveParcel({
      ...base,
      kind: "parcel",
      geom: { type: "Polygon", coordinates: [ring] },
    });
    return p?.area_m2 != null ? `مسودة قطعة ${p.area_m2.toFixed(0)} م² · واجهة ${p.frontage_m?.toFixed(1)} م` : "مسودة —";
  }
  const s = deriveStreet({
    ...base,
    kind: "street",
    geom: { type: "LineString", coordinates: draft.vertices },
  });
  return s?.length_m != null ? `مسودة شارع ${s.length_m.toFixed(1)} م` : "مسودة —";
}

function draftFc(): GeoJSON.FeatureCollection {
  if (!draft || draft.vertices.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }
  const geom: GeoJSON.Geometry =
    draft.vertices.length === 1
      ? { type: "Point", coordinates: draft.vertices[0] }
      : { type: "LineString", coordinates: draft.vertices };
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: geom, properties: {} }],
  };
}

function paintDraft() {
  const src = map.getSource("draft") as maplibregl.GeoJSONSource | undefined;
  const fc = draftFc();
  if (src) src.setData(fc);
  else if (map.isStyleLoaded()) {
    map.addSource("draft", { type: "geojson", data: fc });
    map.addLayer({
      id: "draft-line",
      type: "line",
      source: "draft",
      paint: { "line-color": "#111", "line-width": 2, "line-dasharray": [2, 1] },
    });
    map.addLayer({
      id: "draft-pt",
      type: "circle",
      source: "draft",
      paint: { "circle-color": "#111", "circle-radius": 4 },
    });
  }
  hudDraft.textContent = draftPreview();
}

function writeHud(lng: number, lat: number) {
  const epsg = utmEpsgFromLon(lng);
  const en = lonLatToUtm(lng, lat, epsg);
  hudLl.textContent = `λ ${lng.toFixed(6)}°  φ ${lat.toFixed(6)}°`;
  hudUtm.textContent = `EPSG:${epsg}  E ${en.e.toFixed(2)}  N ${en.n.toFixed(2)}`;
}

map.on("load", () => {
  void refresh();
  paintDraft();
});

map.on("mousemove", (e) => {
  writeHud(e.lngLat.lng, e.lngLat.lat);
});

map.on("click", (e) => {
  if (!draft) return;
  draft = addVertex(draft, e.lngLat.lng, e.lngLat.lat);
  statusEl.textContent = `${draft.kind}: ${draft.vertices.length} رأس`;
  paintDraft();
});

map.on("dblclick", async (e) => {
  if (!draft) return;
  e.preventDefault();
  const feat = closeDraft(draft, PROJECT);
  draft = null;
  map.doubleClickZoom.enable();
  paintDraft();
  document.querySelectorAll("#tools button").forEach((b) => b.classList.remove("active"));
  if (!feat) {
    statusEl.textContent = "المسودة ناقصة";
    return;
  }
  const out = await store.apply([{ op: "upsert", feature: feat }]);
  if (isReject(out)) {
    statusEl.textContent = out.message;
    return;
  }
  const saved = await store.get(feat.id);
  const metres =
    saved?.kind === "parcel" && saved.area_m2 != null
      ? ` · ${saved.area_m2.toFixed(0)} م²`
      : saved?.length_m != null
        ? ` · ${saved.length_m.toFixed(1)} م`
        : "";
  statusEl.textContent = `كُتب الصف في المخزن${metres}`;
  await refresh();
});

function arm(kind: Draft["kind"], btn: HTMLElement) {
  draft = { kind, vertices: [] };
  map.doubleClickZoom.disable();
  document.querySelectorAll("#tools button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  statusEl.textContent = kind === "parcel" ? "انقر رؤوس القطعة" : "انقر محور الشارع";
}

document.getElementById("draw-parcel")!.addEventListener("click", (e) => {
  arm("parcel", e.currentTarget as HTMLElement);
});
document.getElementById("draw-street")!.addEventListener("click", (e) => {
  arm("street", e.currentTarget as HTMLElement);
});
document.getElementById("cancel")!.addEventListener("click", () => {
  draft = null;
  map.doubleClickZoom.enable();
  paintDraft();
  document.querySelectorAll("#tools button").forEach((b) => b.classList.remove("active"));
  statusEl.textContent = "أُلغيت المسودة";
});
document.getElementById("import")!.addEventListener("click", async () => {
  statusEl.textContent = "جلب المربع…";
  try {
    const feats = await fetchOverpass(BBOX, PROJECT);
    for (const f of feats) await store.put(f);
    statusEl.textContent = `قاعدة: ${feats.length} معلم`;
    await refresh();
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : "فشل الجلب";
  }
});

document.getElementById("save")!.addEventListener("click", async () => {
  const rows = await store.query({ project_id: PROJECT });
  const blob = new Blob([serializeStore(rows, engine)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "planx-store.json";
  a.click();
  statusEl.textContent = `حُفظت لقطة ${rows.length} معلم (${engine})`;
});

document.getElementById("csv")!.addEventListener("click", async () => {
  const rows = await store.query({ project_id: PROJECT });
  const header = "id,kind,use,source,area_m2,frontage_m,length_m,measure_epsg";
  const body = rows
    .map(
      (f) =>
        [f.id, f.kind, f.use ?? "", f.source, f.area_m2 ?? "", f.frontage_m ?? "", f.length_m ?? "", f.measure_epsg ?? ""].join(","),
    )
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv" }));
  a.download = "planx-schedule.csv";
  a.click();
  statusEl.textContent = `صُدّر جدول ${rows.length} صف`;
});

document.getElementById("open")!.addEventListener("click", () => {
  document.getElementById("open-file")!.click();
});

document.getElementById("open-file")!.addEventListener("change", async (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const snap = parseStore(await file.text());
    store = new MemoryStore();
    engine = "memory";
    for (const f of snap.features) await store.put(f);
    statusEl.textContent = `فُتحت لقطة ${snap.features.length} معلم`;
    await refresh();
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : "ملف غير صالح";
  }
});

document.querySelectorAll<HTMLInputElement>("#tools input[data-layer]").forEach((box) => {
  box.addEventListener("change", () => {
    const id = box.dataset.layer;
    if (!id || !map.getLayer(id)) return;
    map.setLayoutProperty(id, "visibility", box.checked ? "visible" : "none");
    if (id === "planx-fill" && map.getLayer("planx-fill-line")) {
      const fillOn = (document.querySelector('[data-layer="planx-fill"]') as HTMLInputElement).checked;
      const edgeBox = document.querySelector('[data-layer="planx-fill-line"]') as HTMLInputElement;
      if (!fillOn) {
        /* keep independent */
      }
      void edgeBox;
    }
  });
});

void bootStore().then((rt) => {
  store = rt.store;
  engine = rt.engine;
  statusEl.textContent = rt.note;
});

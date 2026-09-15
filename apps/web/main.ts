import maplibregl from "maplibre-gl";
import { MemoryStore } from "../../packages/store/memory.ts";
import { isReject, type Feature } from "../../packages/schema/index.ts";
import { fetchOverpass } from "../../packages/adapters/osm/overpass.ts";
import { addVertex, closeDraft, type Draft } from "../../packages/engines/draft.ts";

const PROJECT = "demo-riyadh";
const BBOX = { south: 24.68, west: 46.67, north: 24.72, east: 46.72 };

const store = new MemoryStore();
const statusEl = document.getElementById("status")!;
const rowsEl = document.getElementById("rows")!;
let draft: Draft | null = null;

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  },
  center: [46.695, 24.7],
  zoom: 14,
});
map.addControl(new maplibregl.NavigationControl(), "top-left");

function asFc(features: Feature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      geometry: f.geom,
      properties: { id: f.id, kind: f.kind, source: f.source },
    })),
  };
}

async function refresh() {
  const all = await store.query({ project_id: PROJECT });
  const src = map.getSource("planx") as maplibregl.GeoJSONSource | undefined;
  const fc = asFc(all);
  if (src) src.setData(fc);
  else if (map.isStyleLoaded()) {
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
      paint: { "fill-color": "#22c55e", "fill-opacity": 0.3 },
    });
    map.addLayer({
      id: "planx-pt",
      type: "circle",
      source: "planx",
      filter: ["==", "$type", "Point"],
      paint: { "circle-color": "#2563eb", "circle-radius": 5 },
    });
  }
  rowsEl.innerHTML = all
    .map((f) => {
      const area = f.props.area_m2 != null ? Number(f.props.area_m2).toFixed(0) : "—";
      const len = f.props.length_m != null ? Number(f.props.length_m).toFixed(0) : "—";
      return `<tr><td>${f.kind}</td><td>${f.source}</td><td>${area}</td><td>${len}</td></tr>`;
    })
    .join("");
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
}

map.on("load", () => {
  void refresh();
  paintDraft();
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
  statusEl.textContent = "أُغلقت القطعة وبُني الجدول";
  await refresh();
});

function arm(kind: Draft["kind"], btn: HTMLElement) {
  draft = { kind, vertices: [] };
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

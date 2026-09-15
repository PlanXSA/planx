/** Free vector style. No API key. Attribution required on the map. */
export const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

export const OSM_RASTER_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export const DEFAULT_CENTER: [number, number] = [46.695, 24.7];
export const DEFAULT_ZOOM = 14;

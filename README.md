# Plan X

Open-source spatial workbench for urban planning. Drawing writes store rows. Tables read those rows. Not CAD, not BIM, not ArcGIS Pro.

## Now

- MapLibre + OpenFreeMap (OSM raster fallback)
- Store: MemoryStore or DuckDB-WASM Spatial in the browser
- Metres: WGS84 → project UTM (`packages/geo/crs.ts`), columns `length_m` / `area_m2` / `frontage_m`
- `apply` is atomic: topology → measures → commit or nothing
- `use_defs` is an open dictionary; missing key does not fail the row
- Save/open JSON snapshot; CSV from stored columns
- OSM Overpass import (bbox ~0.02°); buildings are not parcels

## Run

```bash
npm install
npm run check
npm run dev
```

Workbench: `http://localhost:5173`

Node never instantiates WASM. If Spatial fails in the browser, MemoryStore stays and the status bar says so.

## Docs

| File | Role |
|---|---|
| `CHANGELOG.md` | تفاصيل التعديلات في الملفات والكود |
| `ARCHITECTURE.md` | Locks and slices |
| `docs-measures.md` | Metre contract |
| `docs-model.md` | Data model vs ArcGIS mechanism |
| `docs-duckdb-wasm.md` | WASM Spatial boot |
| `docs-expert-review-20260916.md` | Last expert pass |

## GitHub

https://github.com/PlanXSA/planx — push after a slice is accepted. Connector writes are 403 until scopes are fixed.

## License

MIT intended, not activated.

# Plan X — DuckDB-WASM Spatial

Date: 2026-09-16.

## What boots

In the browser `bootStore()` now:

1. Loads `@duckdb/duckdb-wasm` from the package / jsDelivr bundle.
2. Spawns the worker and instantiates the WASM module.
3. `INSTALL spatial; LOAD spatial;`
4. Probes `ST_Point` / `ST_AsGeoJSON` / `ST_SetSRID`.
5. Applies `packages/store/schema-sql.ts` (same tables as `sql/schema.sql`, UUID as VARCHAR, no CHECK SRID so GeoJSON insert can set SRID in SQL).
6. Hands `DuckStore` the same `Store` API as `MemoryStore`.

If any step throws: MemoryStore + the failure text in the status bar. Node/`npm run check` never instantiates WASM.

## What Spatial does vs TypeScript

| Job | Where |
|---|---|
| Length, area, frontage | TypeScript UTM in `applyMeasures` |
| Persist geometry + metre columns | DuckDB `features` |
| Clip / intersect | `ST_Intersects` in `DuckStore.slice` |
| Idempotent OSM put | `DELETE … source_ref` then upsert |

Do not compute planner metres with `ST_Area` on 4326.

## Limits

- No OPFS. Save remains JSON snapshot download/upload.
- Spatial extension is fetched at `LOAD` time from DuckDB’s extension CDN; offline first paint may fall back to memory.
- `coi` / SharedArrayBuffer not required for the default bundle.
- WASM schema omits RTREE if the index type is missing; column indexes stay.

## Files

- `packages/store/wasm.ts` — instantiate + exec
- `packages/store/duck.ts` — Store over SQL
- `packages/store/schema-sql.ts` — DDL string
- `packages/store/runtime.ts` — public boot

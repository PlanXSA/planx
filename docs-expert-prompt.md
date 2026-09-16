# Plan X — expert review prompt

Copy everything below the line into a new chat with a senior reviewer. Do not add product pitches. Do not treat this as a greenfield brief.

---

You are a senior geospatial systems engineer and cadastral / urban-planning data-model reviewer. You are reviewing **Plan X**, an existing open-source nucleus, not inventing a new product.

Plan X is a single-user spatial workbench for a planner (Ahmed). He sets a project boundary, imports stock (OSM today), draws streets and parcels, assigns land use as a column, and gets metric tables from the same store rows. Drawing must create the table. It is not CAD, not BIM, not ArcGIS Pro.

## Binding constraints (do not relax)

- Open-source stack only. No paid basemap. No PostGIS in v0.
- Runtime: TypeScript + SQL DDL + HTML/CSS. Vite + MapLibre in a real browser. DuckDB-WASM on `sql/schema.sql`. Save is file download/upload only. No OPFS.
- One user in v0. No login server. No multi-user locking. Project identity is local columns on `projects` (title, planner, org, city).
- Store and exchange: EPSG:4326. Map tiles: EPSG:3857. Metres: project UTM from boundary centroid (`projects.utm_epsg`). Never compute length or area from Web Mercator tiles.
- One `features` table. `kind` discriminates geometry role (`street|parcel|amenity|path|green|utility|other`). `use` is an open column plus `use_defs` dictionary Ahmed can extend. Not a closed land-use enum.
- Surfaces: `base` (import), `project` (user + engines), `snapshot` (frozen). Re-import must not delete `source=user`. OSM/user overlap is a visible `conflicts` row, not a silent overwrite.
- Write path for drawing: topology → geometry write → metric derive → atomic `apply`. Failure of any step writes nothing. Adapters use `put` only.
- Metres live on feature columns: `length_m`, `area_m2`, `frontage_m`, plus `measure_epsg` and `measure_at`. Engines also keep detail in `props` JSON. UI must read stored numbers.
- Borrow ArcGIS Pro **mechanism** (shared CRS dataset, topology rules, attribute rules, error inspector) not the **product** (enterprise GDB, versioning, parcel fabric points/lines/COGO/records/adjustment, utility network, rasters, scenes).
- Out of v0: 3D massing, Balady without a written contract, multi-user, PostGIS, paid tiles, OPFS, street section solids, legal parcel fabric.

Owner does not write code. Review in English. Output one markdown file, not chat. Hard cap: 1,200 words. Section 6 is exactly five tasks — no sub-tasks that are secret extras.

## What exists now (audit this, do not assume it is finished)

- `sql/schema.sql`: `projects`, `features` (with measure columns), `conflicts`, `use_defs`.
- `MemoryStore.apply` runs topology then `applyMeasures` then commit; unclosed parcel rejects the whole batch.
- `packages/engines/measure.ts` stamps row columns after calling `parcel.ts` and `street.ts`. Those two still use a local equirectangular stand-in at ~lat 24.7 (Riyadh). `measure_epsg = 0` until UTM projection is wired.
- Frontage v0 = longest edge, flagged `frontage_estimated`.
- Default reject `below_min_area` at 1 m² until `use_defs.min_area_m2` is read on apply.
- Slice 1c still open: prove MapLibre + DuckDB-WASM + file save in a browser. Overpass in browser has failed with 504 in a prior session.
- DuckDB Spatial functions are in DDL; engines still compute metres in TypeScript.

## Required deliverable structure

Produce one markdown file with these numbered sections only:

1. **Defects** — defects in the measure contract, schema, and apply pipeline only. No style nits. Each defect: location, why it breaks a planner number, cheapest fix.
2. **UTM path** — cheapest way to replace the local metre stand-in with `projects.utm_epsg` without changing column names. For a test edge from (46.6000, 24.7000) to (46.6010, 24.7000) and a 100 m × 100 m square parcel near that point: show the arithmetic for (a) current stand-in length/area, (b) UTM zone 38N / EPSG:32638 length/area, (c) absolute and relative error. Do not assert a tolerance without those numbers.
3. **Topology subset** — which ArcGIS-style rules must run inside `apply` in v0 vs which belong in a later validate pass (dangles, boundary-covered-by-lines, points-on-endpoints). Do not recommend standing up parcel fabric feature classes.
4. **use_defs** — how `min_area_m2` and missing keys should behave on apply. Absence of a key must not fail the row.
5. **Store API** — whether measure columns belong only on `Feature` or also need a SQL view for the schedule board. Keep one source of truth.
6. **Next five tasks** — ranked by output per hour for a coder who is not the owner. Exactly five. Each: outcome, files touched, test that proves it. Slice 1c (MapLibre + DuckDB-WASM + file save in a browser; Overpass 504 still open) may be one of the five if it beats measure/UTM work on output per hour; it is not a defect in section 1.
7. **CHANGE log** — any lock you would change. Format: `CHANGE` + one sentence + risk if ignored. If you would change nothing, say so.
8. **Forbidden** — explicitly list advice you considered and rejected (Pro clone, PostGIS, accounts, 3D, learning engine, OPFS).

Do not add Balady integration, BIM, multiplayer, or a new CRS for tiles. Do not rewrite the product pitch. Mark uncertainty rather than inventing Esri-scale schema.

# Plan X expert review — 2026-09-16

Reviewer role: geospatial systems / cadastral data model. Scope: measure contract, schema, apply. Not a product rewrite.

## 1. Defects

**D1 — Area shoelace uses absolute lon as metres.**  
`packages/engines/parcel.ts` scales `lon * 111320 * cos(lat)` without subtracting a local origin. Length of a short edge is fine; closed-polygon area is not. A square sized as 100 m × 100 m in the same stand-in is stored as ~10 708 m² instead of ~10 000 m². Planner boards would publish inflated hectare figures.  
Fix: project vertices to a local metre plane (UTM or origin-at-first-vertex) then shoelace. Do not keep the current area loop after UTM lands.

**D2 — `measure_epsg = 0` is a silent lie.**  
`measure.ts` writes 0 while numbers are equirectangular, not “unknown CRS.” A later SQL path that trusts EPSG 0 will not match UTM rows.  
Fix: use `NULL` until UTM is applied; then write `projects.utm_epsg`.

**D3 — `belowMinArea` never reads `use_defs`.**  
Default 1 m² is hardcoded. Ahmed’s dictionary cannot raise the floor per use. A 50 m² “villa” rule would not reject.  
Fix: `apply` looks up `use_defs.min_area_m2` by `(project_id, use)`; missing key → default 1 m²; do not reject for unknown use.

**D4 — Duplicate truth in `props` and columns.**  
`applyMeasures` copies `area_m2` into both places. UI or a future DuckDB query can diverge if only one is updated.  
Fix: columns are canonical; `props` keeps vertices/edges/`frontage_estimated` only.

**D5 — Topology does not reject degenerate streets.**  
`topology()` only inspects parcels. A one-point or zero-length line still commits `length_m` undefined or 0.  
Fix: reject street/path with `< 2` vertices or `length_m < ε` (e.g. 0.05 m) inside the same apply snapshot.

## 2. UTM path

Keep column names. In `applyMeasures`, if `projects.utm_epsg` is set, project each vertex with a 10-line WGS84→UTM (zone from `utmEpsgFromLon`) then length/area in that plane. Write that EPSG into `measure_epsg`. Fallback: current stand-in + `measure_epsg NULL`.

Zone at lon 46.6 is 38 → EPSG:32638.

Constants: `M = 111320`, `φ = 24.7°`, `cos φ = 0.908508`.

**(a) Stand-in**  
Edge (46.6000, 24.7000)→(46.6010, 24.7000):  
`Δλ = 0.001°` → `L = 0.001 × 111320 × 0.908508 = 101.135 m`.

Intended 100 m × 100 m square: `Δλ = 100 / (111320 × 0.908508) = 0.00098878°`, `Δφ = 100 / 111320 = 0.00089831°`.  
Current shoelace on that ring: **10 708 m²** (formula defect, not ellipsoid).

**(b) UTM 38N**  
Same edge projected: **101.186 m**.  
Same degree-square projected: **9 955 m²** (the ring is ~101.2 m east × ~99.9 m north, not a true 100 m square).

**(c) Error stand-in vs UTM on the 0.001° edge**  
Length: −0.051 m (−0.050%). Acceptable for v0 streets.  
Area on that ring: +753 m² (+7.6%) — **not** acceptable; almost all of this is D1, not ellipsoid vs UTM.

Tolerance after D1+UTM: expect length error ≪ 0.1% and area error ≪ 0.2% versus a geodesic/UTM reference on ≤ 0.02° demo bbox. Do not publish area until D1 is gone.

## 3. Topology subset

**Inside `apply` (v0):** polygon closed; no self-intersection; parcel–parcel overlap on `project` → reject or `conflicts` row (pick one and keep it); street ≥ 2 vertices; `below_min_area` after measures.

**Later validate pass:** Must Not Have Dangles; polygon boundary covered by lines; line endpoints covered by points. Those need a line/node layer Plan X does not store yet. Do not add parcel-fabric feature classes. Derive edges in `props` only.

Overlap with `base` OSM: conflict row, never delete `source=user`.

## 4. use_defs

Lookup is soft. Unknown `use` → row writes, `code_status = unknown`, min area = 1 m². Known key with `min_area_m2` → that floor. `NULL` min on a known key → 1 m². Never fail apply because the dictionary lacks the key. Ahmed can add the key later and re-run a check engine; do not rewrite history in v0.

## 5. Store API

Canonical metres are `Feature.length_m | area_m2 | frontage_m`. No second store. A SQL view `schedule_v` (`kind, use, length_m, area_m2, frontage_m` filtered by project+surface) is allowed as a read alias for the board. The view must not recompute geometry. MemoryStore already returns the columns; DuckDB upsert already writes them.

## 6. Next five tasks

1. **Fix area plane + UTM stamp** — `parcel.ts`, `street.ts`, `measure.ts`, `crs.ts`. Test: 0.001° edge length within 0.1 m of 101.186; 100 m UTM square area within 20 m² of 10 000.  
2. **`use_defs` on apply** — `memory.ts` + tiny dict API. Test: missing key writes; `min_area_m2 = 200` rejects a 50 m² parcel.  
3. **Columns-only props** — stop mirroring area into `props`; update `check.mts`. Test: `row.area_m2` set, `props.area_m2` absent.  
4. **Slice 1c browser proof** — MapLibre + DuckDB-WASM schema + download/upload; banner if WASM dies. Test: manual on owner machine; Overpass 504 is a timeout/retry, not a store rewrite. Higher output per hour than fabric work; sits here not in §1.  
5. **UI reads stored metres** — `apps/web`. Test: drawn parcel label equals `area_m2` from `get()`, not a screen measure.

## 7. CHANGE log

CHANGE: treat `measure_epsg = 0` as invalid; use NULL until UTM. Risk if ignored: mixed files with two meanings of zero.

No other lock change. One features table, file save, no PostGIS, no accounts stay.

## 8. Forbidden (considered, rejected)

- Clone ArcGIS Parcel Fabric (points, COGO lines, records, adjustment).  
- Move v0 store to PostGIS.  
- Login / cloud identity.  
- 3D massing / BIM.  
- “Learning” engine for use classification.  
- OPFS as the save path.  
- Measuring in EPSG:3857.  
- Splitting `kind` into physical feature classes.  
- Legal survey accuracy claims before D1 is fixed.

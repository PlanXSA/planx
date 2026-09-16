# Plan X — architecture (v0 nucleus)

```
adapters → store ←→ engines → app
```

- Adapters write stock only (`put`).
- Draw goes topology then `apply`. Never a lone write that skips the chain.
- Engines stamp metre columns. App reads `Store.query` only for numbers.

## Surfaces

| surface   | who writes        | rule                                      |
|-----------|-------------------|-------------------------------------------|
| base      | adapters          | replaceable if `source != user`           |
| project   | Ahmed / engines   | never silent-delete                       |
| snapshot  | freeze            | read-only copy                            |

## CRS

| job                         | system        |
|-----------------------------|---------------|
| store + exchange            | EPSG:4326     |
| map tiles                   | EPSG:3857     |
| length, area, frontage      | UTM per first vertex / project (`measure_epsg`) |

## Slice map

| slice | contents | status |
|-------|----------|--------|
| 1 | types, DDL, MemoryStore, atomic apply | done |
| 1b | Overpass parser + workbench shell | done in source; Overpass 504 still possible in browser |
| 1c | MapLibre in browser; DuckDB-WASM Spatial boot; JSON save/open; MemoryStore fallback | wired 2026-09-16; browser Spatial depends on extension CDN |
| 1d | UTM metres on columns; use_defs soft min area; UI reads stored numbers; layer HUD; CSV | done |
| 2 | street ROW / frontage snap | later |
| 3 | codepack on use | later |
| 4 | GeoJSON / GPKG export | CSV done; GeoJSON later |

تفاصيل التعديلات: `CHANGELOG.md`.

Locks: bbox demo ~0.02°; WASM failure keeps MemoryStore + banner; OSM/user overlap is visible; save is download/upload, no OPFS; `measure_epsg` is a real UTM code, never 0.

Out of v0: massing 3D, Balady without a contract, multi-user, PostGIS, paid basemap, OPFS, street section geometry, parcel fabric classes.

## Layout

```
planx/
  sql/schema.sql
  packages/schema/
  packages/geo/crs.ts
  packages/store/     memory, duck, wasm, snapshot
  packages/engines/   draft, parcel, street, measure
  packages/adapters/osm/
  packages/maps/
  apps/web/
```

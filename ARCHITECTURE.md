# Plan X — architecture (v0 nucleus)

```
adapters → store ←→ engines → app
```

- Adapters write stock only (`put`).
- Draw goes topology then `apply`. Never a lone write that skips the chain.
- Engines return `Patch[]` or `Reject`.
- App talks to `Store.query` and `Engine.run` only.

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
| length, area, frontage, ROW | UTM per project centroid |

## Slice map

| slice | contents                                      | status      |
|-------|-----------------------------------------------|-------------|
| 1     | types, DuckDB DDL, MemoryStore, atomic apply  | done        |
| 1b    | Overpass + MapLibre workbench                 | done        |
| 1c    | DuckDB SQL contract + OpenFreeMap + CRS helper| in progress |
| 2     | street ROW / frontage snap                    | later       |
| 3     | use column + area table + min code            | later       |
| 4     | GeoJSON / CSV export                          | later       |

Out of v0: massing 3D, Balady without a contract, multi-user, PostGIS, paid basemap.

## Repo layout

```
planx/
  sql/schema.sql
  packages/schema/
  packages/store/
  packages/adapters/osm/     # tag map + Overpass
  packages/engines/parcel.ts
  apps/web/                  # MapLibre read + import button
  ARCHITECTURE.md
```

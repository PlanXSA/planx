# Plan X — phase report and expert pack
Date: 2026-09-15. Owner: PlanXSA. Repo: https://github.com/PlanXSA/planx
Local: artifacts/planx. Open-source only. Owner does not write code.
Grok GitHub connector: read OK, write 403 (no contents:write).

## Product
Spatial workbench for planner Ahmed. Boundary, import stock, draw streets/parcels, set use as a column, tables and boards from the same store rows. Drawing creates the table. Not CAD, not BIM. Massing deferred.

## Locks
MapLibre + PMTiles + Terra Draw + DuckDB Spatial later + Vite/TS. No PostGIS, no paid tiles.
features table, surfaces base/project/snapshot. use is a column. put=import, apply=draw atomic.
OSM: streets + listed amenities; buildings/landuse are not parcels; place=plot may be.
Re-import never deletes source=user. Store 4326, tiles 3857, metres from project UTM/local plane.
Metrics first in TypeScript on apply() (expert A). v0 one user.

## Built and tested
schema.sql, packages/schema, MemoryStore apply atomic, osm tag map, check.mts.
GREEN: closed parcel writes; open rejects and writes nothing; residential=street; building≠parcel; plot=parcel.
NOT built: Overpass, MapLibre UI, DuckDB runtime, derive on apply file, analysis, export.
Nucleus ~18% of seven foundations.

## Phases
0 Contract — done enough.
1 Store at volume — MemoryStore now, DuckDB behind same Store API; query by project+surface+bbox; clip then OSM; index.
2 Draw to table — Terra Draw later; topology; apply fills area/sides; frontage=longest edge stand-in.
3 Map shell — MapLibre, one overlay from query, tools rail, no measure in style.
4 Analysis — schedule by use, street length, conflicts. Boards=filters.
5 Export GeoJSON/CSV + snapshot. DXF out.
Deferred: 3D, Balady without contract, multi-user, curved ROW lock.

## Codes
Feature kind: street|parcel|amenity|path|green|utility|other.
Source: osm|balady|planx|user. Surface: base|project|snapshot.
Store: put, get, query, slice, apply(patches)->Patch[]|Reject.
apply: topology then write then derive or rollback all.
DDL: projects + features PK (surface,id) + conflicts + RTREE on geom SRID 4326.
OSM map conservative as above.

## Expert prompt
You are a senior geospatial systems engineer reviewing Plan X, not a new product.
Constraints binding: OSS, no budget, single user, Feature store, use column, no building-parcels, atomic apply, no Web Mercator metres.
In one markdown file: (1) audit phases 1-3 defects only (2) cheapest MemoryStore to DuckDB path keeping apply tests (3) bbox Overpass outline, idempotent put by source_ref (4) confirm TS metrics + tolerances at lat 24.7 (5) four UI regions + minimum MapLibre/Terra Draw events to apply (6) rank next 5 tasks by output per hour (7) no Balady/3D/multiplayer/PostGIS/learning engine (8) mark any lock change as CHANGE + one-sentence risk.
English. File not chat.

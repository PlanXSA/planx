# Plan X — Copilot instructions

Owner does not write code. Every change must stay inside the current slice and the locks below.

## What this is

Spatial workbench for one planner (Ahmed). Drawing creates the table. Not CAD, not BIM. Massing is deferred.

## Locks — do not change without CHANGE + one-sentence risk

- OSS only. No PostGIS. No paid tiles. No Balady without a contract. No multi-user in v0.
- Stack: TypeScript, Vite, MapLibre, PMTiles, Terra Draw later, DuckDB Spatial later.
- `use` is a column. Uses are not a closed list; Ahmed can create types and rules.
- Store CRS 4326. Tiles 3857. Length/area/frontage/ROW in project UTM / local plane. Never Web Mercator metres.
- Surfaces: `base` (adapters, replaceable if source != user), `project` (never silent-delete), `snapshot` (read-only freeze).
- Feature kind: `street | parcel | amenity | path | green | utility | other`.
- Source: `osm | balady | planx | user`.
- Store API: `put`, `get`, `query`, `slice`, `apply(patches) -> Patch[] | Reject`.
- `put` = import stock. `apply` = draw path: topology then write then derive, or rollback all.
- OSM: streets + listed amenities. Buildings and landuse are not parcels. `place=plot` may be a parcel.
- Re-import never deletes `source=user`.
- Metrics first in TypeScript on `apply`. v0 is one user.

## How to verify

```bash
npm install
npm test

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

## Layout

```
sql/schema.sql
packages/schema/
packages/store/          MemoryStore now; DuckDB behind the same Store API later
packages/adapters/osm/   tag map only in slice 1
packages/engines/        empty until slice 2
scripts/check.mts        zero-dep contract check
```

## How to verify

```bash
npm install
npm test
npm run typecheck
```

If `scripts/check.mts` exists: `node --experimental-strip-types scripts/check.mts`

Do not merge if tests fail. Do not weaken an existing test to make a change pass.

## How to change code

- One slice per PR. Title = slice intent, not a file list.
- Keep `apply` atomic. An open parcel must write nothing.
- Do not treat OSM buildings as parcels.
- Do not invent product features (3D, multiplayer, PostGIS, learning engine).
- Prefer extending MemoryStore tests over rewriting the store.
- Parcel/street attribute tables come from drawing, not from typed forms.

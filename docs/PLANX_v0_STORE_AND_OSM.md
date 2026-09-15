# Plan X v0 — DuckDB store and OSM feed

Canonical merge of two external reviews against the locked brief. Stack is not reopened.

---

## Verdict on the two reviews

| Topic | Expert 1 | Expert 2 | Decision |
|---|---|---|---|
| Tables + RTREE + `conflicts` | Adopt | Adopt | Adopt |
| `CHECK` SRID 4326, PK `(surface, id)` | — | Adopt | Adopt |
| `row_geom` column + index | — | Adopt | Adopt (streets only) |
| Import via `put`, draw via `apply` | Used `apply` for import | Adopt `put` for import | Adopt expert 2 |
| Re-clip delete key | `source != user` | `surface=base AND source=osm` | Adopt expert 2 |
| Incoming OSM that overlaps a user draw | Hold back from `base` | Write to `base`, record `Conflict` | Write to `base`, never touch user |
| `highway=*` → street | Too wide | Closed list | Adopt expert 2 list |
| `building` / `landuse` → parcel | Reject | Reject buildings | No building/landuse as parcel |
| `place=plot` → parcel | — | Adopt if present | Adopt |
| green / path / utility tags | Useful narrow map | Left as Gap | Adopt expert 1 narrow map only |
| Default `width_m` from OSM | Correctly refused | Implicit | Stay Gap |
| Overpass URL | Silent | Gap | Pin Overpass as the adapter; URL is an implementation pin |

---

## 1. DuckDB DDL

```sql
INSTALL spatial;
LOAD spatial;

CREATE TABLE projects (
  id           UUID PRIMARY KEY,
  boundary     GEOMETRY NOT NULL,
  phase        VARCHAR NOT NULL,
  codepack_id  UUID,
  utm_epsg     INTEGER,
  created_at   TIMESTAMP NOT NULL,
  updated_at   TIMESTAMP NOT NULL,
  CHECK (ST_SRID(boundary) = 4326),
  CHECK (ST_GeometryType(boundary) IN ('POLYGON', 'MULTIPOLYGON'))
);

CREATE TABLE features (
  id           UUID NOT NULL,
  project_id   UUID NOT NULL,
  surface      VARCHAR NOT NULL,
  geom         GEOMETRY NOT NULL,
  kind         VARCHAR NOT NULL,
  use          VARCHAR,
  source       VARCHAR NOT NULL,
  source_ref   VARCHAR,
  confidence   DOUBLE,
  code_status  VARCHAR NOT NULL DEFAULT 'unknown',
  props        JSON NOT NULL DEFAULT '{}',
  row_geom     GEOMETRY,
  created_at   TIMESTAMP NOT NULL,
  updated_at   TIMESTAMP NOT NULL,
  PRIMARY KEY (surface, id),
  CHECK (surface IN ('base', 'project', 'snapshot')),
  CHECK (kind IN ('street','parcel','amenity','path','green','utility','other')),
  CHECK (source IN ('osm','balady','planx','user')),
  CHECK (code_status IN ('ok','violate','unknown')),
  CHECK (ST_SRID(geom) = 4326),
  CHECK (row_geom IS NULL OR ST_SRID(row_geom) = 4326)
);

CREATE INDEX features_project_idx     ON features (project_id);
CREATE INDEX features_surface_idx     ON features (surface);
CREATE INDEX features_kind_idx        ON features (kind);
CREATE INDEX features_source_idx      ON features (source);
CREATE INDEX features_source_ref_idx  ON features (source_ref);
CREATE INDEX features_geom_rtree      ON features USING RTREE (geom);
CREATE INDEX features_row_geom_rtree  ON features USING RTREE (row_geom);

CREATE TABLE conflicts (
  id           UUID PRIMARY KEY,
  project_id   UUID NOT NULL,
  feature_ids  UUID[] NOT NULL,
  field        VARCHAR NOT NULL,
  values       JSON,
  winner       UUID,
  created_at   TIMESTAMP NOT NULL
);

CREATE INDEX conflicts_project_idx ON conflicts (project_id);
```

Rules:

- `surface` = storage plane. `source` = provenance. A user drawing is `source='user'` (normally on `surface='project'`).
- `Vertex` / `Edge` / `Neighbor` stay in `props` JSON. Not separate tables.
- `row_geom` is filled later by `street_row`, never by the OSM adapter.

---

## 2. Create-and-feed sequence

```
1. Create planx.duckdb
2. INSTALL spatial; LOAD spatial;
3. Run DDL
4. INSERT project (boundary EPSG:4326, phase='select')
5. utm_epsg = UTM zone of ST_Centroid(boundary)  -- KSA 36N–39N
6. osmAdapter.fetch(boundary) → Feature[]
     surface='base', source='osm', code_status='unknown'
7. Conscious import: Store.put each row onto base
     (not the draw apply pipeline)
8. store.slice(boundary, 'base')
     WHERE surface='base' AND ST_Intersects(geom, boundary)
```

`put` is the only writer for `base`.  
`apply` is reserved for user draw: topology → write → derive in one transaction.

`slice` in v0 uses intersection test, not a forced cut of every geom.  
**Gap:** per-kind clip of features that cross the boundary (point vs line vs polygon).

Do not persist Turf measurements.

---

## 3. OSM adapter

```ts
interface OsmAdapter {
  fetch(boundary: GeoJSON.Polygon): Promise<Feature[]>;
}
```

`source_ref`: `node/<id>` | `way/<id>` | `relation/<id>`.

Provider: Overpass API (implementation pin, not a product decision).  
**Gap:** exact instance URL and timeout policy.

### Tag map (closed)

| OSM | `kind` | Notes |
|---|---|---|
| `highway` in `motorway`,`trunk`,`primary`,`secondary`,`tertiary`,`unclassified`,`residential`,`service` | `street` | Centerline only. No `row_geom`. No invented `width_m` |
| `place=plot` (closed) | `parcel` | Only explicit plot/parcel semantics |
| `amenity=*` | `amenity` | OSM value stored in `props.osm_amenity`. No new FeatureKind |
| `highway` in `footway`,`path`,`cycleway` | `path` | |
| `leisure=park` or `landuse` in `grass`,`recreation_ground` | `green` | |
| `power=*` or `man_made` in `pipeline`,`wastewater_plant` | `utility` | Narrow set only |

### Skip

- `highway=proposed`, `highway=construction`
- Building footprints as parcels
- Generic `landuse=*` as parcels
- Administrative boundaries, place labels, benches, metadata-only objects
- Invalid or empty geometry after read

The adapter does not classify land use for Plan X. `use` stays empty on import.

---

## 4. Re-clip

```
refresh OSM for current boundary
DELETE FROM features
  WHERE project_id = :pid
    AND surface = 'base'
    AND source = 'osm';
INSERT refreshed OSM rows onto base
INSERT conflicts for ST_Intersects(base.osm, project.user)
source=user rows are never in the DELETE
winner stays NULL
```

```sql
BEGIN;

DELETE FROM features
WHERE project_id = :pid
  AND surface = 'base'
  AND source = 'osm';

-- insert staged OSM rows onto base here

INSERT INTO conflicts (id, project_id, feature_ids, field, values, created_at)
SELECT
  uuid(),
  :pid,
  [b.id, u.id],
  'geom',
  json_object('base', ST_AsGeoJSON(b.geom), 'user', ST_AsGeoJSON(u.geom)),
  now()
FROM features b
JOIN features u
  ON u.project_id = b.project_id
 AND u.surface = 'project'
 AND u.source = 'user'
WHERE b.project_id = :pid
  AND b.surface = 'base'
  AND b.source = 'osm'
  AND ST_Intersects(b.geom, u.geom);

COMMIT;
```

Official source, when a contract exists, beats OSM. That adapter is not specified here.

---

## 5. Gaps that stay gaps

- Default `width_m` for OSM streets without `width`
- OSM confidence formula
- Exhaustive amenity allowlist
- Overpass URL / timeout
- Per-kind clip on boundary-crossing geoms
- Auto-fill of `conflicts.winner`
- Balady / GEOSA contract
- DuckDB version pin (do at implementation)

---

## 6. What this file is for

Slice 1: empty DuckDB + DDL + `put`/`slice` + OSM `fetch` into `base`.  
Draw / `apply` / derive stay on slice 2.

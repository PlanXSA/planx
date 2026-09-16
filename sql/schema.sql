INSTALL spatial;
LOAD spatial;

CREATE TABLE projects (
  id           UUID PRIMARY KEY,
  title        VARCHAR,
  planner_name VARCHAR,
  org_name     VARCHAR,
  city_name    VARCHAR,
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
  length_m     DOUBLE,
  area_m2      DOUBLE,
  frontage_m   DOUBLE,
  measure_epsg INTEGER,
  measure_at   TIMESTAMP,
  row_geom     GEOMETRY,
  created_at   TIMESTAMP NOT NULL,
  updated_at   TIMESTAMP NOT NULL,
  PRIMARY KEY (surface, id),
  CHECK (surface IN ('base', 'project', 'snapshot')),
  CHECK (kind IN ('street','parcel','amenity','path','green','utility','other')),
  CHECK (source IN ('osm','balady','planx','user')),
  CHECK (code_status IN ('ok','violate','unknown')),
  CHECK (ST_SRID(geom) = 4326),
  CHECK (row_geom IS NULL OR ST_SRID(row_geom) = 4326),
  CHECK (length_m IS NULL OR length_m >= 0),
  CHECK (area_m2 IS NULL OR area_m2 >= 0),
  CHECK (frontage_m IS NULL OR frontage_m >= 0)
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

CREATE TABLE use_defs (
  project_id          UUID NOT NULL,
  key                 VARCHAR NOT NULL,
  label               VARCHAR NOT NULL,
  color               VARCHAR,
  default_height_m    DOUBLE,
  default_coverage    DOUBLE,
  min_area_m2         DOUBLE,
  PRIMARY KEY (project_id, key),
  CHECK (min_area_m2 IS NULL OR min_area_m2 >= 0)
);

/** Bundled DDL so Vite does not need a raw-SQL plugin. Keep in sync with sql/schema.sql. */
export const SCHEMA_SQL = `
INSTALL spatial;
LOAD spatial;

CREATE TABLE IF NOT EXISTS projects (
  id           VARCHAR PRIMARY KEY,
  title        VARCHAR,
  planner_name VARCHAR,
  org_name     VARCHAR,
  city_name    VARCHAR,
  boundary     GEOMETRY NOT NULL,
  phase        VARCHAR NOT NULL,
  codepack_id  VARCHAR,
  utm_epsg     INTEGER,
  created_at   TIMESTAMP NOT NULL,
  updated_at   TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS features (
  id           VARCHAR NOT NULL,
  project_id   VARCHAR NOT NULL,
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
  PRIMARY KEY (surface, id)
);

CREATE TABLE IF NOT EXISTS conflicts (
  id           VARCHAR PRIMARY KEY,
  project_id   VARCHAR NOT NULL,
  feature_ids  VARCHAR,
  field        VARCHAR NOT NULL,
  values       JSON,
  winner       VARCHAR,
  created_at   TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS use_defs (
  project_id          VARCHAR NOT NULL,
  key                 VARCHAR NOT NULL,
  label               VARCHAR NOT NULL,
  color               VARCHAR,
  default_height_m    DOUBLE,
  default_coverage    DOUBLE,
  min_area_m2         DOUBLE,
  PRIMARY KEY (project_id, key)
);
`;

export const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS features_project_idx ON features (project_id);
CREATE INDEX IF NOT EXISTS features_surface_idx ON features (surface);
CREATE INDEX IF NOT EXISTS features_kind_idx ON features (kind);
CREATE INDEX IF NOT EXISTS features_source_idx ON features (source);
`;

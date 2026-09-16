/** Plan X CRS lock. Store and exchange are lon/lat. Tiles are web mercator. */
export const STORE_SRID = 4326;
export const TILE_SRID = 3857;

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const E2P = E2 / (1 - E2);
const K0 = 0.9996;

export function utmZoneFromLon(lon: number): number {
  return Math.floor((lon + 180) / 6) + 1;
}

export function utmEpsgFromLon(lon: number): number {
  return 32600 + utmZoneFromLon(lon);
}

export function zoneFromEpsg(epsg: number): number {
  if (epsg >= 32601 && epsg <= 32660) return epsg - 32600;
  if (epsg >= 32701 && epsg <= 32760) return epsg - 32700;
  return utmZoneFromLon(46.6);
}

function lon0Rad(zone: number): number {
  return ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
}

export interface EastNorth {
  e: number;
  n: number;
}

export function lonLatToUtm(lon: number, lat: number, epsg?: number): EastNorth {
  const zone = epsg ? zoneFromEpsg(epsg) : utmZoneFromLon(lon);
  const latr = (lat * Math.PI) / 180;
  const lonr = (lon * Math.PI) / 180;
  const N = A / Math.sqrt(1 - E2 * Math.sin(latr) ** 2);
  const T = Math.tan(latr) ** 2;
  const C = E2P * Math.cos(latr) ** 2;
  const A0 = (lonr - lon0Rad(zone)) * Math.cos(latr);
  const M =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * latr -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * latr) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * latr) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * latr));
  const e =
    K0 * N * (A0 + ((1 - T + C) * A0 ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * E2P) * A0 ** 5) / 120) +
    500000;
  const n =
    K0 *
    (M +
      N *
        Math.tan(latr) *
        (A0 ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A0 ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * E2P) * A0 ** 6) / 720));
  return { e, n };
}

export function utmToLonLat(easting: number, northing: number, epsg: number): [number, number] {
  const zone = zoneFromEpsg(epsg);
  const x = easting - 500000;
  const y = northing;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const M = y / K0;
  const mu =
    M / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = E2P * Math.cos(phi1) ** 2;
  const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * Math.sin(phi1) ** 2, 1.5);
  const D = x / (N1 * K0);
  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * E2P) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * E2P - 3 * C1 ** 2) * D ** 6) / 720);
  const lon =
    lon0Rad(zone) +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * E2P + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(phi1);
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

export function firstLonLat(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === "Point") return [geom.coordinates[0], geom.coordinates[1]];
  if (geom.type === "LineString") {
    const p = geom.coordinates[0];
    return p ? [p[0], p[1]] : null;
  }
  if (geom.type === "Polygon") {
    const p = geom.coordinates[0]?.[0];
    return p ? [p[0], p[1]] : null;
  }
  return null;
}

export function epsgForGeom(geom: GeoJSON.Geometry): number | undefined {
  const ll = firstLonLat(geom);
  return ll ? utmEpsgFromLon(ll[0]) : undefined;
}

/** Plan X CRS lock. Store and exchange are lon/lat. Tiles are web mercator. */
export const STORE_SRID = 4326;
export const TILE_SRID = 3857;

export function utmEpsgFromLon(lon: number): number {
  const zone = Math.floor((lon + 180) / 6) + 1;
  return 32600 + zone;
}

import type { Feature } from "../schema/index.ts";

export const SNAPSHOT_KIND = "planx-store-snapshot";

export interface StoreSnapshot {
  kind: typeof SNAPSHOT_KIND;
  v: 1;
  engine: "memory" | "duckdb";
  project_id?: string;
  features: Feature[];
}

export function serializeStore(features: Feature[], engine: StoreSnapshot["engine"]): string {
  const snap: StoreSnapshot = {
    kind: SNAPSHOT_KIND,
    v: 1,
    engine,
    features,
  };
  return JSON.stringify(snap);
}

export function parseStore(raw: string): StoreSnapshot {
  const data = JSON.parse(raw) as StoreSnapshot;
  if (data.kind !== SNAPSHOT_KIND || data.v !== 1 || !Array.isArray(data.features)) {
    throw new Error("not a Plan X store snapshot");
  }
  return data;
}

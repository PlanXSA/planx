import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memory.ts";
import type { Feature } from "../schema/index.ts";
import { isReject } from "../schema/index.ts";

const closed: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [46.6, 24.7],
      [46.61, 24.7],
      [46.61, 24.71],
      [46.6, 24.71],
      [46.6, 24.7],
    ],
  ],
};

const open: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [46.6, 24.7],
      [46.61, 24.7],
      [46.61, 24.71],
      [46.6, 24.71],
    ],
  ],
};

function parcel(id: string, geom: GeoJSON.Polygon): Feature {
  const now = new Date().toISOString();
  return {
    id,
    project_id: "p1",
    surface: "project",
    geom,
    kind: "parcel",
    source: "user",
    code_status: "unknown",
    props: {},
    created_at: now,
    updated_at: now,
  };
}

describe("MemoryStore.apply", () => {
  it("writes a closed parcel", async () => {
    const store = new MemoryStore();
    const f = parcel("a", closed);
    const out = await store.apply([{ op: "upsert", feature: f }]);
    expect(isReject(out)).toBe(false);
    expect(await store.get("a")).not.toBeNull();
  });

  it("rejects an unclosed parcel and writes nothing", async () => {
    const store = new MemoryStore();
    const good = parcel("ok", closed);
    await store.put(good);
    const bad = parcel("bad", open);
    const out = await store.apply([{ op: "upsert", feature: bad }]);
    expect(isReject(out)).toBe(true);
    if (isReject(out)) expect(out.reason).toBe("unclosed");
    expect(await store.get("bad")).toBeNull();
    expect(await store.get("ok")).not.toBeNull();
  });

  it("rejects a mixed batch and writes nothing", async () => {
    const store = new MemoryStore();
    const out = await store.apply([
      { op: "upsert", feature: parcel("g1", closed) },
      { op: "upsert", feature: parcel("b1", open) },
    ]);
    expect(isReject(out)).toBe(true);
    expect(await store.get("g1")).toBeNull();
    expect(await store.get("b1")).toBeNull();
  });

  it("put is the base import path", async () => {
    const store = new MemoryStore();
    const street: Feature = {
      ...parcel("s1", closed),
      kind: "street",
      surface: "base",
      source: "osm",
      source_ref: "way/1",
    };
    await store.put(street);
    const rows = await store.query({ surface: "base", source: "osm" });
    expect(rows).toHaveLength(1);
  });
});

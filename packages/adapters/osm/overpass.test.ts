import { describe, expect, it } from "vitest";
import { featuresFromOverpass } from "./overpass.ts";

const fixture = {
  elements: [
    { type: "node" as const, id: 1, lat: 24.7, lon: 46.6 },
    { type: "node" as const, id: 2, lat: 24.71, lon: 46.61 },
    { type: "node" as const, id: 3, lat: 24.72, lon: 46.62 },
    {
      type: "way" as const,
      id: 10,
      nodes: [1, 2, 3],
      tags: { highway: "residential", name: "Test St" },
    },
    {
      type: "node" as const,
      id: 9,
      lat: 24.705,
      lon: 46.605,
      tags: { amenity: "place_of_worship" },
    },
    {
      type: "way" as const,
      id: 99,
      nodes: [1, 2, 3],
      tags: { building: "yes" },
    },
  ],
};

describe("featuresFromOverpass", () => {
  it("maps a residential way to a base street and skips buildings", () => {
    const rows = featuresFromOverpass(fixture, "p1");
    expect(rows.some((r) => r.kind === "street" && r.source_ref === "way/10")).toBe(true);
    expect(rows.some((r) => r.kind === "amenity" && r.source_ref === "node/9")).toBe(true);
    expect(rows.some((r) => r.source_ref === "way/99")).toBe(false);
    expect(rows.every((r) => r.surface === "base" && r.source === "osm")).toBe(true);
  });
});

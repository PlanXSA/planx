import { describe, expect, it } from "vitest";
import { kindFromOsmTags } from "./map.ts";

describe("kindFromOsmTags", () => {
  it("maps residential highway to street", () => {
    expect(kindFromOsmTags({ highway: "residential" })).toBe("street");
  });

  it("does not invent parcels from buildings", () => {
    expect(kindFromOsmTags({ building: "yes" })).toBeNull();
  });

  it("accepts explicit plots only", () => {
    expect(kindFromOsmTags({ place: "plot" })).toBe("parcel");
  });
});

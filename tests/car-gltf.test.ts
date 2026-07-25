import { describe, expect, it } from "vitest";
import { CAR_MODELS, collisionRadiusFor } from "../src/data/carModels";
import { CAR_IDS } from "../src/data/cars";
import { createCarState, resolveContact } from "../src/sim/vehicle";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";

describe("gltf car pipeline + silhouette collision", () => {
  it("maps every car id to a public GLB url and collision radius", () => {
    for (const id of CAR_IDS) {
      expect(CAR_MODELS[id].url).toBe(`/models/cars/${id}.glb`);
      expect(CAR_MODELS[id].collisionRadius).toBeGreaterThan(0.5);
      expect(CAR_MODELS[id].collisionRadius).toBeLessThan(2);
    }
  });

  it("uses per-car silhouette radii for contact (not mesh shape)", () => {
    const stats = mergeStats(CARS.blitz.stats, []);
    const a = createCarState({
      id: "a",
      isPlayer: true,
      x: 0,
      z: 0,
      heading: 0,
      paint: "#e03131",
      sticker: "none",
      modelId: "blitz",
      stats,
    });
    const b = createCarState({
      id: "b",
      isPlayer: false,
      x: 2.0,
      z: 0,
      heading: 0,
      paint: "#868e96",
      sticker: "none",
      modelId: "bunker",
      stats: mergeStats(CARS.bunker.stats, []),
    });
    const minDist = collisionRadiusFor("blitz") + collisionRadiusFor("bunker");
    expect(minDist).toBeGreaterThan(2.0);
    resolveContact(a, b);
    // Overlap should push them apart toward minDist
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThanOrEqual(minDist - 0.01);
  });
});

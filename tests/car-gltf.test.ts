import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAR_MODELS, collisionRadiusFor } from "../src/data/carModels";
import { CAR_IDS } from "../src/data/cars";
import { createCarState, resolveContact } from "../src/sim/vehicle";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import { shouldApplyGaragePaint } from "../src/render/loadCarGltf";

describe("gltf car pipeline + silhouette collision", () => {
  it("maps every car id to a public GLB url and collision radius", () => {
    for (const id of CAR_IDS) {
      expect(CAR_MODELS[id].url).toBe(`/models/cars/${id}.glb`);
      expect(CAR_MODELS[id].collisionRadius).toBeGreaterThan(0.5);
      expect(CAR_MODELS[id].collisionRadius).toBeLessThan(2);
    }
  });

  it("ships a real GLB file for every car (not empty placeholders)", () => {
    for (const id of CAR_IDS) {
      const path = resolve("public/models/cars", `${id}.glb`);
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(8_000);
      // glTF binary magic
      expect(statSync(path).size).toBeLessThan(8_000_000);
    }
  });

  it("tints free-asset body materials and skips glass/tires/lights", () => {
    expect(shouldApplyGaragePaint("White")).toBe(true);
    expect(shouldApplyGaragePaint("BodyPaint")).toBe(true);
    expect(shouldApplyGaragePaint("Truck")).toBe(true);
    expect(shouldApplyGaragePaint("Atlas")).toBe(true);
    expect(shouldApplyGaragePaint("mat14")).toBe(true);
    expect(shouldApplyGaragePaint("Windows")).toBe(false);
    expect(shouldApplyGaragePaint("Tire")).toBe(false);
    expect(shouldApplyGaragePaint("Headlights")).toBe(false);
    expect(shouldApplyGaragePaint("Grey")).toBe(false);
    expect(shouldApplyGaragePaint("Black")).toBe(false);
    expect(shouldApplyGaragePaint("Chrome")).toBe(false);
    expect(shouldApplyGaragePaint("CageOrange")).toBe(false);
    expect(shouldApplyGaragePaint("EyeRed")).toBe(false);
    expect(shouldApplyGaragePaint("Skull")).toBe(false);
  });

  it("kaeferkraft ships tuned materials (cage/chrome/eyes, no black strip mats)", () => {
    const path = resolve("public/models/cars/kaeferkraft.glb");
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    const text = buf.toString("latin1");
    expect(text).toContain("CageOrange");
    expect(text).toContain("Chrome");
    expect(text).toContain("EyeRed");
    expect(text).toContain("Skull");
    expect(text).toContain("BodyPaint");
  });

  it("bison ships modern L200 pickup with BodyPaint + Glass + Tire", () => {
    const path = resolve("public/models/cars/bison.glb");
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    const text = buf.toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(text).toContain("Glass");
    expect(text).toContain("Tire");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    expect(statSync(path).size).toBeLessThan(2_000_000);
  });

  it("donnerbuechse ships RatRod bake (BodyPaint + Chrome + Tire)", () => {
    const path = resolve("public/models/cars/donnerbuechse.glb");
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    const text = buf.toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(text).toContain("Chrome");
    expect(text).toContain("Tire");
    expect(statSync(path).size).toBeGreaterThan(40_000);
  });

  it("bunker arcade scale is smaller than raw military truck export", () => {
    expect(CAR_MODELS.bunker.scale).toBeLessThan(0.65);
    expect(CAR_MODELS.bunker.collisionRadius).toBeLessThanOrEqual(1.25);
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

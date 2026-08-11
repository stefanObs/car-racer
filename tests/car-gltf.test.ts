import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAR_MODELS, collisionRadiusFor } from "../src/data/carModels";
import { CAR_IDS } from "../src/data/cars";
import { createCarState, resolveContact } from "../src/sim/vehicle";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import { shouldApplyGaragePaint, isKaeferkraftRoofLampMesh } from "../src/render/loadCarGltf";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";

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
    expect(shouldApplyGaragePaint("EyeRed")).toBe(false);
    expect(shouldApplyGaragePaint("Skull")).toBe(false);
    expect(shouldApplyGaragePaint("Seat")).toBe(false);
    expect(shouldApplyGaragePaint("Dark")).toBe(false);
  });

  it("detects Käferkraft roll-bar lamp pods by local bounds", () => {
    const lamp = new Mesh(new BoxGeometry(0.14, 0.28, 0.18), new MeshBasicMaterial({ name: "Chrome" }));
    lamp.geometry.translate(-0.38, 0.7, 0.22);
    lamp.geometry.computeBoundingBox();
    expect(isKaeferkraftRoofLampMesh(lamp)).toBe(true);

    const engineChrome = new Mesh(new BoxGeometry(0.3, 0.2, 0.3), new MeshBasicMaterial({ name: "Chrome" }));
    engineChrome.geometry.translate(1.2, 0.5, 0);
    engineChrome.geometry.computeBoundingBox();
    expect(isKaeferkraftRoofLampMesh(engineChrome)).toBe(false);
  });

  it("kaeferkraft ships a Tripo BodyPaint buggy (noses are separate props)", () => {
    const path = resolve("public/models/cars/kaeferkraft.glb");
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    const text = buf.toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(statSync(path).size).toBeGreaterThan(20_000);
    expect(statSync(path).size).toBeLessThan(8_000_000);
    expect(existsSync(resolve("public/models/props/buggy-skull.glb"))).toBe(true);
    expect(existsSync(resolve("public/models/props/buggy-dog.glb"))).toBe(true);
    expect(existsSync(resolve("public/models/props/buggy-bird.glb"))).toBe(true);
  });

  it("bison ships modern L200 pickup with BodyPaint + blue Glass + Tire", async () => {
    const path = resolve("public/models/cars/bison.glb");
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    const text = buf.toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(text).toContain("Glass");
    expect(text).toContain("Tire");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    expect(statSync(path).size).toBeLessThan(2_000_000);

    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const glass = doc.getRoot().listMaterials().find((m) => m.getName() === "Glass");
    expect(glass).toBeTruthy();
    const [, g, b] = glass!.getBaseColorFactor();
    expect(b).toBeGreaterThan(0.35);
    expect(b).toBeGreaterThan(g);
  });

  it("donnerbuechse ships Sketchfab Hotrod comic bake", () => {
    const path = resolve("public/models/cars/donnerbuechse.glb");
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    const text = buf.toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(statSync(path).size).toBeGreaterThan(500_000);
    expect(CAR_MODELS.donnerbuechse.scale).toBeGreaterThanOrEqual(3.0);
  });

  it("bunker ships Sketchfab Hummer HX comic bake", () => {
    const path = resolve("public/models/cars/bunker.glb");
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    const text = buf.toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(text).toContain("Glass");
    expect(text).toContain("Tire");
    expect(statSync(path).size).toBeGreaterThan(500_000);
    expect(CAR_MODELS.bunker.scale).toBeGreaterThanOrEqual(0.55);
    expect(CAR_MODELS.bunker.scale).toBeLessThanOrEqual(0.75);
  });

  it("bunker arcade scale fits Hummer HX export toward peer car length", () => {
    expect(CAR_MODELS.bunker.scale).toBeLessThan(0.7);
    expect(CAR_MODELS.bunker.collisionRadius).toBeLessThanOrEqual(1.3);
  });

  it("bison arcade scale lifts the short L200 export toward peer car length", () => {
    expect(CAR_MODELS.bison.scale).toBeGreaterThanOrEqual(1.7);
    expect(CAR_MODELS.bison.scale).toBeLessThanOrEqual(2.0);
    // Raw L200 longest ~2.1m → scaled ~3.7–3.8m (Blitz/Donner range).
    expect(2.097 * CAR_MODELS.bison.scale).toBeGreaterThan(3.5);
    expect(2.097 * CAR_MODELS.bison.scale).toBeLessThan(4.2);
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

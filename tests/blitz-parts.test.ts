import { existsSync, readFileSync } from "node:fs";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { afterEach, describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import {
  applyEquippedPartVisuals,
  applyBlitzParts,
  BLITZ_PART_PLACEMENT,
  BLITZ_PARTS_GROUP,
  BLITZ_SUSPENSION_LIFT,
  BLITZ_WHEEL_LIFT,
  blitzPartObjectName,
  blitzStanceLift,
  clearBlitzPartTemplates,
  garageLookCacheKey,
  registerBlitzPartTemplate,
} from "../src/render/blitzParts";

function fakePartTemplate(): Group {
  const g = new Group();
  const m = new Mesh(new BoxGeometry(0.3, 0.2, 0.4), new MeshBasicMaterial({ name: "Spoiler" }));
  m.name = "partMesh";
  g.add(m);
  return g;
}

describe("Blitz equipped-part visuals", () => {
  afterEach(() => {
    clearBlitzPartTemplates();
  });

  it("mounts Großer Motor on the hood facing the nose", () => {
    expect(BLITZ_PART_PLACEMENT.big_engine[0]!.z).toBeGreaterThan(1.25);
    expect(BLITZ_PART_PLACEMENT.big_engine[0]!.y).toBeLessThan(0.6);
    expect(BLITZ_PART_PLACEMENT.big_engine[0]!.yaw).toBeCloseTo(Math.PI);
  });

  it("seals Blitz cabin glass even with no parts equipped", () => {
    const root = new Group();
    applyBlitzParts(root, []);
    expect(root.getObjectByName("blitzCabinGlass")).toBeTruthy();
    expect(root.getObjectByName("blitzWindshield")).toBeTruthy();
  });

  it("mounts Heckspoiler on the rear deck from the original car wing", () => {
    expect(BLITZ_PART_PLACEMENT.rear_spoiler[0]!.z).toBeLessThan(-1.4);
    expect(existsSync("public/models/parts/blitz-rear_spoiler.glb")).toBe(true);
    expect(existsSync("scripts/extract-blitz-stock-and-spoiler.mjs")).toBe(true);
  });

  it("leaves other cars unchanged", () => {
    registerBlitzPartTemplate("rear_spoiler", fakePartTemplate());
    const bison = new Group();
    bison.name = "gltf-bison";
    applyEquippedPartVisuals(bison, "bison", ["rear_spoiler", "nitro_kit"]);
    expect(bison.getObjectByName(blitzPartObjectName("rear_spoiler"))).toBeUndefined();
    expect(bison.getObjectByName(BLITZ_PARTS_GROUP)).toBeUndefined();
    expect(bison.children).toHaveLength(0);
  });

  it("does not grant stats — mergeStats is the only stats path", () => {
    const src = readFileSync("src/render/blitzParts.ts", "utf8");
    expect(src).not.toMatch(/import\s*\{[^}]*mergeStats/);
    const bare = mergeStats(CARS.blitz.stats, []);
    const withPart = mergeStats(CARS.blitz.stats, ["rear_spoiler"]);
    expect(withPart.grip).toBeGreaterThan(bare.grip);
    registerBlitzPartTemplate("rear_spoiler", fakePartTemplate());
    const root = new Group();
    applyBlitzParts(root, ["rear_spoiler"]);
    expect(mergeStats(CARS.blitz.stats, ["rear_spoiler"]).grip).toBe(withPart.grip);
  });

  it("raises stance for big_wheels without mounting fake wheel hubs", () => {
    expect(blitzStanceLift(["big_wheels"])).toBeCloseTo(BLITZ_WHEEL_LIFT);
    const root = new Group();
    root.position.y = 0;
    applyBlitzParts(root, ["big_wheels"]);
    expect(root.position.y).toBeCloseTo(BLITZ_WHEEL_LIFT);
    expect(root.getObjectByName("WheelSpin_FL")).toBeUndefined();
    applyBlitzParts(root, []);
    expect(root.position.y).toBeCloseTo(0);
  });

  it("stacks big_wheels and offroad_suspension lifts", () => {
    expect(blitzStanceLift(["big_wheels", "offroad_suspension"])).toBeCloseTo(
      BLITZ_WHEEL_LIFT + BLITZ_SUSPENSION_LIFT,
    );
    const root = new Group();
    applyBlitzParts(root, ["big_wheels", "offroad_suspension"]);
    expect(root.position.y).toBeCloseTo(BLITZ_WHEEL_LIFT + BLITZ_SUSPENSION_LIFT);
  });

  it("raises ride height when offroad_suspension is equipped", () => {
    const root = new Group();
    root.position.y = 0;
    applyBlitzParts(root, ["offroad_suspension"]);
    expect(root.position.y).toBeCloseTo(BLITZ_SUSPENSION_LIFT);
    applyBlitzParts(root, []);
    expect(root.position.y).toBeCloseTo(0);
  });

  it("buildComicCar attaches Blitz parts after clone (no shared wheel mounts)", () => {
    const src = readFileSync("src/render/comicCarMesh.ts", "utf8");
    expect(src).toContain("applyEquippedPartVisuals");
    expect(src).toContain("equippedParts");
    expect(src).not.toContain("mountCarWheels");
    expect(src).not.toContain("applyBlitzWheelScale");
  });

  it("boot preloads Blitz part meshes and skips comic-wheel", () => {
    const src = readFileSync("src/main.ts", "utf8");
    expect(src).toContain("preloadBlitzParts");
    expect(src).not.toContain("preloadComicWheel");
  });

  it("garage look passes equippedParts into the renderer", () => {
    const app = readFileSync("src/ui/GameApp.ts", "utf8");
    expect(app).toMatch(/equippedParts:\s*kit\.equippedParts/);
    const look = readFileSync("src/render/createGameRenderer.ts", "utf8");
    expect(look).toContain("equippedParts");
    const race = readFileSync("src/render/RaceRenderer.ts", "utf8");
    expect(race).toContain("garageLookCacheKey");
    expect(race).not.toContain("spinCarWheels");
  });

  it("garage look key changes when Teile are equipped", () => {
    const bare = garageLookCacheKey({
      modelId: "blitz",
      paint: "#e03131",
      sticker: "none",
    });
    const withSpoiler = garageLookCacheKey({
      modelId: "blitz",
      paint: "#e03131",
      sticker: "none",
      equippedParts: ["rear_spoiler"],
    });
    expect(withSpoiler).not.toBe(bare);
    expect(withSpoiler).toContain("rear_spoiler");
  });
});

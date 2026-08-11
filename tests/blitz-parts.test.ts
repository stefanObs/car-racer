import { readFileSync } from "node:fs";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { afterEach, describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import {
  applyEquippedPartVisuals,
  applyBlitzParts,
  BLITZ_PARTS_GROUP,
  BLITZ_SUSPENSION_LIFT,
  BLITZ_WHEEL_SCALE,
  blitzPartObjectName,
  clearBlitzPartTemplates,
  garageLookCacheKey,
  isBlitzWheelObject,
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

  it("equipping rear_spoiler adds a named mesh; unequip removes it", () => {
    registerBlitzPartTemplate("rear_spoiler", fakePartTemplate());
    const root = new Group();
    applyBlitzParts(root, ["rear_spoiler"]);
    expect(root.getObjectByName(blitzPartObjectName("rear_spoiler"))).toBeTruthy();
    expect(root.getObjectByName(BLITZ_PARTS_GROUP)).toBeTruthy();

    applyBlitzParts(root, []);
    expect(root.getObjectByName(blitzPartObjectName("rear_spoiler"))).toBeUndefined();
    expect(root.getObjectByName(BLITZ_PARTS_GROUP)).toBeUndefined();
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

  it("scales existing Wheel nodes for big_wheels and never deletes them", () => {
    const root = new Group();
    const hub = new Group();
    hub.name = "WheelSpin_FL";
    const tire = new Mesh(new BoxGeometry(0.4, 0.4, 0.2), new MeshBasicMaterial({ name: "Tire" }));
    tire.name = "Tire";
    hub.add(tire);
    root.add(hub);
    expect(isBlitzWheelObject(hub)).toBe(true);

    applyBlitzParts(root, ["big_wheels"]);
    expect(root.getObjectByName("WheelSpin_FL")).toBe(hub);
    expect(hub.scale.x).toBeCloseTo(BLITZ_WHEEL_SCALE);
    expect(tire.scale.x).toBeCloseTo(1);

    applyBlitzParts(root, []);
    expect(root.getObjectByName("WheelSpin_FL")).toBe(hub);
    expect(hub.scale.x).toBeCloseTo(1);
  });

  it("raises ride height when offroad_suspension is equipped", () => {
    const root = new Group();
    root.position.y = 0;
    applyBlitzParts(root, ["offroad_suspension"]);
    expect(root.position.y).toBeCloseTo(BLITZ_SUSPENSION_LIFT);
    applyBlitzParts(root, []);
    expect(root.position.y).toBeCloseTo(0);
  });

  it("buildComicCar attaches Blitz parts after clone (visuals only)", () => {
    const src = readFileSync("src/render/comicCarMesh.ts", "utf8");
    expect(src).toContain("applyEquippedPartVisuals");
    expect(src).toContain("equippedParts");
    expect(src).toContain("mountCarWheels");
    expect(src).toContain("applyBlitzWheelScale");
  });

  it("boot preloads Blitz part meshes", () => {
    const src = readFileSync("src/main.ts", "utf8");
    expect(src).toContain("preloadBlitzParts");
  });

  it("garage look passes equippedParts into the renderer", () => {
    const app = readFileSync("src/ui/GameApp.ts", "utf8");
    expect(app).toMatch(/equippedParts:\s*kit\.equippedParts/);
    const look = readFileSync("src/render/createGameRenderer.ts", "utf8");
    expect(look).toContain("equippedParts");
    const race = readFileSync("src/render/RaceRenderer.ts", "utf8");
    expect(race).toContain("garageLookCacheKey");
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

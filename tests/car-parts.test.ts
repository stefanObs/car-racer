import { existsSync, readFileSync } from "node:fs";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { afterEach, describe, expect, it } from "vitest";
import { CAR_IDS, CARS, type CarId } from "../src/data/cars";
import { mergeStats, type PartId } from "../src/data/parts";
import {
  applyEquippedPartVisuals,
  applyBlitzParts,
  BLITZ_PART_PLACEMENT,
  BLITZ_PARTS_GROUP,
  BLITZ_SUSPENSION_LIFT,
  BLITZ_WHEEL_LIFT,
  blitzPartObjectName,
  blitzStanceLift,
  CAR_PART_LAYOUTS,
  CAR_PARTS_GROUP,
  carStanceLift,
  clearBlitzPartTemplates,
  garageLookCacheKey,
  partGlbUrl,
  registerBlitzPartTemplate,
  registerCarPartTemplate,
} from "../src/render/carParts";

function fakePartTemplate(): Group {
  const g = new Group();
  const m = new Mesh(new BoxGeometry(0.3, 0.2, 0.4), new MeshBasicMaterial({ name: "Spoiler" }));
  m.name = "partMesh";
  g.add(m);
  return g;
}

const ALL_VISUAL_PARTS: PartId[] = [
  "big_engine",
  "big_wheels",
  "spike_bumper",
  "better_brakes",
  "reinforced_frame",
  "lightweight_body",
  "nitro_kit",
  "offroad_suspension",
  "rear_spoiler",
];

describe("Equipped-part visuals (all cars)", () => {
  afterEach(() => {
    clearBlitzPartTemplates();
  });

  it("mounts Blitz Großer Motor on the hood facing the nose", () => {
    expect(BLITZ_PART_PLACEMENT.big_engine[0]!.z).toBeGreaterThan(1.25);
    expect(BLITZ_PART_PLACEMENT.big_engine[0]!.y).toBeLessThan(0.6);
    expect(BLITZ_PART_PLACEMENT.big_engine[0]!.yaw).toBeCloseTo(Math.PI);
    expect(BLITZ_PART_PLACEMENT.big_engine[0]!.preferY).toBeLessThan(0.7);
  });

  it("places Blitz Leichtbau louvers on the hood (not cabin roof triples)", () => {
    const anchors = BLITZ_PART_PLACEMENT.lightweight_body;
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.z).toBeGreaterThan(0.7);
    expect(anchors[0]!.z).toBeLessThan(1.2);
    expect(anchors[0]!.preferY).toBeLessThan(0.7);

    registerBlitzPartTemplate("lightweight_body", fakePartTemplate());
    const root = new Group();
    const body = new Mesh(new BoxGeometry(1.6, 0.4, 2.4), new MeshBasicMaterial());
    body.name = "BodyPaint";
    body.position.set(0, 0.5, 0);
    root.add(body);
    const cab = new Mesh(new BoxGeometry(1.2, 0.6, 0.8), new MeshBasicMaterial());
    cab.name = "Cab";
    cab.position.set(0, 1.1, -0.2);
    root.add(cab);

    applyEquippedPartVisuals(root, "blitz", ["lightweight_body"]);
    const vent = root.getObjectByName(blitzPartObjectName("lightweight_body"));
    expect(vent).toBeTruthy();
    expect(root.getObjectByName(blitzPartObjectName("lightweight_body", 1))).toBeUndefined();
    expect(vent!.position.y).toBeGreaterThan(0.45);
    expect(vent!.position.y).toBeLessThan(1.05);
  });

  it("places Blitz Nitro bottles on the rear bumper (look-sheet height)", () => {
    const a = BLITZ_PART_PLACEMENT.nitro_kit[0]!;
    expect(a.z).toBeLessThan(-1.6);
    expect(a.y).toBeGreaterThan(0.3);
    expect(a.scale).toBeGreaterThan(1.2);
  });

  it("does not seal Blitz cabin with opaque glass planes", () => {
    const root = new Group();
    applyBlitzParts(root, []);
    expect(root.getObjectByName("blitzCabinGlass")).toBeUndefined();
    expect(root.getObjectByName("blitzWindshield")).toBeUndefined();
  });

  it("mounts Heckspoiler on the rear deck from the original car wing", () => {
    expect(BLITZ_PART_PLACEMENT.rear_spoiler[0]!.z).toBeLessThan(-1.4);
    expect(existsSync("public/models/parts/blitz-rear_spoiler.glb")).toBe(true);
    expect(existsSync("scripts/extract-blitz-stock-and-spoiler.mjs")).toBe(true);
  });

  it("attaches Teile on every car class", () => {
    for (const id of CAR_IDS) {
      const root = new Group();
      applyEquippedPartVisuals(root, id, ALL_VISUAL_PARTS);
      const group = root.getObjectByName(CAR_PARTS_GROUP) ?? root.getObjectByName(BLITZ_PARTS_GROUP);
      expect(group, id).toBeTruthy();
      expect(root.getObjectByName(blitzPartObjectName("better_brakes")), id).toBeTruthy();
      expect(root.getObjectByName(blitzPartObjectName("spike_bumper")), id).toBeTruthy();
      expect(root.getObjectByName(blitzPartObjectName("rear_spoiler")), id).toBeTruthy();
      expect(root.getObjectByName(blitzPartObjectName("big_engine")), id).toBeTruthy();
      expect(carStanceLift(id, ["big_wheels", "offroad_suspension"])).toBeGreaterThan(0.1);
    }
  });

  it("places Käferkraft Großer Motor toward the rear (nose −X child space)", () => {
    const anchors = CAR_PART_LAYOUTS.kaeferkraft.big_engine.anchors;
    expect(anchors[0]!.x).toBeGreaterThan(0.5);
    expect(anchors[0]!.yaw).toBeCloseTo(0);
    expect(CAR_PART_LAYOUTS.kaeferkraft.big_engine.preferGlb).toBe(true);
  });

  it("clears parts when unequipped", () => {
    const root = new Group();
    applyEquippedPartVisuals(root, "bison", ["nitro_kit", "rear_spoiler"]);
    expect(root.getObjectByName(CAR_PARTS_GROUP)).toBeTruthy();
    applyEquippedPartVisuals(root, "bison", []);
    expect(root.getObjectByName(CAR_PARTS_GROUP)).toBeUndefined();
    expect(root.position.y).toBeCloseTo(0);
  });

  it("does not grant stats — mergeStats is the only stats path", () => {
    const src = readFileSync("src/render/carParts.ts", "utf8");
    expect(src).not.toMatch(/import\s*\{[^}]*mergeStats/);
    const bare = mergeStats(CARS.blitz.stats, []);
    const withPart = mergeStats(CARS.blitz.stats, ["rear_spoiler"]);
    expect(withPart.grip).toBeGreaterThan(bare.grip);
  });

  it("raises stance for big_wheels without mounting WheelSpin hubs", () => {
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
  });

  it("buildComicCar attaches parts after clone", () => {
    const src = readFileSync("src/render/comicCarMesh.ts", "utf8");
    expect(src).toContain("applyEquippedPartVisuals");
    expect(src).toContain("equippedParts");
    expect(src).toContain('from "./carParts"');
  });

  it("boot preloads car part meshes", () => {
    const src = readFileSync("src/main.ts", "utf8");
    expect(src).toContain("preloadCarParts");
    expect(src).not.toContain("preloadComicWheel");
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

  it("has a layout for every CarId", () => {
    for (const id of CAR_IDS as CarId[]) {
      expect(CAR_PART_LAYOUTS[id].big_engine.anchors.length).toBeGreaterThan(0);
      expect(CAR_PART_LAYOUTS[id].brakes.length).toBe(4);
    }
  });

  it("uses per-car Tripo templates when registered (no Blitz remount on others)", () => {
    registerBlitzPartTemplate("rear_spoiler", fakePartTemplate(), "blitz");
    registerCarPartTemplate("bison", "rear_spoiler", fakePartTemplate());

    const blitz = new Group();
    applyEquippedPartVisuals(blitz, "blitz", ["rear_spoiler"]);
    expect(blitz.getObjectByName(blitzPartObjectName("rear_spoiler"))).toBeTruthy();

    const bison = new Group();
    applyEquippedPartVisuals(bison, "bison", ["rear_spoiler"]);
    expect(bison.getObjectByName(blitzPartObjectName("rear_spoiler"))).toBeTruthy();

    // Donner has no template → still mounts procedural spoiler
    const donner = new Group();
    applyEquippedPartVisuals(donner, "donnerbuechse", ["rear_spoiler"]);
    expect(donner.getObjectByName(blitzPartObjectName("rear_spoiler"))).toBeTruthy();
  });

  it("maps part GLB URLs per car (never Blitz path for other classes)", () => {
    expect(partGlbUrl("blitz", "nitro_kit")).toBe("/models/parts/blitz-nitro_kit.glb");
    expect(partGlbUrl("bison", "nitro_kit")).toBe("/models/parts/bison-nitro_kit.glb");
    expect(partGlbUrl("kaeferkraft", "rear_spoiler")).toBe("/models/parts/kaeferkraft-rear_spoiler.glb");
    for (const id of ["bison", "kaeferkraft", "donnerbuechse", "bunker"] as CarId[]) {
      expect(CAR_PART_LAYOUTS[id].big_engine.preferGlb).toBe(true);
      expect(CAR_PART_LAYOUTS[id].spike_bumper.preferGlb).toBe(true);
      expect(CAR_PART_LAYOUTS[id].nitro_kit.preferGlb).toBe(true);
      expect(CAR_PART_LAYOUTS[id].rear_spoiler.preferGlb).toBe(true);
      expect(CAR_PART_LAYOUTS[id].reinforced_frame.preferGlb).toBe(true);
      expect(CAR_PART_LAYOUTS[id].lightweight_body.preferGlb).toBe(false);
    }
  });

  it("lazy-loads per-car kits via ensureCarPartTemplates", () => {
    const partsSrc = readFileSync("src/render/carParts.ts", "utf8");
    expect(partsSrc).toContain("export function ensureCarPartTemplates");
    expect(partsSrc).toContain('ensureCarPartTemplates("blitz")');
    const rendererSrc = readFileSync("src/render/RaceRenderer.ts", "utf8");
    expect(rendererSrc).toContain("ensureCarPartTemplates");
    const appSrc = readFileSync("src/ui/GameApp.ts", "utf8");
    expect(appSrc).toContain("ensureCarPartTemplates");
  });

  it("places Bison scoop on mid-hood and nitro on the bed", () => {
    const scoop = CAR_PART_LAYOUTS.bison.big_engine.anchors[0]!;
    const nitroZ = CAR_PART_LAYOUTS.bison.nitro_kit.anchors[0]!.z;
    expect(scoop.z).toBeGreaterThan(0.8);
    expect(scoop.z).toBeLessThan(1.15);
    expect(scoop.scale).toBeLessThan(0.85);
    expect(scoop.preferY).toBeLessThan(1.15);
    expect(nitroZ).toBeLessThan(-0.6);
    expect(nitroZ).toBeGreaterThan(-1.3);
  });

  it("tucks Bison spike bumper and tints it olive-charcoal", () => {
    const spike = CAR_PART_LAYOUTS.bison.spike_bumper;
    expect(spike.anchors[0]!.z).toBeLessThan(1.4);
    expect(spike.anchors[0]!.scale).toBeLessThan(0.75);
    expect(spike.tint).toBe(0x5c6a4a);
  });

  it("places Bison reinforced frame in the bed behind the cab", () => {
    const frame = CAR_PART_LAYOUTS.bison.reinforced_frame.anchors[0]!;
    expect(frame.z).toBeLessThan(-0.45);
    expect(frame.y).toBeGreaterThan(0.5);
  });

  it("places Bison lightweight vents on the hood deck", () => {
    const light = CAR_PART_LAYOUTS.bison.lightweight_body.anchors[0]!;
    expect(light.z).toBeGreaterThan(0.85);
    expect(light.y).toBeGreaterThan(0.95);
    expect(light.y).toBeLessThan(1.15);
    expect(light.snap).toBe(false);
    expect(CAR_PART_LAYOUTS.bison.lightweight_body.preferGlb).toBe(false);
  });

  it("places Bison rear spoiler on the cab roof facing the nose", () => {
    const wing = CAR_PART_LAYOUTS.bison.rear_spoiler.anchors[0]!;
    expect(wing.z).toBeGreaterThan(-0.5);
    expect(wing.z).toBeLessThan(-0.1);
    expect(wing.yaw).toBeCloseTo(Math.PI);
    expect(wing.preferY).toBeGreaterThan(1.2);
  });

  it("places Donner nitro on the driver side (−X)", () => {
    expect(CAR_PART_LAYOUTS.donnerbuechse.nitro_kit.anchors[0]!.x).toBeLessThan(-0.8);
    expect(CAR_PART_LAYOUTS.donnerbuechse.reinforced_frame.preferGlb).toBe(true);
  });

  it("applies Bison spike bumper tint on mount", () => {
    const g = new Group();
    g.add(new Mesh(new BoxGeometry(0.3, 0.2, 0.4), new MeshBasicMaterial({ color: 0xffffff, name: "Spike" })));
    registerCarPartTemplate("bison", "spike_bumper", g);
    const root = new Group();
    applyEquippedPartVisuals(root, "bison", ["spike_bumper"]);
    const part = root.getObjectByName(blitzPartObjectName("spike_bumper"));
    expect(part).toBeTruthy();
    const mesh = part!.children[0] as Mesh;
    expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(0x5c6a4a);
  });

  it("snaps hood scoop onto body surface Y near preferY (not roof)", () => {
    registerBlitzPartTemplate("big_engine", fakePartTemplate());
    const root = new Group();
    const body = new Mesh(new BoxGeometry(1.6, 0.4, 2.4), new MeshBasicMaterial());
    body.name = "BodyPaint";
    body.position.set(0, 0.9, 0.9);
    root.add(body);
    const cab = new Mesh(new BoxGeometry(1.2, 0.6, 0.8), new MeshBasicMaterial());
    cab.name = "Cab";
    cab.position.set(0, 1.3, -0.2);
    root.add(cab);

    applyEquippedPartVisuals(root, "bison", ["big_engine"]);
    const scoop = root.getObjectByName(blitzPartObjectName("big_engine"));
    expect(scoop).toBeTruthy();
    // Prefer hood deck (~1.0) over cab roof (~1.6)
    expect(scoop!.position.y).toBeGreaterThan(0.85);
    expect(scoop!.position.y).toBeLessThan(1.25);
  });

  it("ships per-car Tripo kits for look-sheet deltas", () => {
    const kits = ["big_engine", "spike_bumper", "nitro_kit", "rear_spoiler", "reinforced_frame"] as const;
    for (const car of ["bison", "kaeferkraft", "donnerbuechse", "bunker"] as CarId[]) {
      for (const part of kits) {
        expect(existsSync(`public/models/parts/${car}-${part}.glb`), `${car}-${part}`).toBe(true);
      }
    }
  });
});

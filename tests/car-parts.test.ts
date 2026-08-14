import { existsSync, readFileSync } from "node:fs";
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { afterEach, describe, expect, it } from "vitest";
import { CAR_IDS, CARS, type CarId } from "../src/data/cars";
import { mergeStats, type PartId } from "../src/data/parts";
import {
  applyEquippedPartVisuals,
  applyBlitzParts,
  applyStockPartVisibility,
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
  isSpikeHazardStripePixel,
  partGlbUrl,
  recolorSpikeBarPixels,
  registerBlitzPartTemplate,
  registerCarPartTemplate,
  STOCK_ENGINE_MESH,
  STOCK_CAGE_MESH,
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

  it("mounts Blitz Großer Motor on the hood with red tip toward the nose", async () => {
    const scoop = BLITZ_PART_PLACEMENT.big_engine[0]!;
    expect(scoop.z).toBeGreaterThan(1.1);
    expect(scoop.y).toBeLessThan(0.5);
    expect(scoop.y).toBeGreaterThan(0.35);
    // Bake: low tip at local +Z — yaw 0 aims tip at the nose (not π / aft).
    expect(scoop.yaw).toBeCloseTo(0);
    // Fixed deck Y + nose-up pitch buries the aft flange (snap would lift after pitch).
    expect(scoop.snap).toBe(false);
    expect(scoop.pitch!).toBeLessThan(-0.1);
    expect(scoop.pitch!).toBeGreaterThan(-0.3);

    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const { getBounds } = await import("@gltf-transform/functions");
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read("public/models/parts/blitz-big_engine.glb");
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const midZ = (b.min[2] + b.max[2]) / 2;
    let maxYPlus = -Infinity;
    let maxYMinus = -Infinity;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          if (v[2]! >= midZ) maxYPlus = Math.max(maxYPlus, v[1]!);
          else maxYMinus = Math.max(maxYMinus, v[1]!);
        }
      }
    }
    // Low tip lives on +Z; taller scoop body on −Z.
    expect(maxYPlus).toBeLessThan(maxYMinus);
    const tipWorldZ = scoop.z + Math.cos(scoop.yaw) * b.max[2]! * scoop.scale;
    const aftWorldZ = scoop.z + Math.cos(scoop.yaw) * b.min[2]! * scoop.scale;
    expect(tipWorldZ).toBeGreaterThan(aftWorldZ);

    const root = new Group();
    applyEquippedPartVisuals(root, "blitz", ["big_engine"]);
    const mounted = root.getObjectByName(blitzPartObjectName("big_engine"));
    expect(mounted).toBeTruthy();
    expect(mounted!.rotation.y).toBeCloseTo(0);
    expect(mounted!.rotation.x).toBeCloseTo(scoop.pitch!);
    expect(mounted!.position.y).toBeCloseTo(scoop.y, 2);
  });

  it("drops Blitz Leichtbau from shop and mounts no hood-vent mesh", () => {
    expect(CAR_PART_LAYOUTS.blitz.lightweight_body.preferGlb).toBe(false);
    expect(BLITZ_PART_PLACEMENT.lightweight_body).toHaveLength(0);
    expect(existsSync("public/models/parts/blitz-lightweight_body.glb")).toBe(false);

    const root = new Group();
    applyEquippedPartVisuals(root, "blitz", ["lightweight_body"]);
    expect(root.getObjectByName(blitzPartObjectName("lightweight_body"))).toBeUndefined();
  });

  it("paints Blitz spike bumper bar with body color and keeps chrome tips", () => {
    const g = new Group();
    // Fake Tripo single-mesh bumper spanning bar (−Z) and tips (+Z).
    const geo = new BufferGeometry();
    const positions = new Float32Array([
      // bar triangle (z <= 0)
      -0.2, 0.1, -0.1, 0.2, 0.1, -0.1, 0, 0.2, -0.05,
      // tip triangle (z > 0.15)
      -0.05, 0.1, 0.16, 0.05, 0.1, 0.16, 0, 0.15, 0.22,
    ]);
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    const mat = new MeshBasicMaterial({ color: 0xffffff, name: "Spike" });
    g.add(new Mesh(geo, mat));
    registerCarPartTemplate("blitz", "spike_bumper", g);

    const root = new Group();
    applyEquippedPartVisuals(root, "blitz", ["spike_bumper"], { paint: "#e03131" });
    const part = root.getObjectByName(blitzPartObjectName("spike_bumper"));
    expect(part).toBeTruthy();
    const bar = part!.getObjectByName("SpikeBar") as Mesh;
    const tip = part!.getObjectByName("Spike") as Mesh;
    expect(bar).toBeTruthy();
    expect(tip).toBeTruthy();
    // No albedo in this fixture → solid paint fallback on the bar.
    expect((bar.material as MeshBasicMaterial).color.getHex()).toBe(0xe03131);
    expect((tip.material as MeshBasicMaterial).color.getHex()).toBe(0xffffff);
    expect(CAR_PART_LAYOUTS.blitz.spike_bumper.tint).toBeUndefined();
    expect(BLITZ_PART_PLACEMENT.spike_bumper[0]!.z).toBeGreaterThan(1.75);
    expect(BLITZ_PART_PLACEMENT.spike_bumper[0]!.z).toBeLessThan(2.05);
    expect(BLITZ_PART_PLACEMENT.spike_bumper[0]!.scale).toBeGreaterThan(0.9);
  });

  it("keeps yellow/dark hazard stripes when recoloring spike-bar albedo", () => {
    expect(isSpikeHazardStripePixel(220, 180, 40)).toBe(true);
    expect(isSpikeHazardStripePixel(28, 28, 30)).toBe(true);
    expect(isSpikeHazardStripePixel(70, 72, 78)).toBe(false);

    const data = new Uint8ClampedArray([
      70, 72, 78, 255, // metal → paint
      220, 180, 40, 255, // yellow stripe → keep
      24, 24, 26, 255, // dark stripe → keep
    ]);
    const n = recolorSpikeBarPixels(data, 0xe0 / 255, 0x31 / 255, 0x31 / 255);
    expect(n).toBe(1);
    expect(data[0]).toBeGreaterThan(100);
    expect(data[4]).toBe(220);
    expect(data[5]).toBe(180);
    expect(data[8]).toBe(24);
  });

  it("paints Bunker Leichtbau flank plates with garage body color on both sides", () => {
    registerCarPartTemplate("bunker", "lightweight_body", fakePartTemplate());
    const root = new Group();
    applyEquippedPartVisuals(root, "bunker", ["lightweight_body"], { paint: "#e03131" });
    const a = root.getObjectByName(blitzPartObjectName("lightweight_body"));
    const b = root.getObjectByName(blitzPartObjectName("lightweight_body", 1));
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    const mat = (a!.children[0] as Mesh).material as MeshBasicMaterial;
    expect(mat.color.getHex()).toBe(0xe03131);
    expect(mat.map).toBeNull();
    expect(CAR_PART_LAYOUTS.bunker.lightweight_body.anchors).toHaveLength(2);
  });

  it("tucks Blitz nitro onto the rear bumper under the deck spoiler", () => {
    const nitro = BLITZ_PART_PLACEMENT.nitro_kit[0]!;
    const wing = BLITZ_PART_PLACEMENT.rear_spoiler[0]!;
    expect(nitro.z).toBeGreaterThan(-1.9);
    expect(nitro.z).toBeLessThan(-1.55);
    expect(nitro.scale).toBeLessThanOrEqual(0.85);
    expect(nitro.z).toBeLessThan(wing.z);
    expect(nitro.y + 0.42 * nitro.scale).toBeLessThan(wing.y);
  });

  it("ships Blitz reinforced frame as Tripo sill-armor GLB (no rear cage)", async () => {
    expect(CAR_PART_LAYOUTS.blitz.reinforced_frame.preferGlb).not.toBe(false);
    expect(existsSync("public/models/parts/blitz-reinforced_frame.glb")).toBe(true);
    const a = BLITZ_PART_PLACEMENT.reinforced_frame[0]!;
    // Rocker plates between arches — cage stripped from the bake.
    expect(a.z).toBeCloseTo(0);
    expect(a.y).toBeGreaterThan(0.08);
    expect(a.y).toBeLessThan(0.18);
    expect(a.scale).toBeGreaterThan(1.05);
    expect(a.scale).toBeLessThan(1.2);
    expect(a.yaw).toBeCloseTo(0);
    expect(a.snap).toBe(false);

    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const { getBounds } = await import("@gltf-transform/functions");
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read("public/models/parts/blitz-reinforced_frame.glb");
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sy = b.max[1]! - b.min[1]!;
    // Sill-only — no roll-cage height.
    expect(sy).toBeGreaterThan(0.08);
    expect(sy).toBeLessThan(0.4);

    // Mounted length must sit in the clear span between Blitz wheel hubs
    // (wheelHints ±1.15; tire/arch inners ~±0.74) — no Z intersection with tires.
    const meshHalfZ = (b.max[2]! - b.min[2]!) / 2;
    const mountedHalfZ = meshHalfZ * (a.scaleZ ?? a.scale);
    const frontHubZ = CAR_PART_LAYOUTS.blitz.wheelHints[0]!.z;
    const rearHubZ = CAR_PART_LAYOUTS.blitz.wheelHints[2]!.z;
    expect(frontHubZ).toBeGreaterThan(1.1);
    expect(rearHubZ).toBeLessThan(-1.1);
    expect(mountedHalfZ).toBeLessThan(0.75);
    expect(mountedHalfZ).toBeGreaterThan(0.65);
    expect(a.z + mountedHalfZ).toBeLessThan(frontHubZ - 0.35);
    expect(a.z - mountedHalfZ).toBeGreaterThan(rearHubZ + 0.35);
  });

  it("does not seal Blitz cabin with opaque glass planes", () => {
    const root = new Group();
    applyBlitzParts(root, []);
    expect(root.getObjectByName("blitzCabinGlass")).toBeUndefined();
    expect(root.getObjectByName("blitzWindshield")).toBeUndefined();
  });

  it("mounts Heckspoiler on the rear deck from the original car wing", () => {
    expect(BLITZ_PART_PLACEMENT.rear_spoiler[0]!.z).toBeLessThan(-1.4);
    expect(BLITZ_PART_PLACEMENT.rear_spoiler[0]!.y).toBeGreaterThan(0.75);
    expect(existsSync("public/models/parts/blitz-rear_spoiler.glb")).toBe(true);
    expect(existsSync("scripts/extract-blitz-stock-and-spoiler.mjs")).toBe(true);
  });

  it("attaches Teile on every car class", () => {
    for (const id of CAR_IDS) {
      const root = new Group();
      applyEquippedPartVisuals(root, id, ALL_VISUAL_PARTS);
      const group = root.getObjectByName(CAR_PARTS_GROUP) ?? root.getObjectByName(BLITZ_PARTS_GROUP);
      expect(group, id).toBeTruthy();
      expect(root.getObjectByName(blitzPartObjectName("spike_bumper")), id).toBeTruthy();
      expect(root.getObjectByName(blitzPartObjectName("rear_spoiler")), id).toBeTruthy();
      expect(root.getObjectByName(blitzPartObjectName("big_engine")), id).toBeTruthy();
      if (id === "bison") {
        expect(root.getObjectByName(blitzPartObjectName("big_wheels")), id).toBeFalsy();
      } else {
        expect(root.getObjectByName(blitzPartObjectName("big_wheels")), id).toBeTruthy();
      }
      expect(carStanceLift(id, ["big_wheels"])).toBeGreaterThan(0);
      if (id === "blitz") {
        expect(root.getObjectByName(blitzPartObjectName("better_brakes")), id).toBeFalsy();
        expect(root.getObjectByName(blitzPartObjectName("offroad_suspension")), id).toBeTruthy();
      } else if (id === "bison") {
        expect(root.getObjectByName(blitzPartObjectName("better_brakes")), id).toBeFalsy();
        expect(root.getObjectByName(blitzPartObjectName("offroad_suspension")), id).toBeTruthy();
      } else if (id === "kaeferkraft" || id === "bunker") {
        expect(root.getObjectByName(blitzPartObjectName("better_brakes")), id).toBeFalsy();
        expect(root.getObjectByName(blitzPartObjectName("offroad_suspension")), id).toBeFalsy();
      } else {
        expect(root.getObjectByName(blitzPartObjectName("better_brakes")), id).toBeTruthy();
        expect(root.getObjectByName(blitzPartObjectName("offroad_suspension")), id).toBeFalsy();
      }
    }
  });

  it("places Käferkraft Großer Motor on the aft deck (look sheet panel 1)", () => {
    const a = CAR_PART_LAYOUTS.kaeferkraft.big_engine.anchors[0]!;
    expect(a.x).toBeGreaterThan(1.15);
    expect(a.x).toBeLessThan(1.45);
    expect(a.y).toBeGreaterThan(0.85);
    expect(a.y).toBeLessThan(1.1);
    expect(a.scale).toBeGreaterThan(1.2);
    expect(a.scaleY ?? a.scale).toBeGreaterThan(1.35);
    expect(a.yaw).toBeCloseTo(0);
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

  it("raises stance for big_wheels and mounts procedural UpgradeTire overlays", () => {
    expect(blitzStanceLift(["big_wheels"])).toBeCloseTo(BLITZ_WHEEL_LIFT);
    const root = new Group();
    root.position.y = 0;
    applyBlitzParts(root, ["big_wheels"]);
    expect(root.position.y).toBeCloseTo(BLITZ_WHEEL_LIFT);
    expect(root.getObjectByName("WheelSpin_FL")).toBeUndefined();
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeTruthy();
    expect(root.getObjectByName("UpgradeTire")).toBeTruthy();
    applyBlitzParts(root, []);
    expect(root.position.y).toBeCloseTo(0);
  });

  it("stacks big_wheels and offroad_suspension lifts on Blitz only", () => {
    expect(blitzStanceLift(["big_wheels", "offroad_suspension"])).toBeCloseTo(
      BLITZ_WHEEL_LIFT + BLITZ_SUSPENSION_LIFT,
    );
    expect(carStanceLift("bunker", ["big_wheels", "offroad_suspension"])).toBe(
      CAR_PART_LAYOUTS.bunker.wheelLift,
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
      if (id === "blitz" || id === "bison" || id === "kaeferkraft" || id === "bunker") {
        expect(CAR_PART_LAYOUTS[id].brakes.length).toBe(0);
      } else expect(CAR_PART_LAYOUTS[id].brakes.length).toBe(4);
      expect(CAR_PART_LAYOUTS[id].wheelHints.length).toBe(id === "bison" ? 0 : 4);
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
    }
    expect(CAR_PART_LAYOUTS.kaeferkraft.lightweight_body.preferGlb).toBe(true);
  });

  it("requires Tripo preferGlb whenever a silhouette part GLB ships", () => {
    const silhouette = [
      "big_engine",
      "spike_bumper",
      "nitro_kit",
      "rear_spoiler",
      "reinforced_frame",
      "lightweight_body",
    ] as const;
    for (const car of CAR_IDS as CarId[]) {
      for (const part of silhouette) {
        const path = `public/models/parts/${car}-${part}.glb`;
        if (!existsSync(path)) continue;
        const key = `${car}:${part}`;
        expect(CAR_PART_LAYOUTS[car][part].preferGlb, `${key} ships ${path}`).not.toBe(false);
      }
    }
  });

  it("places Käferkraft spike/nitro/spoiler/frame/lightweight per look sheets", () => {
    const L = CAR_PART_LAYOUTS.kaeferkraft;
    const spike = L.spike_bumper.anchors[0]!;
    expect(spike.x).toBeLessThan(-1.4);
    expect(spike.x).toBeGreaterThan(-1.65);
    expect(spike.y).toBeGreaterThan(0.3);
    expect(spike.y).toBeLessThan(0.55);
    expect(spike.yaw).toBeCloseTo(-Math.PI / 2);
    expect(spike.scale).toBeLessThan(0.55);
    expect(L.spike_bumper.tint).toBe(0x2c3136);

    const nitro = L.nitro_kit.anchors[0]!;
    const engine = L.big_engine.anchors[0]!;
    const wing = L.rear_spoiler.anchors[0]!;
    // Look sheet panel 7: vertical tanks on aft cage, under Heckspoiler (panel 9).
    expect(nitro.x).toBeGreaterThan(0.8);
    expect(nitro.x).toBeLessThan(1.05);
    expect(nitro.x).toBeLessThanOrEqual(engine.x);
    expect(nitro.x).toBeCloseTo(wing.x, 1);
    expect(nitro.y).toBeGreaterThan(0.65);
    expect(nitro.y).toBeLessThan(0.95);
    expect(nitro.y).toBeLessThan(wing.y - 0.7);
    expect(nitro.yaw).toBeCloseTo(Math.PI);
    expect(nitro.scale).toBeGreaterThan(0.9);

    // Aft cage top (past mid-cabin ~0.4), raised so the wing clears the tubes.
    expect(wing.x).toBeGreaterThan(0.8);
    expect(wing.x).toBeLessThan(1.15);
    expect(wing.y).toBeGreaterThan(1.6);
    expect(wing.y).toBeLessThan(1.85);
    expect(wing.yaw).toBeCloseTo(-Math.PI / 2);
    expect(wing.scale).toBeGreaterThan(0.95);

    const frame = L.reinforced_frame.anchors[0]!;
    // Replaces StockCage — sits on cabin deck, not floating above the roof.
    expect(frame.y).toBeGreaterThan(0.4);
    expect(frame.y).toBeLessThan(0.7);
    expect(frame.x).toBeGreaterThan(-0.15);
    expect(frame.x).toBeLessThan(0.2);
    expect(frame.scale).toBeGreaterThan(1.35);
    expect(frame.scale).toBeLessThan(1.65);
    expect(frame.scaleY ?? frame.scale).toBeGreaterThan(1.2);
    expect(frame.yaw).toBeCloseTo(Math.PI / 2);
    expect(L.reinforced_frame.preferGlb).toBe(true);
    expect(existsSync("scripts/extract-kaeferkraft-stock-cage.mjs")).toBe(true);

    const light = L.lightweight_body.anchors[0]!;
    // Mirrored hole flank on blue rails; chunky Tripo half removed in fix script.
    expect(light.y).toBeGreaterThan(0.75);
    expect(light.y).toBeLessThan(1.0);
    expect(light.x).toBeCloseTo(0, 1);
    expect(light.scale).toBeGreaterThan(1.25);
    expect(L.lightweight_body.tint).toBe(0x22b8cf);
    expect(L.lightweight_body.preferGlb).toBe(true);
    expect(existsSync("public/models/parts/kaeferkraft-lightweight_body.glb")).toBe(true);
    expect(existsSync("scripts/fix-kaeferkraft-lightweight.mjs")).toBe(true);
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

  it("places Bison scoop on mid-hood with grill toward the nose", async () => {
    const scoop = CAR_PART_LAYOUTS.bison.big_engine.anchors[0]!;
    const nitroZ = CAR_PART_LAYOUTS.bison.nitro_kit.anchors[0]!.z;
    // Hood mid ~1.17 (not windshield ~0.92) — look sheet panel 1 balanced gaps.
    expect(scoop.z).toBeGreaterThan(1.1);
    expect(scoop.z).toBeLessThan(1.25);
    // Larger + fixed lower Y buries the black flange into the hood paint.
    expect(scoop.scale).toBeGreaterThan(0.85);
    expect(scoop.scale).toBeLessThan(0.98);
    expect(scoop.y).toBeLessThan(0.95);
    expect(scoop.snap).toBe(false);
    // Open mouth is local −Z; yaw π aims it at the nose. Pitch sinks the aft into the hood.
    expect(scoop.yaw).toBeCloseTo(Math.PI);
    expect(scoop.pitch!).toBeLessThan(-0.15);
    expect(scoop.pitch!).toBeGreaterThan(-0.35);
    expect(nitroZ).toBeLessThan(-0.6);
    expect(nitroZ).toBeGreaterThan(-1.3);

    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const { MeshoptDecoder } = await import("meshoptimizer");
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
      .read("public/models/parts/bison-big_engine.glb");
    const verts: { y: number; z: number }[] = [];
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION")!;
        const v = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v);
          verts.push({ y: v[1]!, z: v[2]! });
        }
      }
    }
    const minZ = Math.min(...verts.map((p) => p.z));
    const maxZ = Math.max(...verts.map((p) => p.z));
    // Open grill is the local −Z face; yaw π maps it ahead of the mount toward the nose.
    const cos = Math.cos(scoop.yaw);
    const worldGrillZ = scoop.z + cos * minZ * scoop.scale;
    const worldAftZ = scoop.z + cos * maxZ * scoop.scale;
    expect(worldGrillZ).toBeGreaterThan(worldAftZ);
    expect(worldGrillZ).toBeGreaterThan(scoop.z);
  });

  it("places Bison Tripo spike on the stock bumper (replaces the bar)", () => {
    const spike = CAR_PART_LAYOUTS.bison.spike_bumper;
    expect(spike.preferGlb).toBe(true);
    expect(spike.tint).toBeUndefined();
    // Was z 2.28 / scale 0.95 — pull onto bumper band (~1.56–1.90) and shrink slightly.
    expect(spike.anchors[0]!.z).toBeGreaterThan(1.6);
    expect(spike.anchors[0]!.z).toBeLessThan(1.85);
    expect(spike.anchors[0]!.scale).toBeGreaterThan(0.75);
    expect(spike.anchors[0]!.scale).toBeLessThan(0.9);
    expect(spike.anchors[0]!.y).toBeGreaterThan(0.2);
    expect(spike.anchors[0]!.y).toBeLessThan(0.35);
  });

  it("places Bison reinforced frame with arch half into the cabin", async () => {
    const frame = CAR_PART_LAYOUTS.bison.reinforced_frame.anchors[0]!;
    // Bake arch faces local +Z; yaw 0 keeps braces leaning aft (−Z) into the bed.
    expect(frame.yaw).toBeCloseTo(0);
    expect(frame.z).toBeGreaterThan(-0.9);
    expect(frame.z).toBeLessThan(-0.7);
    expect(frame.y).toBeGreaterThan(0.55);
    expect(frame.y).toBeLessThan(0.75);
    // Bed rails are ~|x|≤0.70 — keep scaled width inside.
    expect(frame.scale).toBeGreaterThan(0.8);
    expect(frame.scale).toBeLessThanOrEqual(0.95);

    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const { getBounds } = await import("@gltf-transform/functions");
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      "public/models/parts/bison-reinforced_frame.glb",
    );
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = frame.scale;
    const sz = frame.scaleZ ?? frame.scale;
    const worldFront = frame.z + b.max[2]! * sz;
    const worldAft = frame.z + b.min[2]! * sz;
    // Cab rear high verts ~z−0.87…−0.63 — front poles past that into the cabin.
    expect(worldFront).toBeGreaterThan(-0.75);
    expect(worldFront).toBeLessThan(-0.5);
    // Aft braces still read in the bed (aft of cab rear).
    expect(worldAft).toBeLessThan(-0.95);
    expect(Math.max(Math.abs(b.min[0]! * sx), Math.abs(b.max[0]! * sx))).toBeLessThanOrEqual(0.7);
    // Packed bake: arch near +Z face (feet no longer stick past the hoop).
    const yArch = b.min[1]! + (b.max[1]! - b.min[1]!) * 0.7;
    const archZs: number[] = [];
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          if ((v[1] ?? 0) >= yArch) archZs.push(v[2]!);
        }
      }
    }
    const archMean = archZs.reduce((s, n) => s + n, 0) / archZs.length;
    expect(b.max[2]! - archMean).toBeLessThan(0.08);

    // Straightened bake: mid-height left/right Z means must agree (no ¾ skew).
    const y0 = b.min[1]!;
    const y1 = b.max[1]!;
    const ySpan = Math.max(y1 - y0, 1e-6);
    const yLo = y0 + ySpan * 0.3;
    const yHi = y0 + ySpan * 0.7;
    const xAbs = Math.max(Math.abs(b.min[0]!), Math.abs(b.max[0]!), 1e-6);
    const xCut = xAbs * 0.25;
    const leftZ: number[] = [];
    const rightZ: number[] = [];
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          const y = v[1] ?? 0;
          const x = v[0] ?? 0;
          if (y < yLo || y > yHi) continue;
          if (x < -xCut) leftZ.push(v[2]!);
          else if (x > xCut) rightZ.push(v[2]!);
        }
      }
    }
    expect(leftZ.length).toBeGreaterThan(8);
    expect(rightZ.length).toBeGreaterThan(8);
    const mean = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length;
    expect(Math.abs(mean(leftZ) - mean(rightZ))).toBeLessThan(0.04);
  });

  it("places Bison lightweight vents on the hood deck", () => {
    const light = CAR_PART_LAYOUTS.bison.lightweight_body.anchors[0]!;
    expect(light.z).toBeGreaterThan(0.85);
    expect(light.y).toBeGreaterThan(0.95);
    expect(light.y).toBeLessThan(1.15);
    expect(light.snap).toBe(false);
    expect(CAR_PART_LAYOUTS.bison.lightweight_body.preferGlb).toBe(false);
  });

  it("places Bison rear spoiler on the bed (aft rails), not the cab roof", () => {
    const wing = CAR_PART_LAYOUTS.bison.rear_spoiler.anchors[0]!;
    expect(wing.snap).toBe(false);
    expect(wing.z).toBeLessThan(-1.5);
    expect(wing.z).toBeGreaterThan(-1.9);
    expect(wing.y).toBeGreaterThan(0.8);
    expect(wing.y).toBeLessThan(1.1);
    expect(wing.yaw).toBeCloseTo(Math.PI);
  });

  it("places Bunker hood intake on the deck (not the roof) and roof spoiler aft", () => {
    const L = CAR_PART_LAYOUTS.bunker;
    const eng = L.big_engine.anchors[0]!;
    expect(eng.snap).toBe(false);
    expect(eng.y).toBeLessThan(1.18);
    expect(eng.y).toBeGreaterThan(1.05);
    // Mid-hood deck (look sheet panel 1) — not nose lip (~1.3+) or roof.
    expect(eng.z).toBeGreaterThan(1.05);
    expect(eng.z).toBeLessThan(1.25);
    // Compact rebaked scoop (~0.62m span) near unity — not the old 1.25× full-hood block.
    expect(eng.scale).toBeGreaterThan(0.9);
    expect(eng.scale).toBeLessThan(1.2);
    expect(eng.scaleY ?? eng.scale).toBeGreaterThan(1.4);
    expect(eng.yaw).toBeCloseTo(0);

    const frame = L.reinforced_frame.anchors[0]!;
    expect(frame.snap).toBe(false);
    // Full cage sits from rockers up toward the roof (look sheet panel 5).
    expect(frame.y).toBeGreaterThan(0.15);
    expect(frame.y).toBeLessThan(0.4);
    expect(frame.scale).toBeGreaterThan(0.95);
    expect(frame.scale).toBeLessThan(1.1);
    expect(frame.scaleY ?? frame.scale).toBeGreaterThan(1.1);
    expect(frame.yaw).toBeCloseTo(Math.PI / 2);
    expect(L.reinforced_frame.preferGlb).toBe(true);

    const light = L.lightweight_body;
    expect(light.preferGlb).toBe(true);
    expect(light.anchors).toHaveLength(2);
    expect(light.anchors[0]!.x).toBeLessThan(0);
    expect(light.anchors[1]!.x).toBeGreaterThan(0);
    expect(light.anchors[0]!.y).toBeGreaterThan(0.4);
    expect(light.anchors[0]!.y).toBeLessThan(0.7);
    expect(existsSync("public/models/parts/bunker-lightweight_body.glb")).toBe(true);

    const wing = L.rear_spoiler.anchors[0]!;
    expect(wing.snap).toBe(false);
    expect(wing.z).toBeLessThan(-1.35);
    expect(wing.z).toBeGreaterThan(-1.7);
    expect(wing.y).toBeGreaterThan(1.6);
    expect(wing.y).toBeLessThan(1.85);
  });

  it("places Donner nitro on the driver side rail (−X), ahead of the rear arch", () => {
    const nitro = CAR_PART_LAYOUTS.donnerbuechse.nitro_kit.anchors[0]!;
    // Rear quarter panel (look sheet panel 7) — flush on −X, ahead of rear tire.
    expect(nitro.x).toBeLessThan(-0.9);
    expect(nitro.x).toBeGreaterThan(-1.1);
    expect(nitro.y).toBeGreaterThan(0.8);
    expect(nitro.y).toBeLessThan(1.1);
    expect(nitro.z).toBeLessThan(-0.55);
    expect(nitro.z).toBeGreaterThan(-0.9);
    expect(nitro.yaw).toBeCloseTo(-Math.PI / 2);
    expect(CAR_PART_LAYOUTS.donnerbuechse.reinforced_frame.preferGlb).toBe(true);
  });

  it("places Donner spike low on the front frame and spoiler on the rear deck", () => {
    const L = CAR_PART_LAYOUTS.donnerbuechse;
    const spike = L.spike_bumper.anchors[0]!;
    expect(spike.y).toBeLessThan(0.12);
    expect(spike.z).toBeGreaterThan(1.65);
    expect(spike.scale).toBeGreaterThan(0.9);
    expect(spike.scale).toBeLessThan(1.1);
    // Keep Tripo chrome albedo — solid tint was washing the 5-spike kit to a dark plate.
    expect(L.spike_bumper.tint).toBeUndefined();
    expect(existsSync("public/models/parts/donnerbuechse-spike_bumper.glb")).toBe(true);

    const wing = L.rear_spoiler.anchors[0]!;
    expect(wing.z).toBeLessThan(-1.2);
    expect(wing.yaw).toBeCloseTo(Math.PI);
    expect(wing.snap).toBe(true);

    const frame = L.reinforced_frame.anchors[0]!;
    expect(frame.yaw).toBeCloseTo(-Math.PI / 2);
    expect(frame.z).toBeLessThan(-0.8);

    const light = L.lightweight_body;
    expect(light.preferGlb).toBe(true);
    expect(light.anchors[0]!.yaw).toBeCloseTo(Math.PI / 2);
    expect(existsSync("public/models/parts/donnerbuechse-lightweight_body.glb")).toBe(true);

    const eng = L.big_engine.anchors[0]!;
    // Fill open bay (grille → cabin): forward of mid-bay, large enough to close the gap.
    expect(eng.z).toBeGreaterThan(1.25);
    expect(eng.z).toBeLessThan(1.55);
    expect(eng.y).toBeLessThan(0.25);
    expect(eng.scale).toBeGreaterThan(2.9);
    expect(eng.yaw).toBeCloseTo(0);
  });

  it("does not hide a separate Donner stock engine (block stays welded in the body)", () => {
    const root = new Group();
    const stock = new Group();
    stock.name = STOCK_ENGINE_MESH;
    root.add(stock);
    applyStockPartVisibility(root, "donnerbuechse", ["big_engine"]);
    expect(stock.visible).toBe(true);
  });

  it("hides Käferkraft StockCage when Verstärkter Rahmen is equipped", () => {
    const root = new Group();
    const stock = new Group();
    stock.name = STOCK_CAGE_MESH;
    root.add(stock);
    applyStockPartVisibility(root, "kaeferkraft", []);
    expect(stock.visible).toBe(true);
    applyStockPartVisibility(root, "kaeferkraft", ["reinforced_frame"]);
    expect(stock.visible).toBe(false);
    stock.visible = true;
    applyStockPartVisibility(root, "bison", ["reinforced_frame"]);
    expect(stock.visible).toBe(true);
  });

  it("ships Donner hot rod without a detached StockEngine node", () => {
    const buf = readFileSync("public/models/cars/donnerbuechse.glb");
    const text = buf.toString("latin1");
    expect(text).not.toContain("StockEngine");
    expect(text).toContain("BodyPaint");
    expect(text).not.toContain("Chrome");
  });

  it("ships Käferkraft StockCage mesh in the car GLB", () => {
    const buf = readFileSync("public/models/cars/kaeferkraft.glb");
    const text = buf.toString("latin1");
    expect(text).toContain("StockCage");
    expect(text).toContain("BodyPaint");
  });

  it("mounts Bison spike from Tripo template without olive wash", () => {
    const g = new Group();
    g.add(new Mesh(new BoxGeometry(0.3, 0.2, 0.4), new MeshBasicMaterial({ color: 0xffffff, name: "Spike" })));
    registerCarPartTemplate("bison", "spike_bumper", g);
    const root = new Group();
    applyEquippedPartVisuals(root, "bison", ["spike_bumper"]);
    const part = root.getObjectByName(blitzPartObjectName("spike_bumper"));
    expect(part).toBeTruthy();
    expect(part!.position.z).toBeGreaterThan(1.6);
    expect(part!.position.z).toBeLessThan(1.85);
    const mesh = part!.children[0] as Mesh;
    expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(0xffffff);
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
    const kits = [
      "big_engine",
      "spike_bumper",
      "nitro_kit",
      "rear_spoiler",
      "reinforced_frame",
    ] as const;
    for (const car of ["bison", "kaeferkraft", "donnerbuechse", "bunker"] as CarId[]) {
      for (const part of kits) {
        expect(existsSync(`public/models/parts/${car}-${part}.glb`), `${car}-${part}`).toBe(true);
      }
    }
    expect(existsSync("public/models/parts/kaeferkraft-lightweight_body.glb")).toBe(true);
    expect(existsSync("public/models/parts/donnerbuechse-lightweight_body.glb")).toBe(true);
    expect(existsSync("public/models/parts/bunker-lightweight_body.glb")).toBe(true);
  });
});

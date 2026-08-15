import { existsSync, readFileSync } from "node:fs";
import { Box3, BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshToonMaterial } from "three";
import { describe, expect, it } from "vitest";
import { CAR_IDS, CARS, type CarId } from "../src/data/cars";
import { carSupportsPart, partsForCar } from "../src/data/partsCatalog";
import { mergeStats } from "../src/data/parts";
import { buildUpgradeWheel } from "../src/render/carPartBuilders";
import {
  applyEquippedPartVisuals,
  applyStockPartVisibility,
  BISON_BIG_WHEEL_SCALE,
  BISON_STOCK_WHEEL_RADIUS,
  BISON_BIG_WHEEL_ARCH_CLEARANCE,
  bisonBigWheelHubDrop,
  blitzPartObjectName,
  BLITZ_WHEEL_LIFT,
  CAR_PART_LAYOUTS,
  carStanceLift,
  KAEFERKRAFT_BIG_WHEEL_SCALE,
  KAEFERKRAFT_STOCK_WHEEL_RADIUS,
  kaeferkraftBigWheelHubDrop,
  partGlbUrl,
  registerCarPartTemplate,
} from "../src/render/carParts";
import {
  collectSpinMounts,
  MAX_STEER_YAW,
  mountCarWheels,
  spinCarWheels,
  steerFromHeadingDelta,
  steerYawFromInput,
  wheelMetrics,
} from "../src/render/carWheels";
import { collectWheelUvTriangles, shouldApplyGaragePaint } from "../src/render/loadCarGltf";
import { groundContactMinY, stockWheelName } from "../src/render/stockWheels";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

describe("parts catalog (per-car)", () => {
  it("keeps Gelände-Federung on Blitz/Bison (Tripo springs) and Käferkraft (stats-only)", () => {
    expect(carSupportsPart("blitz", "offroad_suspension")).toBe(true);
    expect(carSupportsPart("bison", "offroad_suspension")).toBe(true);
    expect(carSupportsPart("kaeferkraft", "offroad_suspension")).toBe(true);
    expect(existsSync("public/models/parts/blitz-offroad_suspension.glb")).toBe(true);
    expect(partsForCar("bison")).toContain("offroad_suspension");
    expect(partsForCar("kaeferkraft")).toContain("offroad_suspension");
    expect(CAR_PART_LAYOUTS.bison.springs).toHaveLength(4);
    expect(CAR_PART_LAYOUTS.kaeferkraft.springs).toHaveLength(0);
    expect(partGlbUrl("bison", "offroad_suspension")).toBe("/models/parts/blitz-offroad_suspension.glb");
    for (const id of CAR_IDS as CarId[]) {
      if (id === "blitz" || id === "bison" || id === "kaeferkraft") continue;
      expect(carSupportsPart(id, "offroad_suspension")).toBe(false);
      expect(partsForCar(id)).not.toContain("offroad_suspension");
      expect(CAR_PART_LAYOUTS[id].springs).toHaveLength(0);
    }
  });

  it("Käferkraft Gelände-Federung applies stats without mounting spring art", () => {
    const root = new Group();
    applyEquippedPartVisuals(root, "kaeferkraft", ["offroad_suspension"]);
    expect(root.getObjectByName(blitzPartObjectName("offroad_suspension"))).toBeUndefined();
    expect(carStanceLift("kaeferkraft", ["offroad_suspension"])).toBe(0);
    const bare = mergeStats(CARS.kaeferkraft.stats, []);
    const tuned = mergeStats(CARS.kaeferkraft.stats, ["offroad_suspension"]);
    expect(tuned.suspension).toBeGreaterThan(bare.suspension);
  });

  it("drops Bessere Bremsen on Blitz, Bison, Käferkraft, and Bunker; keeps big_wheels on every car", () => {
    for (const id of ["blitz", "bison", "kaeferkraft", "bunker"] as CarId[]) {
      expect(carSupportsPart(id, "better_brakes")).toBe(false);
      expect(partsForCar(id)).not.toContain("better_brakes");
      expect(CAR_PART_LAYOUTS[id].brakes).toHaveLength(0);
    }
    expect(partsForCar("donnerbuechse")).toContain("better_brakes");
    for (const id of CAR_IDS as CarId[]) {
      expect(partsForCar(id)).toContain("big_wheels");
    }
  });

  it("offers Leichtbau-Karosserie on every class including Blitz", () => {
    for (const id of CAR_IDS as CarId[]) {
      expect(carSupportsPart(id, "lightweight_body")).toBe(true);
      expect(partsForCar(id)).toContain("lightweight_body");
    }
  });
});

describe("stock wheels + Große Räder", () => {
  it("still skips garage paint on Tire and Wheel names", () => {
    expect(shouldApplyGaragePaint("Tire")).toBe(false);
    expect(shouldApplyGaragePaint("Wheel")).toBe(false);
    expect(shouldApplyGaragePaint("StockWheel_FL")).toBe(false);
    expect(shouldApplyGaragePaint("BodyPaint")).toBe(true);
  });

  it("does not feed StockWheel face UVs into BodyPaint skip masks", () => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    geo.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    const wheel = new Mesh(geo, new MeshToonMaterial({ name: "Tire" }));
    wheel.name = "StockWheel_FL_2";
    const root = new Group();
    root.add(wheel);
    expect(collectWheelUvTriangles(root)).toEqual([]);
  });

  it("skips all body wheel-UV masks when authored StockWheel_* are present", () => {
    const bodyGeo = new BufferGeometry();
    // Low outboard triangle that would otherwise match isWheelPaintVertex.
    bodyGeo.setAttribute(
      "position",
      new Float32BufferAttribute([-0.8, 0.05, 0.2, -0.7, 0.05, -0.2, -0.75, 0.1, 0], 3),
    );
    bodyGeo.setAttribute("uv", new Float32BufferAttribute([0.1, 0.1, 0.9, 0.1, 0.5, 0.9], 2));
    const body = new Mesh(bodyGeo, new MeshToonMaterial({ name: "BodyPaint" }));
    body.name = "BodyPaint";
    const wheelGeo = new BufferGeometry();
    wheelGeo.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    wheelGeo.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    const wheel = new Mesh(wheelGeo, new MeshToonMaterial({ name: "Tire" }));
    wheel.name = "StockWheel_FL";
    const root = new Group();
    root.add(body);
    root.add(wheel);
    expect(collectWheelUvTriangles(root)).toEqual([]);
  });

  it("load path does not runtime-extract tires from car GLBs", () => {
    const load = readFileSync("src/render/loadCarGltf.ts", "utf8");
    expect(load).not.toContain("extractStockWheels(");
  });

  it("ships Bison with Tripo-segmented StockWheel_* remounted", async () => {
    expect(existsSync("scripts/bake-bison-segmented-wheels.mjs")).toBe(true);
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/bison.glb"),
    );
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_"))
      .sort();
    expect(names).toEqual(["StockWheel_FL", "StockWheel_FR", "StockWheel_RL", "StockWheel_RR"]);
  });

  it("Käferkraft BodyPaint keeps chassis after wheel punch", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/kaeferkraft.glb"),
    );
    let bodyFaces = 0;
    let cabinInboard = 0;
    let outboard = 0;
    let roofRail = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      if (mesh.getName()?.startsWith("StockWheel_")) continue;
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMaterial()?.getName() !== "BodyPaint") continue;
        const pos = prim.getAttribute("POSITION")!;
        const idx = prim.getIndices();
        if (!pos || !idx) continue;
        for (let t = 0; t < idx.getCount() / 3; t++) {
          const a = pos.getElement(idx.getScalar(t * 3), []);
          const b = pos.getElement(idx.getScalar(t * 3 + 1), []);
          const c = pos.getElement(idx.getScalar(t * 3 + 2), []);
          const cy = (a[1]! + b[1]! + c[1]!) / 3;
          const cz = (a[2]! + b[2]! + c[2]!) / 3;
          const cx = (a[0]! + b[0]! + c[0]!) / 3;
          bodyFaces++;
          if (cy >= 0.7 && cy < 1.2 && Math.abs(cz) < 0.5) cabinInboard++;
          if (Math.abs(cz) >= 0.55) outboard++;
          if (cy >= 1.25 && cy <= 1.65 && Math.abs(cx) < 0.55 && Math.abs(cz) >= 0.35 && Math.abs(cz) <= 0.65) {
            roofRail++;
          }
        }
      }
    }
    // Pre-split ~13264; punch the full tire cylinder so Große Räder has no leftover shell.
    expect(bodyFaces).toBeGreaterThan(7200);
    expect(cabinInboard).toBeGreaterThan(2000);
    expect(outboard).toBeGreaterThan(900);
    expect(roofRail).toBeGreaterThan(80);
    for (const mesh of doc.getRoot().listMeshes()) {
      const name = mesh.getName() ?? "";
      if (!name.startsWith("StockWheel_")) continue;
      const verts = mesh.listPrimitives().reduce((n, p) => n + (p.getAttribute("POSITION")?.getCount() ?? 0), 0);
      const faces = mesh.listPrimitives().reduce((n, p) => {
        const idx = p.getIndices();
        return n + (idx ? idx.getCount() / 3 : 0);
      }, 0);
      expect(verts, name).toBeGreaterThan(1400);
      expect(verts, name).toBeLessThan(2800);
      expect(faces, name).toBeGreaterThan(800);
    }
  });

  it("ships Käferkraft with Tripo-segmented StockWheel_* (original buggy tires)", async () => {
    expect(existsSync("scripts/bake-kaeferkraft-segmented-parts.mjs")).toBe(true);
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/kaeferkraft.glb"),
    );
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_"))
      .sort();
    expect(names).toEqual(["StockWheel_FL", "StockWheel_FR", "StockWheel_RL", "StockWheel_RR"]);
    expect(doc.getRoot().listNodes().some((n) => n.getName() === "StockCage")).toBe(false);
    const bodyPaint = doc.getRoot().listMaterials().find((m) => m.getName() === "BodyPaint");
    const bodyTex = bodyPaint?.getBaseColorTexture();
    expect(bodyTex).toBeTruthy();
    for (const mesh of doc.getRoot().listMeshes()) {
      const name = mesh.getName() ?? "";
      if (!name.startsWith("StockWheel_")) continue;
      expect(mesh.listPrimitives().length, name).toBeGreaterThanOrEqual(1);
      expect(mesh.listPrimitives().every((p) => p.getMaterial()?.getName() === "Tire"), name).toBe(true);
      expect(
        mesh.listPrimitives().every((p) => p.getMaterial()?.getBaseColorTexture()),
        name,
      ).toBe(true);
      // Segment tire atlas + UVs — not Bison comic face disks (33 verts).
      expect(
        mesh.listPrimitives().some((p) => p.getAttribute("TEXCOORD_0")?.getCount() === 33),
        name,
      ).toBe(false);
      const rubberVerts = mesh
        .listPrimitives()
        .map((p) => p.getAttribute("POSITION")?.getCount() ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      expect(rubberVerts, `${name} rubber`).toBeGreaterThan(1400);
      for (const prim of mesh.listPrimitives()) {
        expect(prim.getAttribute("TEXCOORD_0"), `${name} UV`).toBeTruthy();
        const img = prim.getMaterial()?.getBaseColorTexture()?.getImage();
        const verts = prim.getAttribute("POSITION")?.getCount() ?? 0;
        expect(img?.byteLength, `${name} atlas`).toBeGreaterThan(verts > 800 ? 20_000 : 200);
        const head = img ? [...img.slice(0, 3)] : [];
        const jpeg = head[0] === 0xff && head[1] === 0xd8;
        const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e;
        expect(jpeg || png, `${name} atlas magic`).toBe(true);
      }
    }
    // Welded stock tires must be punched out of BodyPaint — otherwise Große Räder
    // scales StockWheel_* on top of leftover small wheels.
    const hubs = doc
      .getRoot()
      .listNodes()
      .filter((n) => n.getName()?.startsWith("StockWheel_"))
      .map((n) => {
        const mesh = n.getMesh()!;
        let min = [Infinity, Infinity, Infinity];
        let max = [-Infinity, -Infinity, -Infinity];
        let rubberVerts = 0;
        for (const prim of mesh.listPrimitives()) {
          const pos = prim.getAttribute("POSITION")!;
          const count = pos.getCount();
          if (count <= rubberVerts) continue;
          rubberVerts = count;
          min = [Infinity, Infinity, Infinity];
          max = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < count; i++) {
            const v = pos.getElement(i, []);
            for (let k = 0; k < 3; k++) {
              min[k] = Math.min(min[k]!, v[k]!);
              max[k] = Math.max(max[k]!, v[k]!);
            }
          }
        }
        const t = n.getTranslation();
        return {
          name: n.getName(),
          cx: t[0]! + (min[0]! + max[0]!) / 2,
          cy: t[1]! + (min[1]! + max[1]!) / 2,
          cz: t[2]! + (min[2]! + max[2]!) / 2,
          hx: (max[0]! - min[0]!) / 2,
          hy: (max[1]! - min[1]!) / 2,
          hz: (max[2]! - min[2]!) / 2,
        };
      });
    const leftover: Record<string, number> = {};
    const hubTube: Record<string, number> = {};
    for (const h of hubs) {
      leftover[h.name!] = 0;
      hubTube[h.name!] = 0;
    }
    for (const mesh of doc.getRoot().listMeshes()) {
      if (mesh.getName()?.startsWith("StockWheel_")) continue;
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMaterial()?.getName() !== "BodyPaint") continue;
        const pos = prim.getAttribute("POSITION")!;
        const idx = prim.getIndices();
        if (!pos || !idx) continue;
        for (let t = 0; t < idx.getCount() / 3; t++) {
          const a = pos.getElement(idx.getScalar(t * 3), []);
          const b = pos.getElement(idx.getScalar(t * 3 + 1), []);
          const c = pos.getElement(idx.getScalar(t * 3 + 2), []);
          const cx = (a[0]! + b[0]! + c[0]!) / 3;
          const cy = (a[1]! + b[1]! + c[1]!) / 3;
          const cz = (a[2]! + b[2]! + c[2]!) / 3;
          for (const h of hubs) {
            const dx = cx - h.cx;
            const dy = cy - h.cy;
            const dz = cz - h.cz;
            if (Math.abs(dx) <= h.hx && Math.abs(dy) <= h.hy && Math.abs(dz) <= h.hz) {
              leftover[h.name!]! += 1;
            }
            const radial = dx * dx + dy * dy;
            if (radial <= (h.hx * 0.55) ** 2 && Math.abs(dz) <= 0.3) {
              hubTube[h.name!]! += 1;
            }
          }
        }
      }
    }
    for (const h of hubs) {
      expect(leftover[h.name!], `${h.name} BodyPaint leftover`).toBeLessThan(40);
      expect(hubTube[h.name!], `${h.name} inner hub leftover`).toBeLessThan(40);
    }
  });

  it("ships other cars without StockWheel_* (tires still welded)", async () => {
    for (const id of ["blitz", "donnerbuechse", "bunker"] as const) {
      const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
        resolve(`public/models/cars/${id}.glb`),
      );
      const names = doc
        .getRoot()
        .listNodes()
        .map((n) => n.getName())
        .filter((n) => n?.startsWith("StockWheel_"));
      expect(names, id).toEqual([]);
    }
  });

  it("Große Räder mounts procedural UpgradeTire overlays except Bison/Käferkraft", () => {
    for (const id of CAR_IDS as CarId[]) {
      if (id === "bison" || id === "kaeferkraft") continue;
      const hints = CAR_PART_LAYOUTS[id].wheelHints;
      expect(hints.length, id).toBe(4);
      const root = new Group();
      applyEquippedPartVisuals(root, id, ["big_wheels"]);
      expect(root.getObjectByName(blitzPartObjectName("big_wheels")), id).toBeTruthy();
      expect(root.getObjectByName("UpgradeTire"), id).toBeTruthy();
      applyEquippedPartVisuals(root, id, []);
      expect(root.getObjectByName(blitzPartObjectName("big_wheels")), id).toBeFalsy();
    }
  });

  it("Bison Große Räder scales StockWheel_* instead of procedural tires", () => {
    expect(CAR_PART_LAYOUTS.bison.wheelHints).toHaveLength(0);
    expect(BISON_BIG_WHEEL_SCALE).toBeCloseTo(1.35);
    const root = new Group();
    for (const corner of ["FL", "FR", "RL", "RR"] as const) {
      const stock = new Mesh(new BoxGeometry(0.4, 0.5, 0.4), new MeshBasicMaterial());
      stock.name = stockWheelName(corner);
      stock.userData.isStockWheel = true;
      stock.position.y = BISON_STOCK_WHEEL_RADIUS;
      const prim = new Mesh(new BoxGeometry(0.4, 0.5, 0.4), new MeshBasicMaterial());
      prim.name = `${stockWheelName(corner)}_1`;
      stock.add(prim);
      root.add(stock);
    }
    applyStockPartVisibility(root, "bison", []);
    expect(root.children[0]!.scale.x).toBeCloseTo(1);
    applyStockPartVisibility(root, "bison", ["big_wheels"]);
    expect(root.children[0]!.scale.x).toBeCloseTo(BISON_BIG_WHEEL_SCALE);
    expect(root.children[0]!.position.y).toBeCloseTo(
      BISON_STOCK_WHEEL_RADIUS - bisonBigWheelHubDrop(),
    );
    applyEquippedPartVisuals(root, "bison", ["big_wheels"]);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
    expect(root.getObjectByName("UpgradeTire")).toBeFalsy();
  });

  it("Käferkraft Große Räder scales StockWheel_* instead of procedural tires", () => {
    expect(CAR_PART_LAYOUTS.kaeferkraft.wheelHints).toHaveLength(0);
    expect(KAEFERKRAFT_BIG_WHEEL_SCALE).toBeCloseTo(BISON_BIG_WHEEL_SCALE);
    const root = new Group();
    for (const corner of ["FL", "FR", "RL", "RR"] as const) {
      const stock = new Mesh(new BoxGeometry(0.35, 0.8, 0.8), new MeshBasicMaterial());
      stock.name = stockWheelName(corner);
      stock.userData.isStockWheel = true;
      stock.position.y = KAEFERKRAFT_STOCK_WHEEL_RADIUS;
      root.add(stock);
    }
    applyStockPartVisibility(root, "kaeferkraft", []);
    expect(root.children[0]!.scale.x).toBeCloseTo(1);
    applyStockPartVisibility(root, "kaeferkraft", ["big_wheels"]);
    expect(root.children[0]!.scale.x).toBeCloseTo(KAEFERKRAFT_BIG_WHEEL_SCALE);
    expect(root.children[0]!.position.y).toBeCloseTo(
      KAEFERKRAFT_STOCK_WHEEL_RADIUS - kaeferkraftBigWheelHubDrop(),
    );
    applyEquippedPartVisuals(root, "kaeferkraft", ["big_wheels"]);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
    expect(root.getObjectByName("UpgradeTire")).toBeFalsy();
  });

  it("Bison hub drop keeps ground contact when arch clearance is zero", () => {
    const drop = bisonBigWheelHubDrop();
    expect(drop).toBeCloseTo(
      BISON_STOCK_WHEEL_RADIUS * (BISON_BIG_WHEEL_SCALE - 1) + BISON_BIG_WHEEL_ARCH_CLEARANCE,
    );
    const stockTop = BISON_STOCK_WHEEL_RADIUS * 2;
    const scaledTop =
      BISON_STOCK_WHEEL_RADIUS - drop + BISON_STOCK_WHEEL_RADIUS * BISON_BIG_WHEEL_SCALE;
    expect(scaledTop).toBeCloseTo(stockTop - BISON_BIG_WHEEL_ARCH_CLEARANCE);
    expect(CAR_PART_LAYOUTS.bison.wheelLift).toBeCloseTo(
      drop + BISON_STOCK_WHEEL_RADIUS * (BISON_BIG_WHEEL_SCALE - 1),
    );
  });

  it("groundContactMinY prefers tires over low invisible FX debris", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.4, 0.5, 0.4), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    stock.userData.isStockWheel = true;
    stock.position.set(-0.7, 0.25, 1.0);
    root.add(stock);
    const fx = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshBasicMaterial());
    fx.visible = false;
    fx.position.set(0, -0.2, 0);
    const fxGroup = new Group();
    fxGroup.name = "fx-smoke";
    fxGroup.add(fx);
    root.add(fxGroup);
    root.updateMatrixWorld(true);
    const fullMin = new Box3().setFromObject(root).min.y;
    const contact = groundContactMinY(root);
    expect(contact).toBeGreaterThan(fullMin);
    expect(contact).toBeCloseTo(0, 2);
  });

  it("Blitz upgrade tires are wider (not taller stance)", () => {
    expect(carStanceLift("blitz", ["big_wheels"])).toBeCloseTo(BLITZ_WHEEL_LIFT);
    expect(BLITZ_WHEEL_LIFT).toBeLessThan(0.05);
    const w = buildUpgradeWheel({ radius: 0.32, width: 0.4 });
    expect(w.getObjectByName("UpgradeTire")).toBeTruthy();
  });

  it("Bison Gelände-Federung lifts stance without enlarging StockWheel_*", () => {
    expect(carStanceLift("bunker", ["offroad_suspension"])).toBe(0);
    expect(carStanceLift("bison", ["offroad_suspension"])).toBeCloseTo(
      CAR_PART_LAYOUTS.bison.suspensionLift,
    );
    expect(carStanceLift("bison", ["big_wheels", "offroad_suspension"])).toBeCloseTo(
      CAR_PART_LAYOUTS.bison.wheelLift + CAR_PART_LAYOUTS.bison.suspensionLift,
    );
  });

  it("Bison Gelände-Federung mounts Blitz springs without scaling StockWheel_*", () => {
    const root = new Group();
    for (const corner of ["FL", "FR", "RL", "RR"] as const) {
      const stock = new Mesh(new BoxGeometry(0.4, 0.5, 0.4), new MeshBasicMaterial());
      stock.name = stockWheelName(corner);
      stock.userData.isStockWheel = true;
      stock.position.y = BISON_STOCK_WHEEL_RADIUS;
      root.add(stock);
    }
    registerCarPartTemplate(
      "bison",
      "offroad_suspension",
      (() => {
        const g = new Group();
        g.add(new Mesh(new BoxGeometry(0.1, 0.3, 0.1), new MeshBasicMaterial()));
        return g;
      })(),
    );
    applyStockPartVisibility(root, "bison", ["offroad_suspension"]);
    expect(root.children[0]!.scale.x).toBeCloseTo(1);
    expect(root.children[0]!.position.y).toBeCloseTo(BISON_STOCK_WHEEL_RADIUS);
    applyEquippedPartVisuals(root, "bison", ["offroad_suspension"]);
    expect(root.getObjectByName(blitzPartObjectName("offroad_suspension"))).toBeTruthy();
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
  });

  it("places Bison shocks inboard of the tire face at stock hub height", () => {
    const hubs = [
      { x: 0.669, z: 1.13 },
      { x: -0.669, z: 1.13 },
      { x: 0.669, z: -1.052 },
      { x: -0.669, z: -1.052 },
    ];
    const hubY = BISON_STOCK_WHEEL_RADIUS;
    const innerTireFace = 0.55;
    const springs = CAR_PART_LAYOUTS.bison.springs;
    expect(springs).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const s = springs[i]!;
      const h = hubs[i]!;
      expect(s.y).toBeCloseTo(hubY, 3);
      expect(s.z).toBeCloseTo(h.z, 2);
      expect(Math.abs(s.x)).toBeLessThan(innerTireFace);
      expect(Math.abs(s.x)).toBeGreaterThan(0.35);
    }
  });
});

describe("StockWheel spin + front steer", () => {
  function stockWheelCar(): Group {
    const root = new Group();
    const spots: Array<[string, number, number, number]> = [
      ["StockWheel_FL", -0.67, 0.32, 1.13],
      ["StockWheel_FR", 0.67, 0.32, 1.13],
      ["StockWheel_RL", -0.67, 0.32, -1.05],
      ["StockWheel_RR", 0.67, 0.32, -1.05],
    ];
    for (const [name, x, y, z] of spots) {
      const mesh = new Mesh(new BoxGeometry(0.22, 0.64, 0.64), new MeshBasicMaterial({ name: "Tire" }));
      mesh.name = name;
      mesh.userData.isStockWheel = true;
      mesh.position.set(x, y, z);
      root.add(mesh);
    }
    return root;
  }

  it("wraps four StockWheel_* into WheelSteer_/WheelSpin_ hubs", () => {
    const root = stockWheelCar();
    const wheels = mountCarWheels(root);
    expect(wheels).toHaveLength(4);
    expect(wheels.filter((w) => w.isFront)).toHaveLength(2);
    expect(collectSpinMounts(root)).toHaveLength(4);
    expect(root.getObjectByName("WheelSteer_FL")).toBeTruthy();
    expect(root.getObjectByName("WheelSpin_RR")).toBeTruthy();
    expect(root.getObjectByName("StockWheel_FL")?.parent?.name).toBe("WheelSpin_FL");
  });

  it("rolls faster at higher speed and reverses with negative speed", () => {
    const wheels = mountCarWheels(stockWheelCar());
    const a0 = wheels[0]!.spinner.rotation.x;
    spinCarWheels(wheels, 10, 1 / 60);
    const a1 = wheels[0]!.spinner.rotation.x;
    expect(a1).toBeGreaterThan(a0);
    spinCarWheels(wheels, 20, 1 / 60);
    const a2 = wheels[0]!.spinner.rotation.x;
    expect(a2 - a1).toBeGreaterThan(a1 - a0);
    spinCarWheels(wheels, -20, 1 / 60);
    expect(wheels[0]!.spinner.rotation.x).toBeLessThan(a2);
  });

  it("yaws only the front pair opposite the stick (visual fix)", () => {
    const wheels = mountCarWheels(stockWheelCar());
    spinCarWheels(wheels, 8, 1 / 60, 1);
    expect(steerYawFromInput(1)).toBeCloseTo(-MAX_STEER_YAW);
    for (const w of wheels) {
      if (w.isFront) expect(w.steer.rotation.y).toBeCloseTo(-MAX_STEER_YAW);
      else expect(w.steer.rotation.y).toBe(0);
    }
  });

  it("picks the thinnest local AABB axis as the roll axle (Käferkraft-style Z)", () => {
    const mesh = new Mesh(new BoxGeometry(0.8, 0.8, 0.3), new MeshBasicMaterial({ name: "Tire" }));
    expect(wheelMetrics(mesh).axis).toBe(2);

    const full = stockWheelCar();
    const fl = full.getObjectByName("StockWheel_FL") as Mesh;
    fl.geometry.dispose();
    fl.geometry = new BoxGeometry(0.8, 0.8, 0.28);
    const mounts = mountCarWheels(full);
    const frontLeft = mounts.find((w) => w.spinner.name === "WheelSpin_FL")!;
    expect(frontLeft.axis).toBe(2);
    const z0 = frontLeft.spinner.rotation.z;
    spinCarWheels(mounts, 10, 1 / 60);
    // Z-axle roll is negated vs X-axle (Käferkraft visual forward).
    expect(frontLeft.spinner.rotation.z).toBeLessThan(z0);
    expect(frontLeft.spinner.rotation.x).toBe(0);
  });

  it("keeps Z axle under parent yaw π/2 (Käferkraft Scene) — not world-AABB X", () => {
    const scene = new Group();
    scene.rotation.y = Math.PI / 2;
    const spots: Array<[string, number, number, number]> = [
      ["StockWheel_FL", -1.2, 0.4, -0.78],
      ["StockWheel_FR", -1.18, 0.4, 0.77],
      ["StockWheel_RL", 1.2, 0.4, -0.78],
      ["StockWheel_RR", 1.2, 0.4, 0.78],
    ];
    for (const [name, x, y, z] of spots) {
      // Thin along local Z like shipped Käferkraft StockWheel bake
      const mesh = new Mesh(new BoxGeometry(0.82, 0.82, 0.33), new MeshBasicMaterial({ name: "Tire" }));
      mesh.name = name;
      mesh.userData.isStockWheel = true;
      mesh.position.set(x, y, z);
      scene.add(mesh);
    }
    scene.updateMatrixWorld(true);
    // World AABB would look X-thin after yaw — local metrics must still say Z.
    expect(wheelMetrics(scene.getObjectByName("StockWheel_FL")!).axis).toBe(2);
    const mounts = mountCarWheels(scene);
    expect(mounts).toHaveLength(4);
    expect(mounts.every((w) => w.axis === 2)).toBe(true);
  });

  it("maps heading delta to a clamped steer", () => {
    expect(steerFromHeadingDelta(0, 0.1)).toBeGreaterThan(0);
    expect(steerFromHeadingDelta(0, -0.1)).toBeLessThan(0);
    expect(steerFromHeadingDelta(0, 2)).toBe(1);
  });

  it("keeps Große Räder scale after mount (hub drop baked into steer)", () => {
    const root = stockWheelCar();
    applyEquippedPartVisuals(root, "bison", ["big_wheels"]);
    const beforeY = root.getObjectByName("StockWheel_FL")!.position.y;
    expect(beforeY).toBeCloseTo(BISON_STOCK_WHEEL_RADIUS - bisonBigWheelHubDrop());
    const wheels = mountCarWheels(root);
    expect(wheels).toHaveLength(4);
    const fl = root.getObjectByName("StockWheel_FL")!;
    expect(fl.scale.x).toBeCloseTo(BISON_BIG_WHEEL_SCALE);
    expect(fl.position.y).toBeCloseTo(0);
    expect(root.getObjectByName("WheelSteer_FL")!.position.y).toBeCloseTo(beforeY);
  });

  it("Käferkraft Große Räder keeps scale after mount like Bison", () => {
    const root = new Group();
    for (const [name, x, y, z] of [
      ["StockWheel_FL", -1.23, KAEFERKRAFT_STOCK_WHEEL_RADIUS, -0.79],
      ["StockWheel_FR", -1.18, KAEFERKRAFT_STOCK_WHEEL_RADIUS, 0.77],
      ["StockWheel_RL", 1.21, KAEFERKRAFT_STOCK_WHEEL_RADIUS, -0.78],
      ["StockWheel_RR", 1.2, KAEFERKRAFT_STOCK_WHEEL_RADIUS, 0.78],
    ] as const) {
      // Thin Z = axle (Käferkraft bake), wide XY = tire disk.
      const mesh = new Mesh(new BoxGeometry(0.82, 0.82, 0.38), new MeshBasicMaterial({ name: "Tire" }));
      mesh.name = name;
      mesh.userData.isStockWheel = true;
      mesh.position.set(x, y, z);
      root.add(mesh);
    }
    applyEquippedPartVisuals(root, "kaeferkraft", ["big_wheels"]);
    const beforeY = root.getObjectByName("StockWheel_FL")!.position.y;
    expect(beforeY).toBeCloseTo(KAEFERKRAFT_STOCK_WHEEL_RADIUS - kaeferkraftBigWheelHubDrop());
    const wheels = mountCarWheels(root);
    expect(wheels).toHaveLength(4);
    const fl = root.getObjectByName("StockWheel_FL")!;
    expect(fl.scale.x).toBeCloseTo(KAEFERKRAFT_BIG_WHEEL_SCALE);
    expect(fl.position.y).toBeCloseTo(0);
    expect(root.getObjectByName("WheelSteer_FL")!.position.y).toBeCloseTo(beforeY);
    expect(wheels.find((w) => w.spinner.name === "WheelSpin_FL")!.axis).toBe(2);
  });
});

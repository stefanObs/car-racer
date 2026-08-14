import { existsSync, readFileSync } from "node:fs";
import { Box3, BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshToonMaterial } from "three";
import { describe, expect, it } from "vitest";
import { CAR_IDS, type CarId } from "../src/data/cars";
import { carSupportsPart, partsForCar } from "../src/data/partsCatalog";
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
  partGlbUrl,
  registerCarPartTemplate,
} from "../src/render/carParts";
import { collectWheelUvTriangles, shouldApplyGaragePaint } from "../src/render/loadCarGltf";
import { groundContactMinY, stockWheelName } from "../src/render/stockWheels";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

describe("parts catalog (per-car)", () => {
  it("keeps Gelände-Federung on Blitz and Bison (Blitz Tripo springs)", () => {
    expect(carSupportsPart("blitz", "offroad_suspension")).toBe(true);
    expect(carSupportsPart("bison", "offroad_suspension")).toBe(true);
    expect(existsSync("public/models/parts/blitz-offroad_suspension.glb")).toBe(true);
    expect(partsForCar("bison")).toContain("offroad_suspension");
    expect(CAR_PART_LAYOUTS.bison.springs).toHaveLength(4);
    expect(partGlbUrl("bison", "offroad_suspension")).toBe("/models/parts/blitz-offroad_suspension.glb");
    for (const id of CAR_IDS as CarId[]) {
      if (id === "blitz" || id === "bison") continue;
      expect(carSupportsPart(id, "offroad_suspension")).toBe(false);
      expect(partsForCar(id)).not.toContain("offroad_suspension");
      expect(CAR_PART_LAYOUTS[id].springs).toHaveLength(0);
    }
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

  it("ships Käferkraft with Tripo-segmented StockWheel_* + StockCage (authored maps)", async () => {
    expect(existsSync("scripts/bake-kaeferkraft-segmented-parts.mjs")).toBe(true);
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/kaeferkraft.glb"),
    );
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_") || n === "StockCage")
      .sort();
    expect(names).toEqual([
      "StockCage",
      "StockWheel_FL",
      "StockWheel_FR",
      "StockWheel_RL",
      "StockWheel_RR",
    ]);
    // Remount must keep Tripo segment albedo + UVs (not bison comic / flat grey).
    for (const mesh of doc.getRoot().listMeshes()) {
      const name = mesh.getName() ?? "";
      if (!name.startsWith("StockWheel_") && name !== "StockCage") continue;
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial();
        expect(mat?.getBaseColorTexture(), name).toBeTruthy();
        expect(prim.getAttribute("TEXCOORD_0"), name).toBeTruthy();
        if (name.startsWith("StockWheel_")) expect(mat?.getName()).toBe("Tire");
        else expect(mat?.getName()).toBe("StockCage");
      }
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

  it("Große Räder mounts procedural UpgradeTire overlays except Bison", () => {
    for (const id of CAR_IDS as CarId[]) {
      if (id === "bison") continue;
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
      // GLTF multi-primitive child (must not get a second scale).
      const prim = new Mesh(new BoxGeometry(0.4, 0.5, 0.4), new MeshBasicMaterial());
      prim.name = `${stockWheelName(corner)}_1`;
      stock.add(prim);
      root.add(stock);
    }
    applyStockPartVisibility(root, "bison", []);
    expect(root.children[0]!.scale.x).toBeCloseTo(1);
    expect(root.children[0]!.position.y).toBeCloseTo(BISON_STOCK_WHEEL_RADIUS);
    expect(root.children[0]!.children[0]!.scale.x).toBeCloseTo(1);
    applyStockPartVisibility(root, "bison", ["big_wheels"]);
    expect(root.children[0]!.scale.x).toBeCloseTo(BISON_BIG_WHEEL_SCALE);
    expect(root.children[0]!.position.y).toBeCloseTo(
      BISON_STOCK_WHEEL_RADIUS - bisonBigWheelHubDrop(),
    );
    expect(root.children[0]!.children[0]!.scale.x).toBeCloseTo(1);
    applyEquippedPartVisuals(root, "bison", ["big_wheels"]);
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
    // Inner tire face ~|x|0.55 — keep coils inside so they are not seen through the rim.
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

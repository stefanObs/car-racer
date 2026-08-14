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
} from "../src/render/carParts";
import { collectWheelUvTriangles, shouldApplyGaragePaint } from "../src/render/loadCarGltf";
import { groundContactMinY, stockWheelName } from "../src/render/stockWheels";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

describe("parts catalog (per-car)", () => {
  it("keeps Gelände-Federung only on Blitz (has Tripo spring kit)", () => {
    expect(carSupportsPart("blitz", "offroad_suspension")).toBe(true);
    expect(existsSync("public/models/parts/blitz-offroad_suspension.glb")).toBe(true);
    for (const id of CAR_IDS as CarId[]) {
      if (id === "blitz") continue;
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

  it("ships other cars without StockWheel_* (tires still welded)", async () => {
    for (const id of ["blitz", "kaeferkraft", "donnerbuechse", "bunker"] as const) {
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
    expect(BISON_BIG_WHEEL_SCALE).toBeCloseTo(1.2);
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

  it("Bison hub drop clears the wheel arch under scale", () => {
    const drop = bisonBigWheelHubDrop();
    expect(drop).toBeCloseTo(
      BISON_STOCK_WHEEL_RADIUS * (BISON_BIG_WHEEL_SCALE - 1) + BISON_BIG_WHEEL_ARCH_CLEARANCE,
    );
    const stockTop = BISON_STOCK_WHEEL_RADIUS * 2;
    const scaledTop =
      BISON_STOCK_WHEEL_RADIUS - drop + BISON_STOCK_WHEEL_RADIUS * BISON_BIG_WHEEL_SCALE;
    expect(scaledTop).toBeLessThan(stockTop);
    expect(stockTop - scaledTop).toBeCloseTo(BISON_BIG_WHEEL_ARCH_CLEARANCE);
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

  it("non-Blitz cars get no offroad suspension lift", () => {
    expect(carStanceLift("bunker", ["offroad_suspension"])).toBe(0);
    expect(carStanceLift("bison", ["big_wheels", "offroad_suspension"])).toBe(
      CAR_PART_LAYOUTS.bison.wheelLift,
    );
  });
});

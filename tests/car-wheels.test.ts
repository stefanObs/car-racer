import { existsSync, readFileSync } from "node:fs";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { CAR_IDS, type CarId } from "../src/data/cars";
import { carSupportsPart, partsForCar } from "../src/data/partsCatalog";
import { buildUpgradeWheel } from "../src/render/carPartBuilders";
import {
  applyEquippedPartVisuals,
  applyStockPartVisibility,
  blitzPartObjectName,
  BLITZ_WHEEL_LIFT,
  BLITZ_BIG_WHEEL_SCALE,
  CAR_PART_LAYOUTS,
  carStanceLift,
  KAEFERKRAFT_BIG_WHEEL_SCALE,
  DONNER_BIG_WHEEL_SCALE,
  BUNKER_BIG_WHEEL_SCALE,
} from "../src/render/carParts";
import { shouldApplyGaragePaint } from "../src/render/loadCarGltf";
import {
  applyStockWheelScale,
  extractStockWheels,
  groundContactMinY,
  hasAuthoredStockWheels,
  stockWheelName,
} from "../src/render/stockWheels";
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

  it("load path extracts stock wheels from car GLBs", () => {
    const load = readFileSync("src/render/loadCarGltf.ts", "utf8");
    expect(load).toContain("extractStockWheels");
  });

  it("Blitz Große Räder scales detached StockWheel_* (no procedural UpgradeTire)", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    stock.userData.isStockWheel = true;
    root.add(stock);

    applyEquippedPartVisuals(root, "blitz", ["big_wheels"]);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(BLITZ_BIG_WHEEL_SCALE);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
    expect(root.getObjectByName("UpgradeTire")).toBeFalsy();

    // Empty equip keeps original StockWheel extracts visible at scale 1.
    applyEquippedPartVisuals(root, "blitz", []);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(1);
    expect(root.getObjectByName(blitzPartObjectName("stock_tires"))).toBeFalsy();
  });

  it("Bison hides stock wheels and mounts upgrade tires for big_wheels", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    stock.userData.isStockWheel = true;
    root.add(stock);

    applyEquippedPartVisuals(root, "bison", ["big_wheels"]);
    expect(stock.visible).toBe(false);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeTruthy();
    expect(root.getObjectByName("UpgradeTire")).toBeTruthy();

    applyEquippedPartVisuals(root, "bison", []);
    expect(stock.visible).toBe(true);
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
    // Tire box height 0.5 centered at y=0.25 → bottom at 0.
    expect(contact).toBeCloseTo(0, 2);
  });

  it("skips garage paint on StockWheel mesh names", () => {
    expect(shouldApplyGaragePaint("StockWheel_FL")).toBe(false);
    expect(shouldApplyGaragePaint("Tire")).toBe(false);
    expect(shouldApplyGaragePaint("BodyPaint")).toBe(true);
  });

  it("keeps Blitz StockWheel extracts when no big_wheels (original car tires)", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    stock.userData.isStockWheel = true;
    root.add(stock);

    applyEquippedPartVisuals(root, "blitz", []);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(1);
    expect(root.getObjectByName(blitzPartObjectName("stock_tires"))).toBeFalsy();

    applyEquippedPartVisuals(root, "blitz", ["big_wheels"]);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(BLITZ_BIG_WHEEL_SCALE);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
  });

  it("Blitz upgrade-style cylinders are unused; stock scale is the Große Räder path", () => {
    expect(BLITZ_BIG_WHEEL_SCALE).toBeGreaterThan(1.1);
    expect(BLITZ_BIG_WHEEL_SCALE).toBeLessThan(1.5);
    const bison = buildUpgradeWheel({ radius: 0.46, width: 0.34 });
    expect(bison.getObjectByName("UpgradeTire")).toBeTruthy();
  });

  it("Blitz stance lift for big_wheels is small (wider, not taller)", () => {
    expect(carStanceLift("blitz", ["big_wheels"])).toBeCloseTo(BLITZ_WHEEL_LIFT);
    expect(BLITZ_WHEEL_LIFT).toBeLessThan(0.05);
  });

  it("non-Blitz cars get no offroad suspension lift", () => {
    expect(carStanceLift("bunker", ["offroad_suspension"])).toBe(0);
    expect(carStanceLift("bison", ["big_wheels", "offroad_suspension"])).toBe(
      CAR_PART_LAYOUTS.bison.wheelLift,
    );
  });

  it("applyStockPartVisibility scales Blitz stock wheels with big_wheels", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial());
    stock.name = stockWheelName("RR");
    stock.userData.isStockWheel = true;
    root.add(stock);
    applyStockPartVisibility(root, "blitz", ["big_wheels"]);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(BLITZ_BIG_WHEEL_SCALE);
    applyStockPartVisibility(root, "blitz", []);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(1);
  });

  it("Käferkraft ships baked StockWheel_* and skips re-extract", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/kaeferkraft.glb"),
    );
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_"));
    expect(names.sort()).toEqual(["StockWheel_FL", "StockWheel_FR", "StockWheel_RL", "StockWheel_RR"]);

    const root = new Group();
    for (const corner of ["FL", "FR", "RL", "RR"] as const) {
      const m = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshBasicMaterial());
      m.name = stockWheelName(corner);
      root.add(m);
    }
    expect(hasAuthoredStockWheels(root)).toBe(true);
    extractStockWheels(root);
    expect(root.userData.stockWheelsExtracted).toBe(true);
    // Still exactly four authored wheels — no runtime split extras.
    let count = 0;
    root.traverse((o) => {
      if (o.name.startsWith("StockWheel_")) count++;
    });
    expect(count).toBe(4);
  });

  it("Blitz ships baked StockWheel_* and keeps mid-side body faces", async () => {
    expect(existsSync("scripts/extract-blitz-stock-wheels.mjs")).toBe(true);
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/blitz.glb"),
    );
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_"));
    expect(names.sort()).toEqual(["StockWheel_FL", "StockWheel_FR", "StockWheel_RL", "StockWheel_RR"]);

    let midSide = 0;
    let bodyFaces = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      if (mesh.getName()?.startsWith("StockWheel_")) continue;
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        const idx = prim.getIndices();
        if (!pos || !idx) continue;
        const tri = idx.getCount() / 3;
        bodyFaces += tri;
        for (let t = 0; t < tri; t++) {
          const i0 = idx.getScalar(t * 3);
          const i1 = idx.getScalar(t * 3 + 1);
          const i2 = idx.getScalar(t * 3 + 2);
          const a = pos.getElement(i0, []);
          const b = pos.getElement(i1, []);
          const c = pos.getElement(i2, []);
          const cx = (a[0] + b[0] + c[0]) / 3;
          const cy = (a[1] + b[1] + c[1]) / 3;
          const cz = (a[2] + b[2] + c[2]) / 3;
          if (Math.abs(cz) < 0.7 && Math.abs(cx) > 0.55 && cy > 0.15 && cy < 0.7) midSide++;
        }
      }
    }
    expect(bodyFaces).toBeGreaterThan(3500);
    expect(midSide).toBeGreaterThan(150);
  });

  it("Käferkraft Große Räder scales stock wheels instead of UpgradeTire", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    root.add(stock);

    applyEquippedPartVisuals(root, "kaeferkraft", ["big_wheels"]);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(KAEFERKRAFT_BIG_WHEEL_SCALE);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
    expect(root.getObjectByName("UpgradeTire")).toBeFalsy();

    applyEquippedPartVisuals(root, "kaeferkraft", []);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(1);
  });

  it("Donnerbüchse ships baked StockWheel_* (dark tires) and scales them for Große Räder", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/donnerbuechse.glb"),
    );
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_"));
    expect(names.sort()).toEqual(["StockWheel_FL", "StockWheel_FR", "StockWheel_RL", "StockWheel_RR"]);
    for (const n of doc.getRoot().listNodes()) {
      if (!n.getName()?.startsWith("StockWheel_")) continue;
      expect(n.getMesh()?.listPrimitives()[0]?.getMaterial()?.getName()).toBe("Tire");
    }

    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("RR");
    root.add(stock);
    applyEquippedPartVisuals(root, "donnerbuechse", ["big_wheels"]);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(DONNER_BIG_WHEEL_SCALE);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
    applyEquippedPartVisuals(root, "donnerbuechse", []);
    expect(stock.scale.x).toBeCloseTo(1);
  });

  it("Bunker ships baked StockWheel_* (grey tires) and scales them for Große Räder", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/bunker.glb"),
    );
    const names = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_"));
    expect(names.sort()).toEqual(["StockWheel_FL", "StockWheel_FR", "StockWheel_RL", "StockWheel_RR"]);
    for (const n of doc.getRoot().listNodes()) {
      if (!n.getName()?.startsWith("StockWheel_")) continue;
      expect(n.getMesh()?.listPrimitives()[0]?.getMaterial()?.getName()).toBe("Tire");
    }

    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    root.add(stock);
    applyEquippedPartVisuals(root, "bunker", ["big_wheels"]);
    expect(stock.visible).toBe(true);
    expect(stock.scale.x).toBeCloseTo(BUNKER_BIG_WHEEL_SCALE);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeFalsy();
    expect(root.getObjectByName("UpgradeTire")).toBeFalsy();
    applyEquippedPartVisuals(root, "bunker", []);
    expect(stock.scale.x).toBeCloseTo(1);
  });

  it("applyStockWheelScale is uniform on StockWheel meshes", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial());
    stock.name = stockWheelName("RL");
    root.add(stock);
    applyStockWheelScale(root, 1.5);
    expect(stock.scale.x).toBeCloseTo(1.5);
    expect(stock.scale.y).toBeCloseTo(1.5);
    expect(stock.scale.z).toBeCloseTo(1.5);
  });
});

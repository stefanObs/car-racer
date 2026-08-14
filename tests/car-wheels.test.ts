import { existsSync, readFileSync } from "node:fs";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, type Mesh as MeshType } from "three";
import { describe, expect, it } from "vitest";
import { CAR_IDS, type CarId } from "../src/data/cars";
import { carSupportsPart, partsForCar } from "../src/data/partsCatalog";
import { buildUpgradeWheel } from "../src/render/carPartBuilders";
import {
  applyEquippedPartVisuals,
  applyStockPartVisibility,
  blitzPartObjectName,
  BLITZ_WHEEL_LIFT,
  CAR_PART_LAYOUTS,
  carStanceLift,
  KAEFERKRAFT_BIG_WHEEL_SCALE,
  DONNER_BIG_WHEEL_SCALE,
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

  it("drops Bessere Bremsen on Blitz, Bison, and Käferkraft; keeps big_wheels on every car", () => {
    for (const id of ["blitz", "bison", "kaeferkraft"] as CarId[]) {
      expect(carSupportsPart(id, "better_brakes")).toBe(false);
      expect(partsForCar(id)).not.toContain("better_brakes");
      expect(CAR_PART_LAYOUTS[id].brakes).toHaveLength(0);
    }
    for (const id of CAR_IDS as CarId[]) {
      if (id !== "blitz" && id !== "bison" && id !== "kaeferkraft") {
        expect(partsForCar(id)).toContain("better_brakes");
      }
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

  it("hides stock wheels and mounts upgrade tires for big_wheels", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    stock.userData.isStockWheel = true;
    root.add(stock);

    applyEquippedPartVisuals(root, "blitz", ["big_wheels"]);
    expect(stock.visible).toBe(false);
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeTruthy();
    expect(root.getObjectByName("UpgradeTire")).toBeTruthy();

    // Empty equip keeps original StockWheel extracts visible (no procedural stand-ins).
    applyEquippedPartVisuals(root, "blitz", []);
    expect(stock.visible).toBe(true);
    expect(root.getObjectByName(blitzPartObjectName("stock_tires"))).toBeFalsy();
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
    expect(root.getObjectByName(blitzPartObjectName("stock_tires"))).toBeFalsy();

    applyEquippedPartVisuals(root, "blitz", ["big_wheels"]);
    expect(stock.visible).toBe(false);
    expect(root.getObjectByName(blitzPartObjectName("stock_tires"))).toBeFalsy();
    expect(root.getObjectByName(blitzPartObjectName("big_wheels"))).toBeTruthy();
  });

  it("Blitz upgrade wheels are wider than bunker meats", () => {
    const blitz = buildUpgradeWheel({ radius: 0.32, width: 0.4 });
    const bunker = buildUpgradeWheel({ radius: 0.46, width: 0.34 });
    const bTire = blitz.getObjectByName("UpgradeTire") as MeshType & {
      geometry: { parameters: { height: number; radiusTop: number } };
    };
    const uTire = bunker.getObjectByName("UpgradeTire") as MeshType & {
      geometry: { parameters: { height: number; radiusTop: number } };
    };
    expect(bTire.geometry.parameters.height).toBeGreaterThan(uTire.geometry.parameters.height);
    expect(uTire.geometry.parameters.radiusTop).toBeGreaterThan(bTire.geometry.parameters.radiusTop);
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

  it("applyStockPartVisibility toggles stock wheels with big_wheels", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial());
    stock.name = stockWheelName("RR");
    stock.userData.isStockWheel = true;
    root.add(stock);
    applyStockPartVisibility(root, "blitz", ["big_wheels"]);
    expect(stock.visible).toBe(false);
    applyStockPartVisibility(root, "blitz", []);
    expect(stock.visible).toBe(true);
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

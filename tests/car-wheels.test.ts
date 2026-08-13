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
} from "../src/render/carParts";
import { shouldApplyGaragePaint } from "../src/render/loadCarGltf";
import { groundContactMinY, stockWheelName } from "../src/render/stockWheels";

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

  it("drops Bessere Bremsen on Blitz; keeps big_wheels on every car", () => {
    expect(carSupportsPart("blitz", "better_brakes")).toBe(false);
    expect(partsForCar("blitz")).not.toContain("better_brakes");
    expect(CAR_PART_LAYOUTS.blitz.brakes).toHaveLength(0);
    for (const id of CAR_IDS as CarId[]) {
      if (id !== "blitz") expect(partsForCar(id)).toContain("better_brakes");
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

    // Empty equip on Blitz still hides broken extracts and mounts floor stand-ins.
    applyEquippedPartVisuals(root, "blitz", []);
    expect(stock.visible).toBe(false);
    expect(root.getObjectByName(blitzPartObjectName("stock_tires"))).toBeTruthy();
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

  it("mounts Blitz stock tire stand-ins on the ground when extracts exist", () => {
    const root = new Group();
    const stock = new Mesh(new BoxGeometry(0.3, 0.5, 0.5), new MeshBasicMaterial());
    stock.name = stockWheelName("FL");
    stock.userData.isStockWheel = true;
    root.add(stock);

    applyEquippedPartVisuals(root, "blitz", []);
    expect(stock.visible).toBe(false);
    expect(root.getObjectByName(blitzPartObjectName("stock_tires"))).toBeTruthy();
    expect(root.getObjectByName("UpgradeTire")).toBeTruthy();

    applyEquippedPartVisuals(root, "blitz", ["big_wheels"]);
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
});

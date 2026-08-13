import { existsSync, readFileSync } from "node:fs";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Mesh as MeshType } from "three";
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
import { stockWheelName } from "../src/render/stockWheels";

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

  it("keeps better_brakes and big_wheels on every car", () => {
    for (const id of CAR_IDS as CarId[]) {
      expect(partsForCar(id)).toContain("better_brakes");
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

    applyEquippedPartVisuals(root, "blitz", []);
    expect(stock.visible).toBe(true);
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

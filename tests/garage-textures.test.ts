import { beforeEach, describe, expect, it } from "vitest";
import { buildGarageBay } from "../src/render/garageBay";
import { buildGarageToolRack } from "../src/render/garageToolRack";
import {
  asphaltPadTexture,
  bannerTexture,
  cabinetDoorTexture,
  clearGarageTextureCache,
  crateFaceTexture,
  drumLabelTexture,
  floorTexture,
  garageTextureCacheSize,
  hazardChevronTexture,
  posterTexture,
  skyPeekTexture,
  toolBoardTexture,
  wallPanelTexture,
  woodBenchTexture,
} from "../src/render/garageTextures";

describe("garage bay comic textures", () => {
  beforeEach(() => clearGarageTextureCache());

  it("builds opaque asphalt, floor, wall, and hazard textures", () => {
    expect(asphaltPadTexture()).toBeTruthy();
    expect(floorTexture()).toBeTruthy();
    expect(wallPanelTexture(1)).toBeTruthy();
    expect(hazardChevronTexture()).toBeTruthy();
    expect(garageTextureCacheSize()).toBeGreaterThan(0);
  });

  it("builds detailed prop and decoration textures", () => {
    expect(bannerTexture()).toBeTruthy();
    expect(cabinetDoorTexture()).toBeTruthy();
    expect(crateFaceTexture("#E03131")).toBeTruthy();
    expect(posterTexture("#339AF0")).toBeTruthy();
    expect(woodBenchTexture()).toBeTruthy();
    expect(drumLabelTexture()).toBeTruthy();
    expect(skyPeekTexture()).toBeTruthy();
    expect(toolBoardTexture()).toBeTruthy();
    expect(garageTextureCacheSize()).toBeGreaterThanOrEqual(8);
  });

  it("builds a bay with a bench-height tool rack of 3D tools", () => {
    const bay = buildGarageBay();
    expect(bay.name).toBe("garageBay");
    const rack = bay.getObjectByName("garageToolBoard");
    expect(rack).toBeTruthy();
    // Arm height above lockers — not ceiling (was y≈5.5)
    expect(rack!.position.y).toBeLessThan(3.2);
    expect(rack!.position.y).toBeGreaterThan(2.3);
    expect(rack!.children.length).toBeGreaterThan(5);
    expect(bay.getObjectByName("garageBenchTools")).toBeTruthy();
  });
});

describe("garage tool rack", () => {
  beforeEach(() => clearGarageTextureCache());

  it("hangs multiple outlined comic tools on a pegboard", () => {
    const rack = buildGarageToolRack();
    expect(rack.name).toBe("garageToolBoard");
    expect(rack.children.length).toBeGreaterThanOrEqual(7);
  });
});

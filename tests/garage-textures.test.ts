import { beforeEach, describe, expect, it } from "vitest";
import { buildGarageBay } from "../src/render/garageBay";
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
  wallPanelTexture,
  woodBenchTexture,
  toolBoardTexture,
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

  it("builds a bright bay with a readable tool board", () => {
    const bay = buildGarageBay();
    expect(bay.name).toBe("garageBay");
    expect(bay.getObjectByName("garageOverlays")).toBeFalsy();
    expect(bay.getObjectByName("garageToolBoard")).toBeTruthy();
    expect(bay.children.length).toBeGreaterThan(30);
  });
});
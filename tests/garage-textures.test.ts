import { beforeEach, describe, expect, it } from "vitest";
import { buildGarageBay, GARAGE_PAD_CENTER } from "../src/render/garageBay";
import {
  asphaltPadTexture,
  bannerTexture,
  clearGarageTextureCache,
  floorTexture,
  garageTextureCacheSize,
  hazardChevronTexture,
  posterTexture,
  skyPeekTexture,
  sloganPosterTexture,
  turntableTexture,
  wallPanelTexture,
} from "../src/render/garageTextures";

describe("garage bay comic textures", () => {
  beforeEach(() => clearGarageTextureCache());

  it("builds opaque asphalt, floor, wall, and hazard textures", () => {
    expect(asphaltPadTexture()).toBeTruthy();
    expect(floorTexture()).toBeTruthy();
    expect(turntableTexture()).toBeTruthy();
    expect(wallPanelTexture(1)).toBeTruthy();
    expect(hazardChevronTexture()).toBeTruthy();
    expect(garageTextureCacheSize()).toBeGreaterThan(0);
  });

  it("caches distinct floor and wall texture keys", () => {
    clearGarageTextureCache();
    const floor = floorTexture();
    const wallA = wallPanelTexture(1);
    const wallB = wallPanelTexture(2);
    expect(floor).not.toBe(wallA);
    // Without shipped maps, seed 1/2 stay distinct canvas keys
    expect(wallA).not.toBe(wallB);
    expect(floorTexture()).toBe(floor);
    expect(wallPanelTexture(1)).toBe(wallA);
    expect(garageTextureCacheSize()).toBeGreaterThanOrEqual(3);
  });

  it("wires named floor and wall meshes on the bay", () => {
    const bay = buildGarageBay();
    expect(bay.getObjectByName("garageFloor")).toBeTruthy();
    expect(bay.getObjectByName("garageWallBack")).toBeTruthy();
    expect(bay.getObjectByName("garageWallLeft")).toBeTruthy();
    expect(bay.getObjectByName("garageWallRight")).toBeTruthy();
  });

  it("builds banner, poster, and sky textures for the bay shell", () => {
    expect(bannerTexture()).toBeTruthy();
    expect(posterTexture("#339AF0")).toBeTruthy();
    expect(sloganPosterTexture("DRIVE HARD", "#FFE066")).toBeTruthy();
    expect(skyPeekTexture()).toBeTruthy();
    expect(garageTextureCacheSize()).toBeGreaterThanOrEqual(3);
  });

  it("keeps the named bay and a center car pad", () => {
    const bay = buildGarageBay();
    expect(bay.name).toBe("garageBay");
    expect(bay.children.length).toBeGreaterThan(20);
    const pad = bay.getObjectByName("garagePad");
    expect(pad).toBeTruthy();
    expect(pad!.position.x).toBe(GARAGE_PAD_CENTER.x);
    expect(pad!.position.z).toBe(GARAGE_PAD_CENTER.z);
    expect(bay.getObjectByName("garageStock")).toBeTruthy();
    expect(bay.getObjectByName("garageHero")).toBeTruthy();
    expect(bay.getObjectByName("garageToolChest")).toBeTruthy();
    expect(bay.getObjectByName("garageGasBottles")).toBeTruthy();
    expect(bay.getObjectByName("garageHoist")).toBeTruthy();
    expect(bay.getObjectByName("garageToolBoard")).toBeFalsy();
  });
});

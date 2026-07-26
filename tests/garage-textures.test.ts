import { beforeEach, describe, expect, it } from "vitest";
import { buildGarageBay } from "../src/render/garageBay";
import {
  asphaltPadTexture,
  clearGarageTextureCache,
  floorTexture,
  garageTextureCacheSize,
  hazardChevronTexture,
  wallPanelTexture,
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

  it("builds a bay without floating overlay decals", () => {
    const bay = buildGarageBay();
    expect(bay.name).toBe("garageBay");
    expect(bay.getObjectByName("garageOverlays")).toBeFalsy();
    expect(bay.children.length).toBeGreaterThan(20);
  });
});

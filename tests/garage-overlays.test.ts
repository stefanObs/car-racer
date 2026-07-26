import { beforeEach, describe, expect, it } from "vitest";
import { buildGarageBay } from "../src/render/garageBay";
import {
  asphaltPadTexture,
  buildGarageOverlays,
  clearGarageOverlayTextureCache,
  garageOverlayTextureCacheSize,
  hazardChevronTexture,
  wallPanelTexture,
} from "../src/render/garageOverlays";

describe("garage bay comic overlays", () => {
  beforeEach(() => clearGarageOverlayTextureCache());

  it("builds asphalt, wall, and hazard textures", () => {
    expect(asphaltPadTexture()).toBeTruthy();
    expect(wallPanelTexture(1)).toBeTruthy();
    expect(hazardChevronTexture()).toBeTruthy();
    expect(garageOverlayTextureCacheSize()).toBeGreaterThan(0);
  });

  it("attaches overlay group onto the garage bay", () => {
    const bay = buildGarageBay();
    const overlays = bay.getObjectByName("garageOverlays");
    expect(overlays).toBeTruthy();
    expect(overlays!.children.length).toBeGreaterThanOrEqual(10);

    const solo = buildGarageOverlays();
    expect(solo.name).toBe("garageOverlays");
    expect(solo.children.length).toBeGreaterThanOrEqual(10);
  });
});

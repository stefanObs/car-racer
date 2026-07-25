import { beforeEach, describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import {
  buildCarOverlays,
  clearOverlayTextureCache,
  overlayTextureCacheSize,
  sidePanelTexture,
  stickerTexture,
} from "../src/render/carOverlays";
import { buildComicCar } from "../src/render/comicCarMesh";
import { createCarState } from "../src/sim/vehicle";

describe("car graphic overlays", () => {
  beforeEach(() => clearOverlayTextureCache());

  it("builds side panel and sticker textures", () => {
    const side = sidePanelTexture("#E03131", "player");
    expect(side).toBeTruthy();
    expect(stickerTexture("flames")).toBeTruthy();
    expect(stickerTexture("none")).toBeNull();
  });

  it("attaches overlay meshes to every comic car", () => {
    const car = createCarState({
      id: "player",
      x: 0,
      z: 0,
      heading: 0,
      isPlayer: true,
      paint: "#E03131",
      sticker: "flames",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0 },
    });
    const visual = buildComicCar(car);
    const overlays = visual.root.getObjectByName("carOverlays");
    expect(overlays).toBeTruthy();
    expect(overlays!.children.length).toBeGreaterThanOrEqual(5);
    expect(overlayTextureCacheSize()).toBeGreaterThan(0);

    const group = buildCarOverlays({ paint: "#339af0", sticker: "none", variant: "ai" });
    expect(group.children.length).toBe(5);
  });
});

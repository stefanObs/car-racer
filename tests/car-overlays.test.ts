import { beforeEach, describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import {
  buildCarOverlays,
  clearOverlayTextureCache,
  overlayTextureCacheSize,
  rearDeckTexture,
  sidePanelTexture,
  sideTextureHasInk,
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
    expect(rearDeckTexture()).toBeTruthy();
  });

  it("uses cel hatch ink on side panels (reference language)", () => {
    // In node without canvas, helper returns true; with happy-dom/canvas it checks pixels.
    expect(sideTextureHasInk("#E03131", "blitz")).toBe(true);
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
      modelId: "blitz",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0 },
    });
    const visual = buildComicCar(car);
    const overlays = visual.root.getObjectByName("carOverlays");
    expect(overlays).toBeTruthy();
    expect(overlays!.children.length).toBeGreaterThanOrEqual(5);
    expect(overlayTextureCacheSize()).toBeGreaterThan(0);

    const group = buildCarOverlays({ paint: "#339af0", sticker: "none", variant: "ai", gearClass: "sport" });
    expect(group.children.length).toBe(5);

    const pickup = buildCarOverlays({
      paint: "#2f9e44",
      sticker: "none",
      variant: "bison",
      gearClass: "pickup",
    });
    expect(pickup.children.length).toBe(5);
  });
});

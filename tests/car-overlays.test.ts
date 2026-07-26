import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCarOverlays,
  clearOverlayTextureCache,
  overlayTextureCacheSize,
  stickerTexture,
} from "../src/render/carOverlays";

describe("car graphic overlays", () => {
  beforeEach(() => clearOverlayTextureCache());

  it("builds sticker textures", () => {
    expect(stickerTexture("flames")).toBeTruthy();
    expect(stickerTexture("none")).toBeNull();
  });

  it("attaches stickers only (GLB cars already have authored shading)", () => {
    const none = buildCarOverlays({
      sticker: "none",
      gearClass: "pickup",
    });
    expect(none.children.length).toBe(0);

    const flames = buildCarOverlays({
      sticker: "flames",
      gearClass: "pickup",
    });
    expect(flames.children.length).toBe(2);
    expect(flames.name).toBe("carOverlays");
    expect(overlayTextureCacheSize()).toBeGreaterThan(0);
  });
});

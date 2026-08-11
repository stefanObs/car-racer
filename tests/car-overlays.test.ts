import { beforeEach, describe, expect, it } from "vitest";
import { buggyNoseFromSticker } from "../src/render/buggyNose";
import { Texture } from "three";
import {
  BUNKER_DOOR_STICKER_RECTS,
  authoredSideCacheKey,
  buildCarOverlays,
  clearOverlayTextureCache,
  overlayTextureCacheSize,
  stickerSlotsForCar,
  stickerTexture,
} from "../src/render/carStickers";

describe("car sticker textures", () => {
  beforeEach(() => clearOverlayTextureCache());

  it("builds car-specific sticker textures", () => {
    expect(stickerTexture("flames", "blitz")).toBeTruthy();
    expect(stickerTexture("bolt", "bison")).toBeTruthy();
    expect(stickerTexture("ironClad", "bunker")).toBeTruthy();
    expect(stickerTexture("none")).toBeNull();
  });

  it("places stickers per car (no buggy stickers)", () => {
    expect(stickerSlotsForCar("blitz")).toEqual(["side"]);
    expect(stickerSlotsForCar("bison")).toEqual(["side", "hood"]);
    expect(stickerSlotsForCar("donnerbuechse")).toEqual(["side"]);
    expect(stickerSlotsForCar("bunker")).toEqual(["door"]);
    expect(stickerSlotsForCar("kaeferkraft")).toEqual([]);
  });

  it("maps buggy stickers to nose variants", () => {
    expect(buggyNoseFromSticker("none")).toBe("none");
    expect(buggyNoseFromSticker("flames")).toBe("skull");
    expect(buggyNoseFromSticker("bolt")).toBe("bird");
    expect(buggyNoseFromSticker("star")).toBe("dog");
  });

  it("defines bunker door UV slots for ironClad replacement", () => {
    expect(BUNKER_DOOR_STICKER_RECTS).toHaveLength(2);
    for (const r of BUNKER_DOOR_STICKER_RECTS) {
      expect(r.w).toBeGreaterThan(100);
      expect(r.h).toBeGreaterThan(20);
      expect(r.x + r.w).toBeLessThanOrEqual(1024);
      expect(r.y + r.h).toBeLessThanOrEqual(1024);
    }
  });

  it("keeps paint-baked Blitz atlases out of the shared sticker cache", () => {
    const red = new Texture();
    const teal = new Texture();
    expect(authoredSideCacheKey("blitz", "flames", red)).not.toBe(
      authoredSideCacheKey("blitz", "flames", teal),
    );
    expect(authoredSideCacheKey("blitz", "flames", red)).toBe(
      authoredSideCacheKey("blitz", "flames", red),
    );
  });

  it("no longer builds floating plane overlay meshes", () => {
    const flames = buildCarOverlays({
      sticker: "flames",
      gearClass: "pickup",
    });
    expect(flames.children.length).toBe(0);
    expect(flames.name).toBe("carOverlays");
    expect(stickerTexture("flames")).toBeTruthy();
    expect(overlayTextureCacheSize()).toBeGreaterThan(0);
  });
});

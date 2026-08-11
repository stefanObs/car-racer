import { beforeEach, describe, expect, it } from "vitest";
import { buggyNoseFromSticker } from "../src/render/buggyNose";
import { Texture } from "three";
import {
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
    expect(stickerSlotsForCar("bunker")).toEqual(["side"]);
    expect(stickerSlotsForCar("kaeferkraft")).toEqual([]);
  });

  it("maps buggy stickers to nose variants", () => {
    expect(buggyNoseFromSticker("none")).toBe("none");
    expect(buggyNoseFromSticker("flames")).toBe("skull");
    expect(buggyNoseFromSticker("bolt")).toBe("bird");
    expect(buggyNoseFromSticker("star")).toBe("dog");
  });

  it("stamps bunker IronClad through the authored-side cache", () => {
    const map = new Texture();
    expect(authoredSideCacheKey("bunker", "ironClad", map)).toContain("bunker");
    expect(authoredSideCacheKey("bunker", "ironClad", map)).toBe(
      authoredSideCacheKey("bunker", "ironClad", map),
    );
  });

  it("keeps paint-baked Bison atlases out of the shared sticker cache", () => {
    const green = new Texture();
    const red = new Texture();
    expect(authoredSideCacheKey("bison", "bolt", green)).not.toBe(
      authoredSideCacheKey("bison", "bolt", red),
    );
    expect(authoredSideCacheKey("bison", "bolt", green)).toBe(
      authoredSideCacheKey("bison", "bolt", green),
    );
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

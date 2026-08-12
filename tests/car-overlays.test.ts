import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { buggyNoseFromSticker } from "../src/render/buggyNose";
import { emptyKit } from "../src/meta/save";
import {
  applyCarStickers,
  CAR_STICKERS_GROUP,
  clearOverlayTextureCache,
  findBodyMeshForStickers,
  overlayTextureCacheSize,
  STICKER_DECALS,
  stickerSlotsForCar,
  stickerTexture,
} from "../src/render/carStickers";

function fakeCarRoot(): Group {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(1.7, 0.9, 3.5), new MeshBasicMaterial({ name: "BodyPaint" }));
  body.name = "Body";
  body.position.y = 0.45;
  root.add(body);
  return root;
}

describe("car sticker decals", () => {
  beforeEach(() => clearOverlayTextureCache());

  it("builds car-specific sticker textures", () => {
    expect(stickerTexture("flames", "blitz")).toBeTruthy();
    expect(stickerTexture("bolt", "bison")).toBeTruthy();
    expect(stickerTexture("ironClad", "bunker")).toBeTruthy();
    expect(stickerTexture("none")).toBeNull();
    expect(overlayTextureCacheSize()).toBeGreaterThan(0);
  });

  it("defaults bunker IronClad and donner none", () => {
    expect(emptyKit("bunker").sticker).toBe("ironClad");
    expect(emptyKit("donnerbuechse").sticker).toBe("none");
    expect(emptyKit("blitz").sticker).toBe("none");
  });

  it("ships sticker-v7 shooting-star Blitz + Racepool Stern + hotrod Flammen", () => {
    const src = readFileSync("src/render/carStickers.ts", "utf8");
    expect(src).toContain("sticker-v7:");
    expect(src).toContain("RACEPOOL_RED");
    expect(src).toContain("fill(\"evenodd\")");
    expect(src).toContain("drawHotRodFlames");
    expect(src).toContain("shooting-star");
    expect(src).not.toContain('for (const ch of "RAC")');
    expect(src).toContain("DecalGeometry");
    expect(src).toContain("findBodyMeshForStickers");
    expect(existsSync("assets/tripo-concepts/sticker-proposal-flames.png")).toBe(true);
    expect(existsSync("assets/tripo-concepts/sticker-proposal-bolt.png")).toBe(true);
    expect(existsSync("assets/tripo-concepts/sticker-proposal-star.png")).toBe(true);
    expect(existsSync("assets/tripo-concepts/sticker-proposal-ironclad.png")).toBe(true);
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

  it("picks BodyPaint mesh for projection", () => {
    const root = fakeCarRoot();
    expect(findBodyMeshForStickers(root)?.name).toBe("Body");
  });

  it("projects Blitz Flammen onto the body mesh", () => {
    const root = fakeCarRoot();
    applyCarStickers(root, "blitz", "flames");
    const g = root.getObjectByName(CAR_STICKERS_GROUP);
    expect(g).toBeTruthy();
    expect(g!.children.length).toBeGreaterThan(0);
    expect(g!.children.length).toBeLessThanOrEqual(STICKER_DECALS.blitz.length);
  });

  it("projects Bison bolt when geometry hits", () => {
    const root = fakeCarRoot();
    applyCarStickers(root, "bison", "bolt");
    expect(root.getObjectByName(CAR_STICKERS_GROUP)?.children.length).toBeGreaterThan(0);
  });

  it("clears decals when sticker is none", () => {
    const root = fakeCarRoot();
    applyCarStickers(root, "donnerbuechse", "star");
    expect(root.getObjectByName(CAR_STICKERS_GROUP)).toBeTruthy();
    applyCarStickers(root, "donnerbuechse", "none");
    expect(root.getObjectByName(CAR_STICKERS_GROUP)).toBeUndefined();
  });

  it("does not attach flat stickers on Käferkraft", () => {
    const root = fakeCarRoot();
    applyCarStickers(root, "kaeferkraft", "flames");
    expect(root.getObjectByName(CAR_STICKERS_GROUP)).toBeUndefined();
  });
});

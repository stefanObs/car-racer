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

function fakeCarRoot(width = 1.7, height = 0.9, length = 3.5): Group {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(width, height, length), new MeshBasicMaterial({ name: "BodyPaint" }));
  body.name = "Body";
  body.position.y = height / 2;
  root.add(body);
  return root;
}

describe("car sticker decals", () => {
  beforeEach(() => clearOverlayTextureCache());

  it("builds car-specific sticker textures", () => {
    expect(stickerTexture("flames", "blitz")).toBeTruthy();
    expect(stickerTexture("bolt", "bison")).toBeTruthy();
    expect(stickerTexture("star", "bunker")).toBeTruthy();
    expect(stickerTexture("ironClad", "bunker")).toBeNull();
    expect(stickerTexture("none")).toBeNull();
    expect(overlayTextureCacheSize()).toBeGreaterThan(0);
  });

  it("defaults all cars including bunker to no sticker", () => {
    expect(emptyKit("bunker").sticker).toBe("none");
    expect(emptyKit("donnerbuechse").sticker).toBe("none");
    expect(emptyKit("blitz").sticker).toBe("none");
  });

  it("ships sticker-v12 Flammen + lightning Blitz + shooting-star Stern (side only)", () => {
    const src = readFileSync("src/render/carStickers.ts", "utf8");
    expect(src).toContain("sticker-v12:");
    expect(src).toContain("DONNER_FLAME_ORANGE");
    expect(src).toContain("drawHotRodFlames");
    expect(src).toContain("drawLightningBolt");
    expect(src).toContain("drawStarTrailVinyl");
    expect(src).toContain("preloadFlameSticker");
    expect(src).toContain("/stickers/flames-donner.png");
    expect(src).toContain("donnerbuechse-concept-3q");
    expect(src).toContain("shooting-star");
    expect(src).toContain("mountDonnerDoorPlanes");
    expect(src).not.toContain('slot: "hood"');
    expect(existsSync("public/stickers/flames-donner.png")).toBe(true);
    expect(existsSync("assets/tripo-concepts/donnerbuechse-concept-3q.png")).toBe(true);
    const main = readFileSync("src/main.ts", "utf8");
    expect(main).toContain("preloadFlameSticker");
  });

  it("Flammen sticker PNG is orange on transparent (not opaque white)", async () => {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp("public/stickers/flames-donner.png")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let white = 0;
    let orange = 0;
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 200) continue;
      opaque++;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r > 240 && g > 240 && b > 240) white++;
      if (r > 150 && r > g + 30 && r > b + 40) orange++;
    }
    expect(opaque).toBeGreaterThan(10_000);
    expect(white / opaque).toBeLessThan(0.02);
    expect(orange / opaque).toBeGreaterThan(0.7);
    expect(info.width).toBe(512);
  });

  it("anchors Donner stickers on the coupe door (between engine and rear wheel)", () => {
    const anchors = STICKER_DECALS.donnerbuechse;
    expect(anchors.length).toBe(2);
    for (const a of anchors) {
      expect(a.z).toBeGreaterThan(-0.25);
      expect(a.z).toBeLessThan(0.2);
      expect(Math.abs(a.x)).toBeGreaterThan(1.0);
      expect(a.y).toBeGreaterThan(0.7);
      expect(a.width).toBeLessThan(1.7);
      expect(a.height).toBeLessThan(0.7);
    }
  });

  it("keeps Bison stickers on the doors only (no hood/front)", () => {
    expect(STICKER_DECALS.bison.every((a) => a.slot === "side")).toBe(true);
    expect(STICKER_DECALS.bison.some((a) => a.slot === "hood")).toBe(false);
  });

  it("maps bolt to lightning art and star to shooting-star trail", () => {
    const src = readFileSync("src/render/carStickers.ts", "utf8");
    const boltBranch = src.slice(src.indexOf('if (sticker === "bolt"'), src.indexOf('if (sticker === "star"'));
    const starBranch = src.slice(src.indexOf('if (sticker === "star"'), src.indexOf("/** Standalone sticker"));
    expect(boltBranch).toContain("drawLightningBolt");
    expect(starBranch).toContain("drawStarTrailVinyl");
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

  it("mounts two door-plane stickers on Donnerbüchse", () => {
    const root = fakeCarRoot(2.4, 1.0, 3.8);
    applyCarStickers(root, "donnerbuechse", "flames");
    const g = root.getObjectByName(CAR_STICKERS_GROUP);
    expect(g?.children.length).toBe(2);
    for (const child of g!.children) {
      expect(child.name.startsWith("stickerDecal-side")).toBe(true);
      expect((child as Mesh).geometry.type).toBe("PlaneGeometry");
    }
  });

  it("clears decals when sticker is none", () => {
    // Wide shell so Donner door anchors (±1.1) intersect the body.
    const root = fakeCarRoot(2.4, 1.0, 3.8);
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

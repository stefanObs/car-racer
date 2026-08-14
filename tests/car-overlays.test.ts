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

  it("ships sticker-v14 Tripo Flammen plaque + lightning Blitz + shooting-star Stern", () => {
    const src = readFileSync("src/render/carStickers.ts", "utf8");
    expect(src).toContain("sticker-v14:");
    expect(src).toContain("FLAME_ORANGE");
    expect(src).toContain("FLAME_CORE");
    expect(src).toContain("drawHotRodFlames");
    expect(src).toContain("drawLightningBolt");
    expect(src).toContain("drawStarTrailVinyl");
    expect(src).toContain("preloadFlameSticker");
    expect(src).toContain("preloadFlameStickerGlb");
    expect(src).toContain("mountFlameTripoPlates");
    expect(src).toContain("/stickers/flames-donner.png");
    expect(src).toContain("/models/stickers/flames.glb");
    expect(src).toContain("three sharp tongues");
    expect(src).toContain("shooting-star");
    expect(src).toContain("mountFlushDoorPlanes");
    expect(src).not.toContain('slot: "hood"');
    expect(existsSync("public/stickers/flames-donner.png")).toBe(true);
    expect(existsSync("public/models/stickers/flames.glb")).toBe(true);
    expect(existsSync("assets/tripo-concepts/sticker-flames-tripo-concept.png")).toBe(true);
    expect(existsSync("scripts/bake-sticker-flames-tripo.mjs")).toBe(true);
    const main = readFileSync("src/main.ts", "utf8");
    expect(main).toContain("preloadFlameSticker");
    expect(main).toContain("preloadFlameStickerGlb");
    const pkg = readFileSync("package.json", "utf8");
    expect(pkg).toContain("stickers:bake-flames-tripo");
  });

  it("Flammen sticker PNG is orange+yellow on transparent (no card, no white fill)", async () => {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp("public/stickers/flames-donner.png")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let white = 0;
    let orange = 0;
    let yellow = 0;
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 200) continue;
      opaque++;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r > 240 && g > 240 && b > 240) white++;
      if (r > 150 && r > g + 20 && r > b + 30 && g < 180) orange++;
      if (r > 200 && g > 160 && b < 140) yellow++;
    }
    // Corners must stay clear (no floating rectangle card).
    for (const [x, y] of [
      [0, 0],
      [info.width - 1, 0],
      [0, info.height - 1],
      [info.width - 1, info.height - 1],
    ] as const) {
      const i = (y * info.width + x) * 4;
      expect(data[i + 3]!).toBeLessThan(20);
    }
    expect(opaque).toBeGreaterThan(10_000);
    expect(opaque / (info.width * info.height)).toBeLessThan(0.55);
    expect(white / opaque).toBeLessThan(0.02);
    expect(orange / opaque).toBeGreaterThan(0.4);
    expect(yellow / opaque).toBeGreaterThan(0.08);
    expect(info.width).toBe(512);
    expect(info.height).toBe(256);
  });

  it("anchors Donner stickers on the coupe door (between engine and rear wheel)", () => {
    const anchors = STICKER_DECALS.donnerbuechse;
    expect(anchors.length).toBe(2);
    for (const a of anchors) {
      expect(a.z).toBeGreaterThan(-0.4);
      expect(a.z).toBeLessThan(0);
      // Door panel half-width ~0.67–0.79 — not the wider rear fenders (~1.19).
      expect(Math.abs(a.x)).toBeGreaterThan(0.65);
      expect(Math.abs(a.x)).toBeLessThan(0.85);
      expect(a.y).toBeGreaterThan(0.8);
      expect(a.y).toBeLessThan(1.1);
      expect(a.width).toBeLessThan(1.15);
      expect(a.height).toBeLessThan(0.5);
    }
  });

  it("uses flush door planes for Donner flames (not floating Tripo plaques)", () => {
    const src = readFileSync("src/render/carStickers.ts", "utf8");
    expect(src).toContain('carId !== "donnerbuechse"');
    expect(src).toContain("mountFlushDoorPlanes");
  });

  it("anchors Bunker Flammen on the door panel (clear of the front tire)", () => {
    const anchors = STICKER_DECALS.bunker;
    expect(anchors.length).toBe(2);
    expect(anchors.every((a) => a.slot === "side")).toBe(true);
    for (const a of anchors) {
      expect(Math.abs(a.x)).toBeGreaterThan(0.85);
      expect(Math.abs(a.x)).toBeLessThan(0.98);
      expect(a.z).toBeLessThan(0.2);
      expect(a.z).toBeGreaterThan(-0.3);
      expect(a.width).toBeLessThanOrEqual(0.95);
      expect(a.y).toBeGreaterThan(1.0);
      expect(a.y).toBeLessThan(1.25);
    }
  });

  it("mounts two flush door stickers on Bunker (no Tripo flame plaques)", () => {
    const root = fakeCarRoot(2.0, 1.8, 3.8);
    applyCarStickers(root, "bunker", "flames");
    const g = root.getObjectByName(CAR_STICKERS_GROUP);
    expect(g?.children.length).toBe(2);
    expect(g?.userData.flameTripo).toBeFalsy();
    for (const child of g!.children) {
      expect(child.name.startsWith("stickerDecal-side")).toBe(true);
      expect(Math.abs(child.position.z)).toBeLessThan(0.25);
    }
  });

  it("keeps Bison stickers on the doors only (no hood/front)", () => {
    expect(STICKER_DECALS.bison.every((a) => a.slot === "side")).toBe(true);
    expect(STICKER_DECALS.bison.some((a) => a.slot === "hood")).toBe(false);
  });

  it("places stickers per car (no buggy stickers)", () => {
    expect(stickerSlotsForCar("blitz")).toEqual(["side"]);
    expect(stickerSlotsForCar("bison")).toEqual(["side"]);
    expect(stickerSlotsForCar("donnerbuechse")).toEqual(["side"]);
    expect(stickerSlotsForCar("bunker")).toEqual(["side"]);
    expect(stickerSlotsForCar("kaeferkraft")).toEqual([]);
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

  it("mounts two door stickers on Donnerbüchse (plane fallback without Tripo preload)", () => {
    const root = fakeCarRoot(2.4, 1.0, 3.8);
    applyCarStickers(root, "donnerbuechse", "flames");
    const g = root.getObjectByName(CAR_STICKERS_GROUP);
    expect(g?.children.length).toBe(2);
    for (const child of g!.children) {
      expect(child.name.startsWith("stickerDecal-side")).toBe(true);
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

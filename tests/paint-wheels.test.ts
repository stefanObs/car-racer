import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import sharp from "sharp";
import {
  buildWheelTexelMask,
  isBunkerCabinGlassTriangle,
  isBunkerGlassSourcePixel,
  isNearWhitePaintPixel,
  isWheelPaintVertex,
  recolorNearWhitePixels,
  recolorRedBodyPixels,
  tintBunkerCabinGlassTexels,
} from "../src/render/paintAuthoredWhite";
import { shouldApplyGaragePaint } from "../src/render/loadCarGltf";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function atlasAndWheelMask(carId: string): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
  mask: Uint8Array;
}> {
  const doc = await io.read(resolve("public/models/cars", `${carId}.glb`));
  const root = doc.getRoot();
  const tex = root.listMaterials().find((m) => m.getBaseColorTexture())?.getBaseColorTexture();
  if (!tex?.getImage()) throw new Error(`${carId} has no albedo`);
  const { data, info } = await sharp(tex.getImage()!).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const width = info.width;
  const height = info.height;
  const b = getBounds(root.listScenes()[0]!);
  const bounds = {
    minY: b.min[1]!,
    height: b.max[1]! - b.min[1]!,
    maxAbsX: Math.max(Math.abs(b.min[0]!), Math.abs(b.max[0]!)),
  };
  const uvTris: number[] = [];
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const uv = prim.getAttribute("TEXCOORD_0");
      const indices = prim.getIndices();
      if (!pos || !uv) continue;
      const triCount = indices ? indices.getCount() / 3 : Math.floor(pos.getCount() / 3);
      const at = (t: number, k: number) =>
        indices ? indices.getScalar(t * 3 + k) : t * 3 + k;
      for (let t = 0; t < triCount; t++) {
        const i0 = at(t, 0);
        const i1 = at(t, 1);
        const i2 = at(t, 2);
        const p0 = pos.getElement(i0, []);
        const p1 = pos.getElement(i1, []);
        const p2 = pos.getElement(i2, []);
        if (
          !(
            isWheelPaintVertex(p0[0]!, p0[1]!, p0[2]!, bounds) &&
            isWheelPaintVertex(p1[0]!, p1[1]!, p1[2]!, bounds) &&
            isWheelPaintVertex(p2[0]!, p2[1]!, p2[2]!, bounds)
          )
        ) {
          continue;
        }
        const t0 = uv.getElement(i0, []);
        const t1 = uv.getElement(i1, []);
        const t2 = uv.getElement(i2, []);
        uvTris.push(t0[0]!, t0[1]!, t1[0]!, t1[1]!, t2[0]!, t2[1]!);
      }
    }
  }
  expect(uvTris.length).toBeGreaterThan(18);
  return {
    data,
    width,
    height,
    mask: buildWheelTexelMask(width, height, uvTris),
  };
}

describe("shared BodyPaint atlas skips wheel texels", () => {
  it("shouldApplyGaragePaint skips Wheel/Tire/Rim meshes", () => {
    expect(shouldApplyGaragePaint("Tire")).toBe(false);
    expect(shouldApplyGaragePaint("Wheel")).toBe(false);
    expect(shouldApplyGaragePaint("Rim")).toBe(false);
    expect(shouldApplyGaragePaint("Hubcap")).toBe(false);
    expect(shouldApplyGaragePaint("BodyPaint")).toBe(true);
  });

  it("ships a Bunker cabin-glass bake helper", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("scripts/fix-bunker-cabin-glass.mjs")).toBe(true);
  });

  it("bunker wheel-island greys stay put while armor still paints", async () => {
    const { data, width, height, mask } = await atlasAndWheelMask("bunker");
    const baked = Uint8ClampedArray.from(data);
    recolorNearWhitePixels(baked, 0.88, 0.19, 0.19, mask);

    let wheelKept = 0;
    let wheelWouldPaint = 0;
    let armorPainted = 0;
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      if (!isNearWhitePaintPixel(r, g, b)) continue;
      if (mask[i]) {
        wheelWouldPaint++;
        if (baked[o] === r && baked[o + 1] === g && baked[o + 2] === b) wheelKept++;
      } else if (baked[o] !== r || baked[o + 1] !== g || baked[o + 2] !== b) {
        armorPainted++;
      }
    }
    expect(wheelWouldPaint).toBeGreaterThan(20);
    expect(wheelKept).toBe(wheelWouldPaint);
    expect(armorPainted).toBeGreaterThan(200);
  });

  it("bunker cabin glass UV islands tint to light black after body paint", async () => {
    const doc = await io.read(resolve("public/models/cars/bunker.glb"));
    const root = doc.getRoot();
    const tex = root.listMaterials().find((m) => m.getBaseColorTexture())?.getBaseColorTexture();
    if (!tex?.getImage()) throw new Error("bunker has no albedo");
    const { data, info } = await sharp(tex.getImage()!).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const width = info.width;
    const height = info.height;
    const b = getBounds(root.listScenes()[0]!);
    const bounds = {
      minY: b.min[1]!,
      height: b.max[1]! - b.min[1]!,
      maxAbsX: Math.max(Math.abs(b.min[0]!), Math.abs(b.max[0]!)),
      maxAbsZ: Math.max(Math.abs(b.min[2]!), Math.abs(b.max[2]!)),
    };
    const glassUv: number[] = [];
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        const uv = prim.getAttribute("TEXCOORD_0");
        const indices = prim.getIndices();
        if (!pos || !uv) continue;
        const triCount = indices ? indices.getCount() / 3 : Math.floor(pos.getCount() / 3);
        const at = (t: number, k: number) => (indices ? indices.getScalar(t * 3 + k) : t * 3 + k);
        for (let t = 0; t < triCount; t++) {
          const i0 = at(t, 0);
          const i1 = at(t, 1);
          const i2 = at(t, 2);
          const p0 = pos.getElement(i0, []);
          const p1 = pos.getElement(i1, []);
          const p2 = pos.getElement(i2, []);
          const abx = p1[0]! - p0[0]!;
          const aby = p1[1]! - p0[1]!;
          const abz = p1[2]! - p0[2]!;
          const acx = p2[0]! - p0[0]!;
          const acy = p2[1]! - p0[1]!;
          const acz = p2[2]! - p0[2]!;
          let nx = aby * acz - abz * acy;
          let ny = abz * acx - abx * acz;
          let nz = abx * acy - aby * acx;
          const len = Math.hypot(nx, ny, nz) || 1;
          nx /= len;
          ny /= len;
          nz /= len;
          if (
            !isBunkerCabinGlassTriangle(
              p0[0]!,
              p0[1]!,
              p0[2]!,
              p1[0]!,
              p1[1]!,
              p1[2]!,
              p2[0]!,
              p2[1]!,
              p2[2]!,
              nx,
              ny,
              nz,
              bounds,
            )
          ) {
            continue;
          }
          const t0 = uv.getElement(i0, []);
          const t1 = uv.getElement(i1, []);
          const t2 = uv.getElement(i2, []);
          glassUv.push(t0[0]!, t0[1]!, t1[0]!, t1[1]!, t2[0]!, t2[1]!);
        }
      }
    }
    expect(glassUv.length).toBeGreaterThan(18);
    const glassMask = buildWheelTexelMask(width, height, glassUv, 1);
    const baked = Uint8ClampedArray.from(data);
    recolorNearWhitePixels(baked, 0.88, 0.19, 0.19);
    tintBunkerCabinGlassTexels(baked, glassMask, data);

    let glassDark = 0;
    let glassRed = 0;
    for (let i = 0; i < width * height; i++) {
      if (!glassMask[i]) continue;
      const o = i * 4;
      const sr = data[o]!;
      const sg = data[o + 1]!;
      const sb = data[o + 2]!;
      if (!isBunkerGlassSourcePixel(sr, sg, sb)) continue;
      const r = baked[o]!;
      const g = baked[o + 1]!;
      const bch = baked[o + 2]!;
      const max = Math.max(r, g, bch);
      if (r > g + 25 && r > bch + 25 && r > 100) glassRed++;
      else if (max < 110 && Math.abs(r - g) < 12 && Math.abs(g - bch) < 16) glassDark++;
    }
    expect(glassDark).toBeGreaterThan(80);
    expect(glassRed).toBe(0);
  });

  it("blitz wheel-island texels are not recolored by red paint", async () => {
    const { data, width, height, mask } = await atlasAndWheelMask("blitz");
    const baked = Uint8ClampedArray.from(data);
    recolorRedBodyPixels(baked, 0.07, 0.72, 0.53, mask);
    let wheelChanged = 0;
    let bodyChanged = 0;
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      const changed =
        baked[o] !== data[o] || baked[o + 1] !== data[o + 1] || baked[o + 2] !== data[o + 2];
      if (!changed) continue;
      if (mask[i]) wheelChanged++;
      else bodyChanged++;
    }
    expect(wheelChanged).toBe(0);
    expect(bodyChanged).toBeGreaterThan(200);
  });
});

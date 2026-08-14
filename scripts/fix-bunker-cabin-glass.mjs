#!/usr/bin/env node
/**
 * Bake Bunker cabin windows to smoked light-black on the BodyPaint atlas.
 * Pale window islands otherwise bake to garage paint (red/grey) at runtime.
 *
 *   npx vite-node scripts/fix-bunker-cabin-glass.mjs
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import {
  buildWheelTexelMask,
  isBunkerCabinGlassTriangle,
  tintBunkerCabinGlassTexels,
} from "../src/render/paintAuthoredWhite.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const carPath = join(root, "public/models/cars/bunker.glb");
const backupDir = join(root, "assets/tripo-out/bunker");
const backupPath = join(backupDir, "bunker-pre-cabin-glass.glb");

mkdirSync(backupDir, { recursive: true });
try {
  copyFileSync(carPath, backupPath);
} catch {
  /* backup optional */
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(carPath);
const scene = doc.getRoot().listScenes()[0];
if (!scene) throw new Error("no scene");
const b = getBounds(scene);
const bounds = {
  minY: b.min[1],
  height: b.max[1] - b.min[1],
  maxAbsX: Math.max(Math.abs(b.min[0]), Math.abs(b.max[0])),
  maxAbsZ: Math.max(Math.abs(b.min[2]), Math.abs(b.max[2])),
};

const glassUv = [];
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const uv = prim.getAttribute("TEXCOORD_0");
    if (!pos || !uv) continue;
    const indices = prim.getIndices();
    const triCount = indices ? indices.getCount() / 3 : Math.floor(pos.getCount() / 3);
    const at = (t, k) => (indices ? indices.getScalar(t * 3 + k) : t * 3 + k);
    for (let t = 0; t < triCount; t++) {
      const i0 = at(t, 0);
      const i1 = at(t, 1);
      const i2 = at(t, 2);
      const p0 = pos.getElement(i0, []);
      const p1 = pos.getElement(i1, []);
      const p2 = pos.getElement(i2, []);
      const abx = p1[0] - p0[0];
      const aby = p1[1] - p0[1];
      const abz = p1[2] - p0[2];
      const acx = p2[0] - p0[0];
      const acy = p2[1] - p0[1];
      const acz = p2[2] - p0[2];
      let nx = aby * acz - abz * acy;
      let ny = abz * acx - abx * acz;
      let nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      if (
        !isBunkerCabinGlassTriangle(
          p0[0],
          p0[1],
          p0[2],
          p1[0],
          p1[1],
          p1[2],
          p2[0],
          p2[1],
          p2[2],
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
      glassUv.push(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1]);
    }
  }
}

if (glassUv.length < 18) throw new Error(`too few glass UVs: ${glassUv.length}`);

const mat = doc.getRoot().listMaterials().find((m) => m.getBaseColorTexture());
const tex = mat?.getBaseColorTexture();
const img = tex?.getImage();
if (!tex || !img) throw new Error("no BodyPaint albedo");

const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Uint8ClampedArray.from(data);
const source = Uint8ClampedArray.from(data);
const mask = buildWheelTexelMask(info.width, info.height, glassUv, 2);
const changed = tintBunkerCabinGlassTexels(rgba, mask, source);

const out = await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .jpeg({ quality: 92 })
  .toBuffer();

tex.setImage(out).setMimeType("image/jpeg");
await io.write(carPath, doc);

console.log(
  JSON.stringify(
    {
      glassTris: glassUv.length / 6,
      changed,
      bounds,
      out: carPath,
      backup: backupPath,
    },
    null,
    2,
  ),
);

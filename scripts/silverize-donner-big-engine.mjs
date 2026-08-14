#!/usr/bin/env node
/**
 * Strip Tripo look-sheet body-paint bleed (red/blue) from Donner Großer Motor
 * albedo → comic silver. Re-run after bake-car-parts-tripo for donnerbuechse.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "public/models/parts/donnerbuechse-big_engine.glb");

function isTireOrRim(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max < 55 || (max - min < 18 && max < 90);
}

/** Tripo often bakes look-sheet body paint as chromatic red/orange on the engine. */
function isBodyBleed(r, g, b) {
  if (isTireOrRim(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return false;
  const chroma = max - min;
  if (r === max && chroma / max > 0.12 && r > g + 4 && r > b + 4) return true;
  if (b === max && chroma / max > 0.18 && b > r + 4 && b > g + 8) return true;
  return false;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path);
const mat = doc.getRoot().listMaterials()[0];
if (!mat) throw new Error("no material");
mat.setName("Chrome");
const tex = mat.getBaseColorTexture();
if (!tex) throw new Error("no baseColor texture");
const img = tex.getImage();
if (!img) throw new Error("empty image");

const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let changed = 0;
for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (!isBodyBleed(r, g, b)) continue;
  const lum = (r + g + b) / (3 * 255);
  const shade = 0.55 + 0.45 * lum;
  data[i] = Math.round(220 * shade);
  data[i + 1] = Math.round(226 * shade);
  data[i + 2] = Math.round(232 * shade);
  changed++;
}

const jpeg = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .jpeg({ quality: 88 })
  .toBuffer();
tex.setImage(jpeg);
tex.setMimeType("image/jpeg");
mat.setBaseColorFactor([1, 1, 1, 1]);

const bytes = await io.writeBinary(doc);
writeFileSync(path, Buffer.from(bytes));
console.log("silverize-donner-big-engine", { changed, bytes: bytes.byteLength });

#!/usr/bin/env node
/**
 * Lift Donner Großer Motor albedo to comic silver: matte grey metal + look-sheet
 * body-paint bleed. Keeps black belt/outlines. Re-run after bake-car-parts-tripo.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "public/models/parts/donnerbuechse-big_engine.glb");

function isOutlineOrBelt(r, g, b) {
  return Math.max(r, g, b) < 50;
}

function isBodyBleed(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return false;
  const chroma = max - min;
  if (r === max && chroma / max > 0.12 && r > g + 4 && r > b + 4) return true;
  if (b === max && chroma / max > 0.18 && b > r + 4 && b > g + 8) return true;
  return false;
}

/** Mid-value low-chroma clay / gunmetal that should read as comic chrome. */
function isMatteGrey(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  return max - min < 28 && lum >= 50 && lum < 185;
}

function toSilver(r, g, b) {
  const lum = (r + g + b) / (3 * 255);
  const shade = 0.62 + 0.38 * lum;
  return [Math.round(220 * shade), Math.round(226 * shade), Math.round(232 * shade)];
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
  if (isOutlineOrBelt(r, g, b)) continue;
  if (!isBodyBleed(r, g, b) && !isMatteGrey(r, g, b)) continue;
  const [sr, sg, sb] = toSilver(r, g, b);
  data[i] = sr;
  data[i + 1] = sg;
  data[i + 2] = sb;
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

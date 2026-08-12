#!/usr/bin/env node
/**
 * Strip baked Hot-Rod door flames from Donnerbüchse albedo → fill with body blue.
 * Stock kit (sticker none) stays clean; Flammen sticker stamps art at runtime.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "public/models/cars/donnerbuechse.glb");

const BODY = { r: 51, g: 154, b: 240 };

/** Classic orange flame tongues. */
function isOrangeFlame(r, g, b, a) {
  if (a < 8) return false;
  if (r < 150) return false;
  if (r <= g + 12) return false;
  if (b > g * 0.9 && b > 70) return false;
  if (!(r > g && g >= b - 10)) return false;
  if (r - b < 55) return false;
  if (g < 35) return false;
  return true;
}

/**
 * Pale cyan / light-blue tongues left after orange flames were scrubbed into “body”.
 * These read as a painted-over sticker shadow when Aufkleber is Kein.
 */
function isPaintedOverFlameGhost(r, g, b, a) {
  if (a < 8) return false;
  if (b < 150 || g < 120) return false;
  if (r >= g - 2) return false;
  if (b < g - 30) return false;
  const lum = (r + g + b) / 3;
  if (lum < 150 || lum > 230) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  // Mild cool chroma — not strong body blue and not chrome.
  if (chroma < 14 || chroma > 70) return false;
  if (chroma / max >= 0.35 && b === max && b > r + 50 && g < b * 0.72) return false;
  return true;
}

function isFlame(r, g, b, a) {
  return isOrangeFlame(r, g, b, a) || isPaintedOverFlameGhost(r, g, b, a);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path);
let stripped = 0;
let textures = 0;

for (const tex of doc.getRoot().listTextures()) {
  const mime = tex.getMimeType() || "";
  if (!mime.includes("image")) continue;
  const raw = tex.getImage();
  if (!raw) continue;
  textures++;
  const { data, info } = await sharp(Buffer.from(raw))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    if (!isFlame(r, g, b, a)) continue;
    const lum = (r + g + b) / (3 * 255);
    const shade = 0.45 + 0.55 * lum;
    px[i] = Math.round(BODY.r * shade);
    px[i + 1] = Math.round(BODY.g * shade);
    px[i + 2] = Math.round(BODY.b * shade);
    n++;
  }
  stripped += n;
  const out = await sharp(px, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  tex.setImage(out);
  tex.setMimeType("image/jpeg");
  console.log("texture", tex.getName() || "(anon)", info.width, "x", info.height, "flames", n);
}

await io.write(path, doc);
console.log("donnerbuechse.glb flame strip:", { textures, stripped });

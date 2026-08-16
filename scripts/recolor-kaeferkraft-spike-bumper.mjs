#!/usr/bin/env node
/**
 * Recolor Käferkraft spike-cone albedo to the same charcoal as the pole frame
 * (`ComicPalette.outline`). Tubes stay; light grey cones become dark metal.
 *
 *   node scripts/recolor-kaeferkraft-spike-bumper.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const glbPath = join(rootDir, "public/models/parts/kaeferkraft-spike_bumper.glb");

/** Same charcoal as the waist poles / stock cage. */
const CAGE = [0x1b, 0x1b, 0x1f];
const HIGH = [0x4a, 0x4c, 0x52];
const SPIKE_LUM_MIN = 115;

export async function recolorKaeferkraftSpikeAlbedo(doc) {
  const textures = doc.getRoot().listTextures();
  if (textures.length < 1) throw new Error("spike bumper has no albedo");
  let changed = 0;
  for (const tex of textures) {
    const img = tex.getImage();
    if (!img) continue;
    const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum < SPIKE_LUM_MIN || chroma > 50) continue;
      const t = Math.min(1, Math.max(0, (lum - SPIKE_LUM_MIN) / (200 - SPIKE_LUM_MIN)));
      const u = t ** 0.8;
      data[i] = Math.round(CAGE[0] + (HIGH[0] - CAGE[0]) * u);
      data[i + 1] = Math.round(CAGE[1] + (HIGH[1] - CAGE[1]) * u);
      data[i + 2] = Math.round(CAGE[2] + (HIGH[2] - CAGE[2]) * u);
      changed += 1;
    }
    const jpeg = await sharp(Buffer.from(data), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    tex.setImage(jpeg);
    tex.setMimeType("image/jpeg");
  }
  return changed;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(glbPath);
  const changed = await recolorKaeferkraftSpikeAlbedo(doc);
  const bytes = await io.writeBinary(doc);
  writeFileSync(glbPath, bytes);
  console.log("recolored", glbPath, "spike texels", changed, "bytes", bytes.byteLength);
}

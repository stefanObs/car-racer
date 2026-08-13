#!/usr/bin/env node
/**
 * Bake Tripo Flammen sticker plaque → public/models/stickers/flames.glb
 * + comic albedo PNG for 2D preview / Decal fallback.
 *
 * Source (gitignored): assets/tripo-out/stickers/flames/
 * Concept: assets/tripo-concepts/sticker-flames-tripo-concept.png
 *
 * Usage: node scripts/bake-sticker-flames-tripo.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  clearNodeTransform,
  dedup,
  flatten,
  getBounds,
  prune,
  simplify,
  weld,
} from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(rootDir, "assets/tripo-out/stickers/flames");
const conceptPath = join(rootDir, "assets/tripo-concepts/sticker-flames-tripo-concept.png");
const outGlbDir = join(rootDir, "public/models/stickers");
const outPng = join(rootDir, "public/stickers/flames-donner.png");

const TARGET_LEN = 1.25;
const MAX_H = 0.48;
const MAX_THICK = 0.08;
const SIMPLIFY = 0.45;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function bakeNodeTree(node) {
  clearNodeTransform(node);
  for (const child of node.listChildren()) bakeNodeTree(child);
}

function bakeAllNodeTransforms(doc) {
  for (const scene of doc.getRoot().listScenes()) {
    for (const root of scene.listChildren()) bakeNodeTree(root);
  }
}

function forEachPosition(doc, fn) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const nrm = prim.getAttribute("NORMAL");
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        const n = nrm ? nrm.getElement(i, []) : null;
        fn(v, n);
        pos.setElement(i, v);
        if (nrm && n) nrm.setElement(i, n);
      }
      pos.setArray(pos.getArray());
      if (nrm) nrm.setArray(nrm.getArray());
    }
  }
}

function sceneSize(doc) {
  const b = getBounds(doc.getRoot().listScenes()[0]);
  return {
    min: b.min,
    max: b.max,
    size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]],
    cx: (b.min[0] + b.max[0]) / 2,
    cy: (b.min[1] + b.max[1]) / 2,
    cz: (b.min[2] + b.max[2]) / 2,
  };
}

function rotateY90(doc) {
  forEachPosition(doc, (v, n) => {
    const x = v[0];
    const z = v[2];
    v[0] = -z;
    v[2] = x;
    if (n) {
      const nx = n[0];
      const nz = n[2];
      n[0] = -nz;
      n[2] = nx;
    }
  });
}

function rotateX90(doc) {
  forEachPosition(doc, (v, n) => {
    const y = v[1];
    const z = v[2];
    v[1] = -z;
    v[2] = y;
    if (n) {
      const ny = n[1];
      const nz = n[2];
      n[1] = -nz;
      n[2] = ny;
    }
  });
}

function rotateZ90(doc) {
  forEachPosition(doc, (v, n) => {
    const x = v[0];
    const y = v[1];
    v[0] = -y;
    v[1] = x;
    if (n) {
      const nx = n[0];
      const ny = n[1];
      n[0] = -ny;
      n[1] = nx;
    }
  });
}

/** Plate in XY facing +Z: longest → X, height → Y, thinnest → Z. */
function orientAsDoorPlate(doc) {
  for (let i = 0; i < 4; i++) {
    const s = sceneSize(doc).size;
    const axes = [
      { a: 0, v: s[0] },
      { a: 1, v: s[1] },
      { a: 2, v: s[2] },
    ].sort((p, q) => q.v - p.v);
    const longest = axes[0].a;
    const thinnest = axes[2].a;
    if (longest === 0 && thinnest === 2) break;
    if (longest !== 0) {
      if (longest === 1) rotateZ90(doc);
      else rotateY90(doc);
      continue;
    }
    if (thinnest !== 2) rotateX90(doc);
  }
}

function centerScalePlate(doc) {
  const s0 = sceneSize(doc);
  let scale = TARGET_LEN / Math.max(s0.size[0], 1e-6);
  if (s0.size[1] * scale > MAX_H) scale *= MAX_H / (s0.size[1] * scale);
  forEachPosition(doc, (v) => {
    v[0] = (v[0] - s0.cx) * scale;
    v[1] = (v[1] - s0.cy) * scale;
    v[2] = (v[2] - s0.cz) * scale;
  });
  // Squash thickness only — keep silhouette length/height.
  const s1 = sceneSize(doc);
  const thick = Math.max(s1.size[2], 1e-6);
  if (thick > MAX_THICK) {
    const zScale = MAX_THICK / thick;
    forEachPosition(doc, (v) => {
      v[2] *= zScale;
    });
  }
  return sceneSize(doc);
}

function comicMaterial(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setName("FlameSticker");
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.82);
    const bc = mat.getBaseColorFactor();
    mat.setBaseColorFactor([Math.min(1, bc[0] * 1.08), Math.min(1, bc[1] * 0.98), Math.min(1, bc[2] * 0.9), 1]);
    mat.setNormalTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setOcclusionTexture(null);
    mat.setEmissiveTexture(null);
    mat.setEmissiveFactor([0.12, 0.045, 0]);
  }
}

/** Prefer vivid comic albedo: saturate Tripo bake (keep UVs) — concept PNG is UV-mismatched. */
async function applyVividTripoAlbedo(doc) {
  const root = doc.getRoot();
  const tex = root.listMaterials()[0]?.getBaseColorTexture();
  if (!tex) return false;
  const raw = tex.getImage();
  if (!raw) return false;
  const { data, info } = await sharp(Buffer.from(raw))
    .ensureAlpha()
    .modulate({ saturation: 1.55, brightness: 1.08 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Lift near-cream cores toward yellow and push orange bands hotter.
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 180 && g > 140 && b < 140) {
      data[i] = Math.min(255, r + 20);
      data[i + 1] = Math.min(255, g + 10);
      data[i + 2] = Math.max(0, b - 20);
    }
  }
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  tex.setImage(png);
  tex.setMimeType("image/png");
  tex.setName("FlameStickerAlbedo");
  for (const mat of root.listMaterials()) {
    mat.setBaseColorTexture(tex);
    mat.setBaseColorFactor([1, 1, 1, 1]);
  }
  return true;
}

async function simplifyDoc(doc, ratio) {
  await MeshoptSimplifier.ready;
  const steps = [weld({ tolerance: 0.0002 }), dedup()];
  if (ratio < 0.999) {
    steps.splice(1, 0, simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0012 }));
    steps.push(prune());
  }
  await doc.transform(...steps);
  await doc.transform(prune());
}

function findSourceGlb(dir) {
  const preferred = [join(dir, "texture/model.glb"), join(dir, "model.glb")];
  for (const p of preferred) {
    if (existsSync(p)) return p;
  }
  const stack = [dir];
  let fallback = null;
  while (stack.length) {
    const cur = stack.pop();
    if (!existsSync(cur) || !statSync(cur).isDirectory()) continue;
    for (const name of readdirSync(cur)) {
      const p = join(cur, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (!name.endsWith(".glb")) continue;
      if (name === "model.glb" && p.includes("texture")) return p;
      if (!fallback) fallback = p;
    }
  }
  return fallback;
}

/** Concept → transparent 512×256 sticker plate (studio floor removed). */
async function bakeAlbedoPng() {
  if (!existsSync(conceptPath)) throw new Error(`Missing concept: ${conceptPath}`);
  const { data, info } = await sharp(conceptPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const bright = r > 225 && g > 225 && b > 225;
    const lightGray = r > 190 && g > 190 && b > 190 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18;
    // Soft studio ground / shadow: desaturated mid gray-beige under the plaque.
    const ground =
      b > r - 10 &&
      g > r - 5 &&
      r > 140 &&
      r < 230 &&
      Math.abs(r - g) < 35 &&
      Math.abs(g - b) < 40 &&
      a > 200;
    if (bright || lightGray || ground) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = a;
  }
  mkdirSync(dirname(outPng), { recursive: true });
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(512, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPng);
  return { png: outPng, bytes: statSync(outPng).size };
}

async function main() {
  const src = findSourceGlb(srcDir);
  if (!src) throw new Error(`No Tripo GLB under ${srcDir}`);
  // Albedo PNG first so we can stamp it onto the Tripo mesh.
  const albedo = await bakeAlbedoPng();
  const doc = await io.read(src);
  await doc.transform(flatten(), dedup());
  bakeAllNodeTransforms(doc);
  await doc.transform(dedup(), prune());
  orientAsDoorPlate(doc);
  const sized = centerScalePlate(doc);
  comicMaterial(doc);
  await simplifyDoc(doc, SIMPLIFY);
  const usedConceptMap = await applyVividTripoAlbedo(doc);
  mkdirSync(outGlbDir, { recursive: true });
  const outGlb = join(outGlbDir, "flames.glb");
  const bytes = await io.writeBinary(doc);
  writeFileSync(outGlb, bytes);
  console.log("sticker flames Tripo bake", {
    src,
    glb: outGlb,
    glbBytes: bytes.byteLength,
    size: sized.size.map((v) => +v.toFixed(3)),
    usedConceptMap,
    ...albedo,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

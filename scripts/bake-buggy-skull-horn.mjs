#!/usr/bin/env node
/**
 * Bake Asphalt-Comic Käferkraft horn albedo from SkullHorn mesh layout.
 *
 * UVs in-engine use ensureNoseOrnamentUvs (Z→U, Y→V). This script measures
 * tip/base positions on that same plane and paints a double-horn silhouette
 * so the texture follows the ornament shape (not a single free-floating horn).
 *
 * Usage: node scripts/bake-buggy-skull-horn.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const glbPath = join(rootDir, "public/models/cars/kaeferkraft.glb");
const outPath = join(rootDir, "public/textures/buggy-skull-horn.png");
const W = 512;
const H = 512;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(glbPath);

let best = null;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMaterial()?.getName() !== "SkullHorn") continue;
    const pos = prim.getAttribute("POSITION");
    if (!best || pos.getCount() > best.n) best = { pos, n: pos.getCount() };
  }
}
if (!best) throw new Error("No SkullHorn mesh in kaeferkraft.glb");

const arr = best.pos.getArray();
let minY = Infinity;
let maxY = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;
const pts = [];
for (let i = 0; i < best.n; i++) {
  const y = arr[i * 3 + 1];
  const z = arr[i * 3 + 2];
  pts.push([z, y]);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  minZ = Math.min(minZ, z);
  maxZ = Math.max(maxZ, z);
}
const spanY = Math.max(maxY - minY, 1e-6);
const spanZ = Math.max(maxZ - minZ, 1e-6);
const toUV = (z, y) => ({ u: (z - minZ) / spanZ, v: (y - minY) / spanY });

const yCut = minY + spanY * 0.7;
const leftCand = pts.filter((p) => p[1] >= yCut && p[0] < 0).sort((a, b) => a[0] - b[0]);
const rightCand = pts.filter((p) => p[1] >= yCut && p[0] > 0).sort((a, b) => b[0] - a[0]);
const leftTip = toUV(...(leftCand[0] || [minZ, maxY]));
const rightTip = toUV(...(rightCand[0] || [maxZ, maxY]));
// Symmetric base on the crossbar (matches bumper ornament centering).
const base = { u: 0.5, v: 0.02 };
const midL = { u: 0.2, v: 0.48 };
const midR = { u: 0.8, v: 0.48 };
const tipL = { u: Math.min(leftTip.u, 0.06), v: Math.max(leftTip.v, 0.92) };
const tipR = { u: Math.max(rightTip.u, 0.94), v: Math.max(rightTip.v, 0.92) };

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby + 1e-12)));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

function bezier(a, c, b, n = 56) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }
  return out;
}

function distToPath(u, v, path) {
  let d = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    d = Math.min(d, distToSegment(u, v, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
  }
  return d;
}

function alongPath(u, v, path) {
  let bestT = 0;
  let bestD = Infinity;
  const lens = [];
  for (let i = 0; i < path.length - 1; i++) {
    lens.push(Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]));
  }
  const total = lens.reduce((s, x) => s + x, 0) || 1;
  let traveled = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i][0];
    const ay = path[i][1];
    const bx = path[i + 1][0];
    const by = path[i + 1][1];
    const abx = bx - ax;
    const aby = by - ay;
    const t = Math.max(0, Math.min(1, ((u - ax) * abx + (v - ay) * aby) / (abx * abx + aby * aby + 1e-12)));
    const d = Math.hypot(u - (ax + t * abx), v - (ay + t * aby));
    if (d < bestD) {
      bestD = d;
      bestT = (traveled + t * lens[i]) / total;
    }
    traveled += lens[i];
  }
  return bestT;
}

const leftPath = bezier([base.u, base.v], [midL.u, midL.v], [tipL.u, tipL.v]);
const rightPath = bezier([base.u, base.v], [midR.u, midR.v], [tipR.u, tipR.v]);
const baseW = 0.09;
const tipW = 0.03;
const bg = [232, 220, 200];
const rgba = Buffer.alloc(W * H * 4);
let inside = 0;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);
    const v = 1 - y / (H - 1);
    const dL = distToPath(u, v, leftPath);
    const dR = distToPath(u, v, rightPath);
    const useL = dL <= dR;
    const d = useL ? dL : dR;
    const along = useL ? alongPath(u, v, leftPath) : alongPath(u, v, rightPath);
    const halfW = baseW * (1 - along) + tipW * along;
    const i = (y * W + x) * 4;
    if (d > halfW) {
      rgba[i] = bg[0];
      rgba[i + 1] = bg[1];
      rgba[i + 2] = bg[2];
      rgba[i + 3] = 255;
      continue;
    }
    inside++;
    if (d > halfW * 0.7) {
      rgba[i] = 0x1b;
      rgba[i + 1] = 0x1b;
      rgba[i + 2] = 0x1f;
      rgba[i + 3] = 255;
      continue;
    }
    const t = along;
    let r = Math.round(244 - t * 78);
    let g = Math.round(232 - t * 92);
    let b = Math.round(210 - t * 108);
    if (Math.sin(along * Math.PI * 11) > 0.78) {
      r = Math.round(r * 0.7);
      g = Math.round(g * 0.68);
      b = Math.round(b * 0.62);
    }
    const shade = 1 - (d / halfW) * 0.2;
    r = Math.round(r * shade);
    g = Math.round(g * shade);
    b = Math.round(b * shade);
    if (((x * 37 + y * 91) & 15) === 0) {
      r = Math.round(r * 0.86);
      g = Math.round(g * 0.86);
      b = Math.round(b * 0.86);
    }
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = 255;
  }
}

await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toFile(outPath);
writeFileSync(
  join(rootDir, "scripts/.bake-horn-meta.json"),
  JSON.stringify(
    {
      tips: { tipL, tipR, base, midL, midR },
      insidePct: +(inside / (W * H) * 100).toFixed(2),
      yRange: [minY, maxY],
      zRange: [minZ, maxZ],
    },
    null,
    2,
  ),
);
console.log(`Wrote ${outPath} (horn fill ${((inside / (W * H)) * 100).toFixed(1)}%)`);

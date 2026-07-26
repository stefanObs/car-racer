#!/usr/bin/env node
/**
 * Solid curved SkullHorns for Käferkraft that match buggy-skull-horn.png.
 * - Closed tapered tubes (no open bases)
 * - Seated on left/right crown corners of the Skull mesh
 * - Same sheet UVs on both arms (no U-flip) so the left matches the right from the front
 *
 * Usage: node scripts/reshape-buggy-skull-horns.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";
import sharp from "sharp";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

globalThis.Blob = Blob;
globalThis.self = globalThis;
class FileReaderPolyfill {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer())
      .then((ab) => {
        this.result = ab;
        this.onloadend?.({ target: this });
      })
      .catch((err) => this.onerror?.(err));
  }
}
globalThis.FileReader = FileReaderPolyfill;

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const glbPath = join(rootDir, "public/models/cars/kaeferkraft.glb");
const texPath = join(rootDir, "public/textures/buggy-skull-horn.png");

const BG = [232, 220, 200];

/**
 * Attach on the main Skull crown corners (measured from kaeferkraft.glb),
 * base buried slightly into the bone so the join reads natural.
 */
const HORN = {
  tipX: -1.24,
  tipY: 0.32,
  tipZ: 0.4,
  /** Pull base into the skull volume (positive X = rearward on buggy). */
  buryX: 0.055,
  buryY: -0.015,
  rBase: 0.04,
  rTip: 0.011,
  tubular: 32,
  radial: 12,
};

function isHornPixel(r, g, b) {
  if (Math.hypot(r - BG[0], g - BG[1], b - BG[2]) < 28) return false;
  if (r > 245 && g > 245 && b > 240) return false;
  return true;
}

async function extractMedialPath() {
  const { data, info } = await sharp(texPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const mask = new Uint8Array(W * H);
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    if (isHornPixel(data[i], data[i + 1], data[i + 2])) mask[p] = 1;
  }
  const rows = [];
  for (let y = H - 1; y >= 0; y--) {
    let sx = 0;
    let n = 0;
    let x0 = W;
    let x1 = 0;
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      sx += x;
      n++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
    if (n > 8) {
      rows.push({
        u: sx / n / (W - 1),
        v: 1 - y / (H - 1),
        halfU: (x1 - x0) / 2 / (W - 1),
      });
    }
  }
  if (rows.length < 4) throw new Error("Could not read horn medial path from texture");
  const step = Math.max(1, Math.floor(rows.length / 20));
  const path = [];
  for (let i = 0; i < rows.length; i += step) path.push(rows[i]);
  if (path[path.length - 1] !== rows[rows.length - 1]) path.push(rows[rows.length - 1]);
  return path;
}

function samplePath(path, t) {
  const f = t * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const u = f - i;
  const a = path[i];
  const b = path[i + 1];
  return {
    u: a.u * (1 - u) + b.u * u,
    v: a.v * (1 - u) + b.v * u,
    halfU: a.halfU * (1 - u) + b.halfU * u,
  };
}

/**
 * @param {1 | -1} side +1 right (+Z), -1 left (−Z)
 * @param {{ x: number, y: number, z: number }} base crown corner on the Skull mesh
 */
function buildHornCurve(texPath, side, base) {
  const pts = [];
  const v0 = texPath[0].v;
  const v1 = texPath[texPath.length - 1].v;
  const u0 = texPath[0].u;
  const u1 = texPath[texPath.length - 1].u;
  const tipZ = side * HORN.tipZ;
  for (let i = 0; i < texPath.length; i++) {
    const lateral = (texPath[i].u - u0) / Math.max(1e-6, u1 - u0);
    const lift = (texPath[i].v - v0) / Math.max(1e-6, v1 - v0);
    const t = i / (texPath.length - 1);
    const flare = Math.max(0, (lateral - 0.05) / 0.95);
    const x = base.x + HORN.buryX * (1 - t) + (HORN.tipX - base.x) * t;
    const y = base.y + HORN.buryY * (1 - t) + (HORN.tipY - base.y) * lift;
    const z = base.z + (tipZ - base.z) * (0.05 + 0.95 * flare);
    pts.push(new Vector3(x, y, z));
  }
  return new CatmullRomCurve3(pts, false, "catmullrom", 0.4);
}

/** Outermost high verts on the main Skull face → left/right horn sockets. */
function findSkullCrownAnchors(root) {
  let best = null;
  root.traverse((obj) => {
    const mesh = obj;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.some((m) => ((m?.name ?? "") + "").toLowerCase() === "skull")) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos || pos.count < 150) return;
    if (!best || pos.count > best.count) best = { pos, count: pos.count };
  });
  if (!best) throw new Error("Main Skull mesh not found");
  let maxY = -Infinity;
  for (let i = 0; i < best.pos.count; i++) maxY = Math.max(maxY, best.pos.getY(i));
  let right = null;
  let left = null;
  for (let i = 0; i < best.pos.count; i++) {
    const x = best.pos.getX(i);
    const y = best.pos.getY(i);
    const z = best.pos.getZ(i);
    if (y < maxY - 0.09) continue;
    if (z >= 0 && (!right || z > right.z || (Math.abs(z - right.z) < 0.01 && y > right.y))) {
      right = { x, y, z };
    }
    if (z < 0 && (!left || z < left.z || (Math.abs(z - left.z) < 0.01 && y > left.y))) {
      left = { x, y, z };
    }
  }
  if (!right || !left) throw new Error("Could not find skull crown corners");
  // Nudge slightly into the bone and up onto the crown ridge.
  return {
    right: { x: right.x - 0.02, y: right.y + 0.02, z: Math.max(0.08, right.z) },
    left: { x: left.x - 0.02, y: left.y + 0.02, z: Math.min(-0.08, left.z) },
  };
}

function makeTaperedHorn(curve, radii, texPathPts) {
  const tubular = HORN.tubular;
  const radial = HORN.radial;
  const frames = curve.computeFrenetFrames(tubular, false);
  const ring = radial + 1;
  const vertCount = (tubular + 1) * ring;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const center = curve.getPointAt(t);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const r = radii[0] * (1 - t) + radii[1] * t;
    const tex = samplePath(texPathPts, t);
    for (let j = 0; j <= radial; j++) {
      const angle = (j / radial) * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const ox = -r * (cos * normal.x + sin * binormal.x);
      const oy = -r * (cos * normal.y + sin * binormal.y);
      const oz = -r * (cos * normal.z + sin * binormal.z);
      const idx = i * ring + j;
      positions[idx * 3] = center.x + ox;
      positions[idx * 3 + 1] = center.y + oy;
      positions[idx * 3 + 2] = center.z + oz;
      // Same sheet mapping on both horns (right-looking texture); no U mirror.
      const across = Math.cos(angle);
      uvs[idx * 2] = tex.u + across * tex.halfU;
      uvs[idx * 2 + 1] = tex.v;
    }
  }

  const indices = [];
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      const c = (i + 1) * ring + (j + 1);
      const d = i * ring + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const tipCenter = curve.getPointAt(1);
  const tipIdx = vertCount;
  const tipPos = new Float32Array(positions.length + 3);
  tipPos.set(positions);
  tipPos[positions.length] = tipCenter.x;
  tipPos[positions.length + 1] = tipCenter.y;
  tipPos[positions.length + 2] = tipCenter.z;
  const tipUv = new Float32Array(uvs.length + 2);
  tipUv.set(uvs);
  const tipTex = samplePath(texPathPts, 1);
  tipUv[uvs.length] = tipTex.u;
  tipUv[uvs.length + 1] = tipTex.v;
  for (let j = 0; j < radial; j++) {
    indices.push(tubular * ring + j, tipIdx, tubular * ring + (j + 1));
  }

  // Base cap pulled further into the skull so the join is hidden.
  const baseCenter = curve.getPointAt(0).clone();
  baseCenter.x += HORN.buryX * 0.6;
  baseCenter.y += HORN.buryY * 0.5;
  const baseIdx = tipIdx + 1;
  const pos2 = new Float32Array(tipPos.length + 3);
  pos2.set(tipPos);
  pos2[tipPos.length] = baseCenter.x;
  pos2[tipPos.length + 1] = baseCenter.y;
  pos2[tipPos.length + 2] = baseCenter.z;
  const uv2 = new Float32Array(tipUv.length + 2);
  uv2.set(tipUv);
  const baseTex = samplePath(texPathPts, 0);
  uv2[tipUv.length] = baseTex.u;
  uv2[tipUv.length + 1] = baseTex.v;
  for (let j = 0; j < radial; j++) {
    indices.push(baseIdx, j, j + 1);
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos2, 3));
  geo.setAttribute("uv", new BufferAttribute(uv2, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function loadGlb(path) {
  const buf = readFileSync(path);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject);
  });
}

async function exportGlb(root, path) {
  const exporter = new GLTFExporter();
  const ab = await new Promise((resolve, reject) => {
    exporter.parse(root, (res) => resolve(res), reject, { binary: true });
  });
  writeFileSync(path, Buffer.from(ab));
}

const texPathPts = await extractMedialPath();

const gltf = await loadGlb(glbPath);
const root = gltf.scene;
const anchors = findSkullCrownAnchors(root);

const curveR = buildHornCurve(texPathPts, 1, anchors.right);
const curveL = buildHornCurve(texPathPts, -1, anchors.left);
const geoR = makeTaperedHorn(curveR, [HORN.rBase, HORN.rTip], texPathPts);
const geoL = makeTaperedHorn(curveL, [HORN.rBase, HORN.rTip], texPathPts);
const merged = mergeGeometries([geoL, geoR], false);
if (!merged) throw new Error("merge failed");

const toRemove = [];
root.traverse((obj) => {
  const mesh = obj;
  if (!mesh.isMesh) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (mats.some((m) => ((m?.name ?? "") + "").toLowerCase().includes("skullhorn"))) {
    toRemove.push(mesh);
  }
});
for (const m of toRemove) m.removeFromParent();

const mat = new MeshStandardMaterial({
  name: "SkullHorn",
  color: 0xffffff,
  roughness: 0.85,
  metalness: 0.05,
});
const hornMesh = new Mesh(merged, mat);
hornMesh.name = "SkullHorns";
root.add(hornMesh);
await exportGlb(root, glbPath);

console.log("Horns attached to skull crown corners", {
  removed: toRemove.length,
  verts: merged.getAttribute("position").count,
  anchors,
  baseR: curveR.getPointAt(0).toArray().map((v) => +v.toFixed(3)),
  baseL: curveL.getPointAt(0).toArray().map((v) => +v.toFixed(3)),
  tipR: curveR.getPointAt(1).toArray().map((v) => +v.toFixed(3)),
  tipL: curveL.getPointAt(1).toArray().map((v) => +v.toFixed(3)),
});

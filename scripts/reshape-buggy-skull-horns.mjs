#!/usr/bin/env node
/**
 * Solid curved SkullHorns for Käferkraft that match buggy-skull-horn.png,
 * seat on the skull crown, stay closed (no hollow openings), and read round
 * from the side.
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

/** Seat horns on the main skull crown (local bumper frame). */
const ATTACH = {
  // Slightly into the skull so the base is buried (no visible opening).
  x: -1.28,
  y: 0.08,
  z: 0.11,
  /** Tip flares outward / up / a bit forward of the crown. */
  tipX: -1.22,
  tipY: 0.3,
  tipZ: 0.38,
  rBase: 0.038,
  rTip: 0.012,
  tubular: 28,
  radial: 10,
};

function isHornPixel(r, g, b) {
  if (Math.hypot(r - BG[0], g - BG[1], b - BG[2]) < 28) return false;
  if (r > 245 && g > 245 && b > 240) return false;
  return true;
}

/** Medial axis + half-width of the comic horn drawing (U,V-up). */
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
  // Normalize along-parameter 0..1 (base→tip). Rows were bottom→top = base→tip in this sheet.
  return path;
}

/**
 * Variable-radius tube (closed ends) along a curve.
 * UVs sample the comic sheet along the medial path (rings wrap the tube).
 */
function makeTaperedHorn(curve, radii, texPathPts, mirrorZ) {
  const tubular = ATTACH.tubular;
  const radial = ATTACH.radial;
  const frames = curve.computeFrenetFrames(tubular, false);
  const vertCount = (tubular + 1) * (radial + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const normals = new Float32Array(vertCount * 3);

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const center = curve.getPointAt(t);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const r = radii[0] * (1 - t) + radii[1] * t;
    const tex = samplePath(texPathPts, t);
    for (let j = 0; j <= radial; j++) {
      const v = j / radial;
      const angle = v * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const cx = -r * (cos * normal.x + sin * binormal.x);
      const cy = -r * (cos * normal.y + sin * binormal.y);
      const cz = -r * (cos * normal.z + sin * binormal.z);
      let x = center.x + cx;
      let y = center.y + cy;
      let z = center.z + cz;
      if (mirrorZ) z = -z;
      const idx = i * (radial + 1) + j;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      // Map tube angle into the drawn horn width; length along medial V/U.
      const across = Math.cos(angle);
      let tu = tex.u + across * tex.halfU;
      const tv = tex.v;
      if (mirrorZ) tu = 1 - tu;
      uvs[idx * 2] = tu;
      uvs[idx * 2 + 1] = tv;
      const nx = cx;
      const ny = cy;
      const nz = mirrorZ ? -cz : cz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      normals[idx * 3] = nx / nl;
      normals[idx * 3 + 1] = ny / nl;
      normals[idx * 3 + 2] = nz / nl;
    }
  }

  const indices = [];
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      const c = (i + 1) * (radial + 1) + (j + 1);
      const d = i * (radial + 1) + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  // Closed tip (no opening): fan to tip center.
  const tipCenter = curve.getPointAt(1);
  if (mirrorZ) tipCenter.z = -tipCenter.z;
  const tipIdx = vertCount;
  const tipPos = new Float32Array(positions.length + 3);
  tipPos.set(positions);
  tipPos[positions.length] = tipCenter.x;
  tipPos[positions.length + 1] = tipCenter.y;
  tipPos[positions.length + 2] = tipCenter.z;
  const tipUv = new Float32Array(uvs.length + 2);
  tipUv.set(uvs);
  const tipTex = samplePath(texPathPts, 1);
  tipUv[uvs.length] = mirrorZ ? 1 - tipTex.u : tipTex.u;
  tipUv[uvs.length + 1] = tipTex.v;
  const tipNor = new Float32Array(normals.length + 3);
  tipNor.set(normals);
  const tipT = curve.getTangentAt(1);
  tipNor[normals.length] = tipT.x;
  tipNor[normals.length + 1] = tipT.y;
  tipNor[normals.length + 2] = mirrorZ ? -tipT.z : tipT.z;
  for (let j = 0; j < radial; j++) {
    const a = tubular * (radial + 1) + j;
    const b = tubular * (radial + 1) + (j + 1);
    indices.push(a, tipIdx, b);
  }

  // Closed base: fan buried into skull (opening not visible).
  const baseCenter = curve.getPointAt(0);
  if (mirrorZ) baseCenter.z = -baseCenter.z;
  // Pull base center slightly into skull (+X / rearward).
  baseCenter.x += 0.03;
  const baseIdx = tipIdx + 1;
  const pos2 = new Float32Array(tipPos.length + 3);
  pos2.set(tipPos);
  pos2[tipPos.length] = baseCenter.x;
  pos2[tipPos.length + 1] = baseCenter.y;
  pos2[tipPos.length + 2] = baseCenter.z;
  const uv2 = new Float32Array(tipUv.length + 2);
  uv2.set(tipUv);
  const baseTex = samplePath(texPathPts, 0);
  uv2[tipUv.length] = mirrorZ ? 1 - baseTex.u : baseTex.u;
  uv2[tipUv.length + 1] = baseTex.v;
  const nor2 = new Float32Array(tipNor.length + 3);
  nor2.set(tipNor);
  const baseT = curve.getTangentAt(0);
  nor2[tipNor.length] = -baseT.x;
  nor2[tipNor.length + 1] = -baseT.y;
  nor2[tipNor.length + 2] = mirrorZ ? baseT.z : -baseT.z;
  for (let j = 0; j < radial; j++) {
    const a = j;
    const b = j + 1;
    indices.push(baseIdx, a, b);
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos2, 3));
  geo.setAttribute("uv", new BufferAttribute(uv2, 2));
  geo.setAttribute("normal", new BufferAttribute(nor2, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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

/** World curve for the right horn: texture curvature mapped onto skull attach → tip. */
function buildRightCurve(texPath) {
  const pts = [];
  for (let i = 0; i < texPath.length; i++) {
    const t = i / (texPath.length - 1);
    // Blend attach→tip with the sheet's lateral curve (u shift from base).
    const u0 = texPath[0].u;
    const lateral = (texPath[i].u - u0) / Math.max(1e-6, texPath[texPath.length - 1].u - u0);
    const x = ATTACH.x * (1 - t) + ATTACH.tipX * t;
    // Lift follows texture V, scaled into attach→tip Y.
    const y = ATTACH.y + (ATTACH.tipY - ATTACH.y) * ((texPath[i].v - texPath[0].v) / Math.max(1e-6, texPath[texPath.length - 1].v - texPath[0].v));
    const z = ATTACH.z + (ATTACH.tipZ - ATTACH.z) * (0.15 + 0.85 * Math.max(0, lateral));
    pts.push(new Vector3(x, y, z));
  }
  // Smooth: ease tip a bit more outward.
  return new CatmullRomCurve3(pts, false, "catmullrom", 0.35);
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
const curveR = buildRightCurve(texPathPts);
const geoR = makeTaperedHorn(curveR, [ATTACH.rBase, ATTACH.rTip], texPathPts, false);
const geoL = makeTaperedHorn(curveR, [ATTACH.rBase, ATTACH.rTip], texPathPts, true);
const merged = mergeGeometries([geoL, geoR], false);
if (!merged) throw new Error("merge failed");

const gltf = await loadGlb(glbPath);
const root = gltf.scene;
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

const pos = merged.getAttribute("position");
let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.count; i++) {
  for (let c = 0; c < 3; c++) {
    const v = pos.getComponent(i, c);
    min[c] = Math.min(min[c], v);
    max[c] = Math.max(max[c], v);
  }
}
console.log("Solid closed horns on skull crown", {
  removed: toRemove.length,
  verts: pos.count,
  pathPts: texPathPts.length,
  min: min.map((v) => +v.toFixed(3)),
  max: max.map((v) => +v.toFixed(3)),
});

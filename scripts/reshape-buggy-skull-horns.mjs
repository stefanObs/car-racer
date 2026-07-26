#!/usr/bin/env node
/**
 * Solid curved SkullHorns for Käferkraft that match buggy-skull-horn.png.
 *
 * Attachment: bases seat on the outer horn-stub bosses painted on
 * buggy-skull.png (YZ UVs on the main Skull mesh). A flared root buries
 * into the boss so the join reads as one continuous bone growth.
 *
 * The comic horn sheet is a single horizontal crescent (base left → tip right);
 * medial path + UVs follow that layout.
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
  SphereGeometry,
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
const hornTexPath = join(rootDir, "public/textures/buggy-skull-horn.png");
const skullTexPath = join(rootDir, "public/textures/buggy-skull.png");

const BG = [232, 220, 200];

const HORN = {
  tipX: -1.22,
  tipY: 0.34,
  tipZ: 0.36,
  buryX: 0.06,
  buryY: -0.02,
  buryZ: 0.02,
  collarR: 0.11,
  rFlare: 0.048,
  rBase: 0.036,
  rTip: 0.009,
  tubular: 48,
  radial: 14,
};

function isHornPixel(r, g, b) {
  if (Math.hypot(r - BG[0], g - BG[1], b - BG[2]) < 28) return false;
  if (r > 245 && g > 245 && b > 240) return false;
  return true;
}

/** Horizontal crescent: base (left, wide) → tip (right, sharp). */
async function extractMedialPath() {
  const { data, info } = await sharp(hornTexPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const cols = [];
  for (let x = 0; x < W; x++) {
    let sy = 0;
    let n = 0;
    let y0 = H;
    let y1 = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (!isHornPixel(data[i], data[i + 1], data[i + 2])) continue;
      sy += y;
      n++;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    if (n > 6) {
      cols.push({
        u: x / (W - 1),
        v: 1 - sy / n / (H - 1),
        halfV: (y1 - y0) / 2 / (H - 1),
        n,
      });
    }
  }
  if (cols.length < 8) throw new Error("Could not read horn medial path from texture");
  // Skip the hollow open rim (first ~6% of length) — seat starts on solid bone wall.
  const start = Math.floor(cols.length * 0.06);
  const usable = cols.slice(start);
  const step = Math.max(1, Math.floor(usable.length / 28));
  const path = [];
  for (let i = 0; i < usable.length; i += step) path.push(usable[i]);
  if (path[path.length - 1] !== usable[usable.length - 1]) path.push(usable[usable.length - 1]);
  return path;
}

/**
 * Painted stub faces on buggy-skull.png → nearest Skull mesh verts (YZ planar).
 * Prefer the stub blob centroid (not outer silhouette) so horns cover the art.
 */
async function findStubUVs() {
  const { data, info } = await sharp(skullTexPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const isContent = (px) => {
    const r = data[px];
    const g = data[px + 1];
    const b = data[px + 2];
    return !(r > 220 && g > 200 && b > 170 && Math.abs(r - g) < 40);
  };
  const mean = (u0, u1) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < H * 0.32; y++) {
      for (let x = Math.floor(u0 * (W - 1)); x <= u1 * (W - 1); x++) {
        if (!isContent((y * W + x) * 4)) continue;
        sx += x;
        sy += y;
        n++;
      }
    }
    if (!n) return null;
    return { u: sx / n / (W - 1), v: 1 - sy / n / (H - 1) };
  };
  const left = mean(0, 0.38);
  const right = mean(0.62, 1);
  if (!left || !right) throw new Error("Could not find skull texture horn stubs");
  return { left, right };
}

/**
 * Fallback: crown |Z| peaks on the Skull mesh.
 */
function findSkullStubAnchors(pos) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const yCut = minY + (maxY - minY) * 0.7;
  const left = [];
  const right = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < yCut) continue;
    if (z < 0) left.push({ x, y, z });
    else if (z > 0) right.push({ x, y, z });
  }
  if (!left.length || !right.length) throw new Error("Skull crown stubs not found");
  const tip = (side) => {
    let best = side[0];
    let score = -Infinity;
    for (const v of side) {
      const s = Math.abs(v.z) * 2.5 + v.y - Math.abs(v.x + 1.3) * 0.4;
      if (s > score) {
        score = s;
        best = v;
      }
    }
    return best;
  };
  return { left: tip(left), right: tip(right) };
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
    halfV: a.halfV * (1 - u) + b.halfV * u,
  };
}

function getMainSkullPos(root) {
  let best = null;
  root.traverse((obj) => {
    const mesh = obj;
    if (!mesh.isMesh || !mesh.geometry) return;
    if ((mesh.name ?? "").toLowerCase().includes("knuckle")) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.some((m) => ((m?.name ?? "") + "").toLowerCase() === "skull")) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos || pos.count < 150) return;
    // Prefer the wide face ornament over small boss knuckles.
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    const span = b ? b.max.x - b.min.x + (b.max.y - b.min.y) + (b.max.z - b.min.z) : 0;
    if (!best || span > best.span) best = { pos, count: pos.count, span };
  });
  if (!best) throw new Error("Main Skull mesh not found");
  return best.pos;
}

function skullVertAtUV(pos, tu, tv) {
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
    minZ = Math.min(minZ, pos.getZ(i));
    maxZ = Math.max(maxZ, pos.getZ(i));
  }
  const spanY = Math.max(1e-6, maxY - minY);
  const spanZ = Math.max(1e-6, maxZ - minZ);
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = (z - minZ) / spanZ;
    const v = (y - minY) / spanY;
    const d = Math.hypot(u - tu, v - tv);
    if (d < bd) {
      bd = d;
      best = { x, y, z, u, v, d };
    }
  }
  return best;
}

function buildHornCurve(texPath, base) {
  const pts = [];
  const side = Math.sign(base.z || 1);
  const tipZ = side * HORN.tipZ;
  const v0 = texPath[0].v;
  const v1 = texPath[texPath.length - 1].v;

  // Plant into bone, emerge flush on the painted stub, then peel — no early Y hop.
  pts.push(
    new Vector3(base.x + HORN.buryX, base.y + HORN.buryY, base.z - side * HORN.buryZ),
  );
  pts.push(new Vector3(base.x + HORN.buryX * 0.35, base.y + HORN.buryY * 0.35, base.z - side * HORN.buryZ * 0.35));
  pts.push(new Vector3(base.x, base.y, base.z));
  // Grow along the stub axis (out + slightly up) while still glued.
  pts.push(new Vector3(base.x - 0.01, base.y + 0.012, base.z + side * 0.03));
  pts.push(new Vector3(base.x - 0.02, base.y + 0.035, base.z + side * 0.06));

  for (let i = 1; i < texPath.length; i++) {
    const t = i / (texPath.length - 1);
    const lift = (texPath[i].v - v0) / Math.max(1e-6, v1 - v0);
    const peel = Math.max(0, (t - 0.12) / 0.88);
    const peelEase = peel * peel * (3 - 2 * peel);
    const x = base.x * (1 - peelEase) + HORN.tipX * peelEase;
    const y = base.y + 0.035 + (HORN.tipY - base.y - 0.035) * Math.max(0, lift) * peelEase;
    const z = base.z + (tipZ - base.z) * peelEase;
    pts.push(new Vector3(x, y, z));
  }
  return new CatmullRomCurve3(pts, false, "catmullrom", 0.3);
}

/** Flared root over the stub, then taper to tip. */
function radiusAt(t, rFlare, r0, r1) {
  if (t < 0.1) {
    const u = t / 0.1;
    return r0 * 0.6 * (1 - u) + rFlare * u;
  }
  if (t < 0.28) {
    const u = (t - 0.1) / 0.18;
    const ease = u * u * (3 - 2 * u);
    return rFlare * (1 - ease) + r0 * ease;
  }
  const u = (t - 0.28) / 0.72;
  const ease = u * u * (3 - 2 * u);
  return r0 * (1 - ease) + r1 * ease;
}

/** Soft bone knuckle at the boss so the join reads as growth, not a tube cut. */
function makeCollar(stub, texPathPts) {
  const geo = new SphereGeometry(HORN.collarR, 16, 14);
  // Onion boss: wide on the crown face.
  geo.scale(1.05, 0.95, 0.75);
  const side = Math.sign(stub.z || 1);
  // Sit proud of the bone so the knuckle is the visible root.
  geo.translate(stub.x + 0.005, stub.y + 0.02, stub.z + side * 0.025);
  const uv = geo.getAttribute("uv");
  const base = samplePath(texPathPts, 0.02);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, base.u + (uv.getX(i) - 0.5) * 0.1, base.v + (uv.getY(i) - 0.5) * 0.14);
  }
  return geo;
}

function makeTaperedHorn(curve, rFlare, r0, r1, texPathPts) {
  const tubular = HORN.tubular;
  const radial = HORN.radial;
  // Start the tube inside the collar so the open mouth never shows at the skull.
  const t0 = 0.14;
  const ring = radial + 1;
  const vertCount = (tubular + 1) * ring;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    const t = t0 + (1 - t0) * u;
    const center = curve.getPointAt(t);
    // Frenet frames are indexed by tubular steps of the full curve — resample.
    const normal = new Vector3();
    const binormal = new Vector3();
    const tangent = curve.getTangentAt(t).normalize();
    // Build a stable frame from tangent.
    const up = Math.abs(tangent.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    binormal.crossVectors(tangent, up).normalize();
    normal.crossVectors(binormal, tangent).normalize();
    const r = radiusAt(u, rFlare, r0, r1);
    const texT = Math.max(0, Math.min(1, u));
    const tex = samplePath(texPathPts, texT);
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
      const across = Math.cos(angle);
      uvs[idx * 2] = tex.u;
      uvs[idx * 2 + 1] = tex.v + across * tex.halfV;
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

  // Cap the tube start deep inside the collar (hidden).
  const rootCenter = curve.getPointAt(t0).clone();
  const rootIdx = tipIdx + 1;
  const pos2 = new Float32Array(tipPos.length + 3);
  pos2.set(tipPos);
  pos2[tipPos.length] = rootCenter.x;
  pos2[tipPos.length + 1] = rootCenter.y;
  pos2[tipPos.length + 2] = rootCenter.z;
  const uv2 = new Float32Array(tipUv.length + 2);
  uv2.set(tipUv);
  const rootTex = samplePath(texPathPts, 0);
  uv2[tipUv.length] = rootTex.u;
  uv2[tipUv.length + 1] = rootTex.v;
  for (let j = 0; j < radial; j++) {
    indices.push(rootIdx, j, j + 1);
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
const stubUV = await findStubUVs();

const gltf = await loadGlb(glbPath);
const root = gltf.scene;
const skullPos = getMainSkullPos(root);
const fromUV = {
  right: skullVertAtUV(skullPos, stubUV.right.u, stubUV.right.v),
  left: skullVertAtUV(skullPos, stubUV.left.u, stubUV.left.v),
};
const fromMesh = findSkullStubAnchors(skullPos);
// Blend texture seat (covers painted stubs) with mesh boss (true silhouette).
const stubR = {
  x: fromUV.right.x * 0.8 + fromMesh.right.x * 0.2,
  y: fromUV.right.y * 0.8 + fromMesh.right.y * 0.2,
  z: fromUV.right.z * 0.8 + fromMesh.right.z * 0.2,
};
const stubL = {
  x: fromUV.left.x * 0.8 + fromMesh.left.x * 0.2,
  y: fromUV.left.y * 0.8 + fromMesh.left.y * 0.2,
  z: fromUV.left.z * 0.8 + fromMesh.left.z * 0.2,
};

const curveR = buildHornCurve(texPathPts, stubR);
const curveL = buildHornCurve(texPathPts, stubL);
const geoR = makeTaperedHorn(curveR, HORN.rFlare, HORN.rBase, HORN.rTip, texPathPts);
const geoL = makeTaperedHorn(curveL, HORN.rFlare, HORN.rBase, HORN.rTip, texPathPts);
const collarR = makeCollar(stubR, texPathPts);
const collarL = makeCollar(stubL, texPathPts);
const tubes = mergeGeometries([geoL, geoR], false);
const knuckles = mergeGeometries([collarL, collarR], false);
if (!tubes || !knuckles) throw new Error("merge failed");

const toRemove = [];
root.traverse((obj) => {
  const mesh = obj;
  if (!mesh.isMesh) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const n = mats.map((m) => ((m?.name ?? "") + "").toLowerCase()).join(" ");
  if (n.includes("skullhorn") || mesh.name.toLowerCase().includes("skullhorn")) {
    toRemove.push(mesh);
  }
  if (mesh.name.toLowerCase().includes("skullhornknuckle")) toRemove.push(mesh);
});
for (const m of toRemove) m.removeFromParent();

const hornMat = new MeshStandardMaterial({
  name: "SkullHorn",
  color: 0xffffff,
  roughness: 0.85,
  metalness: 0.05,
});
const knuckleMat = new MeshStandardMaterial({
  // Bone knuckle uses Skull material so runtime applies buggy-skull.png continuously.
  name: "Skull",
  color: 0xffffff,
  roughness: 0.85,
  metalness: 0.05,
});
const hornMesh = new Mesh(tubes, hornMat);
hornMesh.name = "SkullHorns";
const knuckleMesh = new Mesh(knuckles, knuckleMat);
knuckleMesh.name = "SkullHornKnuckles";
// Pin knuckle UVs to the painted stub region of buggy-skull.png (not full-sheet YZ).
{
  const pos = knuckles.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const side = z >= 0 ? stubUV.right : stubUV.left;
    // Small local offset around the stub face so the knuckle reads as bone boss.
    uv[i * 2] = side.u + (z - (z >= 0 ? stubR.z : stubL.z)) * 0.9;
    uv[i * 2 + 1] = side.v + (y - (z >= 0 ? stubR.y : stubL.y)) * 1.2;
  }
  knuckles.setAttribute("uv", new BufferAttribute(uv, 2));
  // Prevent runtime ensureNoseOrnamentUvs from stretching the knuckle across the whole face.
  knuckleMesh.userData.keepAuthoredUvs = true;
}
root.add(hornMesh);
root.add(knuckleMesh);
await exportGlb(root, glbPath);

function emergeDist(curve, stub) {
  const p = curve.getPointAt(0.1);
  return Math.hypot(p.x - stub.x, p.y - stub.y, p.z - stub.z);
}

console.log("Horns seated on blended texture/mesh stubs", {
  removed: toRemove.length,
  stubUV,
  stubR: { x: +stubR.x.toFixed(3), y: +stubR.y.toFixed(3), z: +stubR.z.toFixed(3) },
  stubL: { x: +stubL.x.toFixed(3), y: +stubL.y.toFixed(3), z: +stubL.z.toFixed(3) },
  emergeDistR: +emergeDist(curveR, stubR).toFixed(3),
  emergeDistL: +emergeDist(curveL, stubL).toFixed(3),
  tipR: curveR.getPointAt(1).toArray().map((v) => +v.toFixed(3)),
  tipL: curveL.getPointAt(1).toArray().map((v) => +v.toFixed(3)),
  pathLen: texPathPts.length,
  baseHalfV: +texPathPts[0].halfV.toFixed(3),
  tipHalfV: +texPathPts[texPathPts.length - 1].halfV.toFixed(3),
});

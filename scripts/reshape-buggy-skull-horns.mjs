#!/usr/bin/env node
/**
 * Replace Käferkraft SkullHorn meshes with a single V-shaped double-horn mesh
 * that matches public/textures/buggy-skull-horn.png under YZ ornament UVs.
 *
 * Keeps the last baked horn texture; adapts geometry to its silhouette.
 *
 * Usage: node scripts/reshape-buggy-skull-horns.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";
import {
  BufferAttribute,
  CylinderGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
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

/** UV anchors matching scripts/bake-buggy-skull-horn.mjs → bumper YZ frame. */
const HORN = {
  x: -1.18,
  y0: -0.01,
  y1: 0.31,
  z0: -0.41,
  z1: 0.41,
  baseU: 0.5,
  baseV: 0.02,
  tipLU: 0.06,
  tipLV: 0.92,
  tipRU: 0.94,
  tipRV: 0.92,
  rBase: 0.045,
  rTip: 0.018,
};

function uvToWorld(u, v) {
  const z = HORN.z0 + u * (HORN.z1 - HORN.z0);
  const y = HORN.y0 + v * (HORN.y1 - HORN.y0);
  return new Vector3(HORN.x, y, z);
}

function makeHornArmGeo(base, tip, rBase, rTip) {
  const dir = new Vector3().subVectors(tip, base);
  const len = dir.length();
  dir.normalize();
  const geo = new CylinderGeometry(rTip, rBase, len, 10, 6, false);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  const mid = new Vector3().addVectors(base, tip).multiplyScalar(0.5);
  geo.applyMatrix4(new Matrix4().compose(mid, q, new Vector3(1, 1, 1)));
  return geo;
}

/** Shared YZ sheet UVs (same space for both arms → texture V aligns). */
function applyHornSheetUvs(geo) {
  const pos = geo.getAttribute("position");
  const uvs = new Float32Array(pos.count * 2);
  const spanZ = HORN.z1 - HORN.z0;
  const spanY = HORN.y1 - HORN.y0;
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getZ(i) - HORN.z0) / spanZ;
    uvs[i * 2 + 1] = (pos.getY(i) - HORN.y0) / spanY;
  }
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
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

const base = uvToWorld(HORN.baseU, HORN.baseV);
const tipL = uvToWorld(HORN.tipLU, HORN.tipLV);
const tipR = uvToWorld(HORN.tipRU, HORN.tipRV);

const left = makeHornArmGeo(base, tipL, HORN.rBase, HORN.rTip);
const right = makeHornArmGeo(base, tipR, HORN.rBase, HORN.rTip);
const merged = mergeGeometries([left, right], false);
if (!merged) throw new Error("Failed to merge horn arms");
applyHornSheetUvs(merged);

const mat = new MeshStandardMaterial({
  name: "SkullHorn",
  color: 0xe8dcc8,
  roughness: 0.85,
  metalness: 0.05,
});
const hornMesh = new Mesh(merged, mat);
hornMesh.name = "SkullHorns";
root.add(hornMesh);

await exportGlb(root, glbPath);

const pos = merged.getAttribute("position");
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
console.log("Reshaped SkullHorns to texture V", {
  removed: toRemove.length,
  verts: pos.count,
  tipL: tipL.toArray().map((v) => +v.toFixed(3)),
  tipR: tipR.toArray().map((v) => +v.toFixed(3)),
  yz: { y: [+minY.toFixed(3), +maxY.toFixed(3)], z: [+minZ.toFixed(3), +maxZ.toFixed(3)] },
});

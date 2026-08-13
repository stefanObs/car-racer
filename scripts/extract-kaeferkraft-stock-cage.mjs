#!/usr/bin/env node
/**
 * Split Käferkraft stock roll-cage top out of BodyPaint so Verstärkter Rahmen
 * can replace it (hide StockCage when reinforced_frame is equipped).
 *
 *   node scripts/extract-kaeferkraft-stock-cage.mjs
 *   node scripts/extract-kaeferkraft-stock-cage.mjs --from=path/to/backup.glb
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, prune, weld } from "@gltf-transform/functions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const carPath = join(root, "public/models/cars/kaeferkraft.glb");
const backupPath = join(root, "assets/tripo-out/kaeferkraft/kaeferkraft-pre-cage-split.glb");
const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const srcPath = srcArg || carPath;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Full cabin cage tubes — aggressive so BodyPaint does not keep a ghost hoop. */
function isStockCageVertex(x, y, z) {
  const az = Math.abs(z);
  if (az > 0.95) return false;
  if (x < -0.95 || x > 1.7) return false;
  // Entire upper cabin volume (roof + windshield + rear hoop)
  if (y >= 0.82) return true;
  // Lower side rails / pillar feet / rear legs
  if (y >= 0.42 && az >= 0.28 && az <= 0.95 && x >= -0.75 && x <= 1.55) return true;
  if (y >= 0.42 && x >= 0.45 && x <= 1.65 && az <= 0.9) return true;
  return false;
}

function faceIsCage(a, b, c) {
  let n = 0;
  for (const v of [a, b, c]) if (isStockCageVertex(v[0], v[1], v[2])) n++;
  return n >= 2;
}

function remappedPrimitive(sub, buffer, faces, srcPos, srcNrm, srcUv, material) {
  const used = new Map();
  const newPos = [];
  const newNrm = [];
  const newUv = [];
  const newIdx = [];
  for (const [i0, i1, i2] of faces) {
    for (const old of [i0, i1, i2]) {
      if (!used.has(old)) {
        used.set(old, newPos.length / 3);
        const v = srcPos.getElement(old, []);
        newPos.push(v[0], v[1], v[2]);
        if (srcNrm) {
          const n = srcNrm.getElement(old, []);
          newNrm.push(n[0], n[1], n[2]);
        }
        if (srcUv) {
          const u = srcUv.getElement(old, []);
          newUv.push(u[0], u[1]);
        }
      }
      newIdx.push(used.get(old));
    }
  }
  const p = sub
    .createPrimitive()
    .setAttribute(
      "POSITION",
      sub.createAccessor().setType("VEC3").setArray(new Float32Array(newPos)).setBuffer(buffer),
    )
    .setIndices(sub.createAccessor().setType("SCALAR").setArray(new Uint32Array(newIdx)).setBuffer(buffer))
    .setMaterial(material);
  if (newNrm.length) {
    p.setAttribute(
      "NORMAL",
      sub.createAccessor().setType("VEC3").setArray(new Float32Array(newNrm)).setBuffer(buffer),
    );
  }
  if (newUv.length) {
    p.setAttribute(
      "TEXCOORD_0",
      sub.createAccessor().setType("VEC2").setArray(new Float32Array(newUv)).setBuffer(buffer),
    );
  }
  return p;
}

mkdirSync(dirname(backupPath), { recursive: true });
if (!srcArg) copyFileSync(carPath, backupPath);

const src = await io.read(srcPath);
await src.transform(dedup(), flatten(), weld());

const mesh = src.getRoot().listMeshes()[0];
const prim = mesh?.listPrimitives()[0];
if (!prim) throw new Error("no mesh/prim");
const pos = prim.getAttribute("POSITION");
const idx = prim.getIndices();
const nrm = prim.getAttribute("NORMAL");
const uv = prim.getAttribute("TEXCOORD_0");
const srcMat = prim.getMaterial();
if (!pos || !idx || !srcMat) throw new Error("need POSITION+indices+material");

const bodyFaces = [];
const cageFaces = [];
const triCount = idx.getCount() / 3;
for (let t = 0; t < triCount; t++) {
  const i0 = idx.getScalar(t * 3);
  const i1 = idx.getScalar(t * 3 + 1);
  const i2 = idx.getScalar(t * 3 + 2);
  const a = pos.getElement(i0, []);
  const b = pos.getElement(i1, []);
  const c = pos.getElement(i2, []);
  if (faceIsCage(a, b, c)) cageFaces.push([i0, i1, i2]);
  else bodyFaces.push([i0, i1, i2]);
}

if (cageFaces.length < 200) throw new Error(`cage faces too low: ${cageFaces.length}`);
if (bodyFaces.length < 2000) throw new Error(`body faces too low: ${bodyFaces.length}`);

const out = await io.read(srcPath);
await out.transform(dedup(), flatten(), weld());

const outMesh = out.getRoot().listMeshes()[0];
const outPrim = outMesh.listPrimitives()[0];
const outMat = outPrim.getMaterial();
outMat.setName("BodyPaint");

const buffer = out.getRoot().listBuffers()[0];
const bodyPrim = remappedPrimitive(out, buffer, bodyFaces, pos, nrm, uv, outMat);
const cageMat = outMat.clone();
cageMat.setName("Chrome"); // paint skip; hidden when reinforced_frame on
const cagePrim = remappedPrimitive(out, buffer, cageFaces, pos, nrm, uv, cageMat);

outMesh.listPrimitives().forEach((p) => outMesh.removePrimitive(p));
outMesh.setName("BodyPaint");
outMesh.addPrimitive(bodyPrim);

const cageMesh = out.createMesh("StockCage");
cageMesh.addPrimitive(cagePrim);

const scene = out.getRoot().listScenes()[0];
const roots = scene.listChildren();
let bodyNode = roots[0];
if (!bodyNode) {
  bodyNode = out.createNode("BodyPaint");
  scene.addChild(bodyNode);
}
bodyNode.setName("BodyPaint");
bodyNode.setMesh(outMesh);

// Drop prior StockCage if re-running.
for (const child of [...scene.listChildren()]) {
  if (child.getName() === "StockCage") scene.removeChild(child);
}

const cageNode = out.createNode("StockCage");
cageNode.setMesh(cageMesh);
scene.addChild(cageNode);

await out.transform(prune(), dedup());
const bytes = await io.writeBinary(out);
writeFileSync(carPath, bytes);

let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
for (const [i0, i1, i2] of cageFaces) {
  for (const i of [i0, i1, i2]) {
    const v = pos.getElement(i, []);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[k]);
      max[k] = Math.max(max[k], v[k]);
    }
  }
}

console.log("kaeferkraft.glb stock cage split", {
  bodyFaces: bodyFaces.length,
  cageFaces: cageFaces.length,
  cageAabb: { min, max, center: min.map((m, i) => (m + max[i]) / 2) },
  bytes: bytes.byteLength,
});

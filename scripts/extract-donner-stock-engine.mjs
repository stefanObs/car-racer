#!/usr/bin/env node
/**
 * Split Donnerbüchse stock engine out of the single BodyPaint mesh so
 * Großer Motor can replace it (hide StockEngine when equipped).
 *
 * Writes public/models/cars/donnerbuechse.glb with BodyPaint + StockEngine nodes
 * sharing the comic atlas. Backup → assets/tripo-out/donnerbuechse/ (gitignored).
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, prune, weld } from "@gltf-transform/functions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const carPath = join(root, "public/models/cars/donnerbuechse.glb");
const backupPath = join(root, "assets/tripo-out/donnerbuechse/donnerbuechse-pre-engine-split.glb");
const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const srcPath = srcArg || carPath;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function isEngineBlockVertex(x, y, z) {
  if (z < 0.22 || z > 1.55) return false;
  if (Math.abs(x) > 0.72) return false;
  if (y < 0.38 || y > 1.48) return false;
  return true;
}

function isSidePipeVertex(x, y, z) {
  const ax = Math.abs(x);
  if (ax < 0.5 || ax > 1.15) return false;
  if (z < 0.2 || z > 1.35) return false;
  if (y < 0.22 || y > 0.85) return false;
  return true;
}

/** Crossmember / bay mounts that read as engine frame (should be chrome, not body blue). */
function isBayMountVertex(x, y, z) {
  if (z < 0.35 || z > 1.35) return false;
  if (Math.abs(x) > 0.85) return false;
  if (y < 0.32 || y > 0.72) return false;
  // Keep outer chassis rails (look sheet: body blue) — only center bay.
  if (Math.abs(x) > 0.55 && y < 0.45) return false;
  return true;
}

function isStockEngineVertex(x, y, z) {
  return isEngineBlockVertex(x, y, z) || isSidePipeVertex(x, y, z) || isBayMountVertex(x, y, z);
}

function faceIsEngine(a, b, c) {
  let n = 0;
  for (const v of [a, b, c]) if (isStockEngineVertex(v[0], v[1], v[2])) n++;
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
const engineFaces = [];
const triCount = idx.getCount() / 3;
for (let t = 0; t < triCount; t++) {
  const i0 = idx.getScalar(t * 3);
  const i1 = idx.getScalar(t * 3 + 1);
  const i2 = idx.getScalar(t * 3 + 2);
  const a = pos.getElement(i0, []);
  const b = pos.getElement(i1, []);
  const c = pos.getElement(i2, []);
  if (faceIsEngine(a, b, c)) engineFaces.push([i0, i1, i2]);
  else bodyFaces.push([i0, i1, i2]);
}

if (engineFaces.length < 80) throw new Error(`engine faces too low: ${engineFaces.length}`);
if (bodyFaces.length < 500) throw new Error(`body faces too low: ${bodyFaces.length}`);

// Clone full doc then replace geometry — keeps textures/samplers.
const out = await io.read(srcPath);
await out.transform(dedup(), flatten(), weld());

const outMesh = out.getRoot().listMeshes()[0];
const outPrim = outMesh.listPrimitives()[0];
const outMat = outPrim.getMaterial();
outMat.setName("BodyPaint");

const buffer = out.getRoot().listBuffers()[0];
const bodyPrim = remappedPrimitive(out, buffer, bodyFaces, pos, nrm, uv, outMat);
const engMat = outMat.clone();
engMat.setName("Chrome"); // garage paint skips chrome; mesh hidden when big_engine on
// Distinct factor so prune/dedup does not merge Chrome back into BodyPaint.
engMat.setBaseColorFactor([0.86, 0.89, 0.91, 1]);
engMat.setMetallicFactor(0.55);
engMat.setRoughnessFactor(0.35);
const engPrim = remappedPrimitive(out, buffer, engineFaces, pos, nrm, uv, engMat);

outMesh.listPrimitives().forEach((p) => outMesh.removePrimitive(p));
outMesh.setName("BodyPaint");
outMesh.addPrimitive(bodyPrim);

const engMesh = out.createMesh("StockEngine");
engMesh.addPrimitive(engPrim);

const scene = out.getRoot().listScenes()[0];
const roots = scene.listChildren();
let bodyNode = roots[0];
if (!bodyNode) {
  bodyNode = out.createNode("BodyPaint");
  scene.addChild(bodyNode);
}
bodyNode.setName("BodyPaint");
bodyNode.setMesh(outMesh);

const engNode = out.createNode("StockEngine");
engNode.setMesh(engMesh);
scene.addChild(engNode);

await out.transform(prune(), dedup());
const bytes = await io.writeBinary(out);
writeFileSync(carPath, bytes);
console.log("donnerbuechse.glb stock engine split", {
  bodyFaces: bodyFaces.length,
  engineFaces: engineFaces.length,
  bytes: bytes.byteLength,
});

#!/usr/bin/env node
/**
 * Käferkraft Leichtbau: keep thin side panels on mesh +X (right when looking from
 * behind after yaw π/2), drop chunky mass, mirror the good panels to −X, sit on y=0.
 *
 *   node scripts/fix-kaeferkraft-lightweight.mjs
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld } from "@gltf-transform/functions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const glbPath = join(rootDir, "public/models/parts/kaeferkraft-lightweight_body.glb");
const backupPath = join(rootDir, "tmp/kaeferkraft-lightweight_body.pre-sym.glb");
const sourcePath = existsSync(backupPath) ? backupPath : glbPath;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const src = await io.read(sourcePath);
const prim = src.getRoot().listMeshes()[0]?.listPrimitives()[0];
if (!prim) {
  console.error("no mesh primitive");
  process.exit(1);
}

const posAcc = prim.getAttribute("POSITION");
const nrmAcc = prim.getAttribute("NORMAL");
const uvAcc = prim.getAttribute("TEXCOORD_0");
const idxAcc = prim.getIndices();
const pos = posAcc.getArray();
const nrm = nrmAcc?.getArray() ?? null;
const uv = uvAcc?.getArray() ?? null;
const idx = idxAcc.getArray();
const nV = posAcc.getCount();

const parent = new Int32Array(nV);
for (let i = 0; i < nV; i++) parent[i] = i;
const find = (i) => {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
};
const unite = (a, b) => {
  a = find(a);
  b = find(b);
  if (a !== b) parent[a] = b;
};
for (let i = 0; i < idx.length; i += 3) {
  unite(idx[i], idx[i + 1]);
  unite(idx[i + 1], idx[i + 2]);
}

const comps = new Map();
for (let i = 0; i < nV; i++) {
  const r = find(i);
  let g = comps.get(r);
  if (!g) {
    g = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], verts: 0 };
    comps.set(r, g);
  }
  g.verts++;
  for (let k = 0; k < 3; k++) {
    const v = pos[i * 3 + k];
    g.min[k] = Math.min(g.min[k], v);
    g.max[k] = Math.max(g.max[k], v);
  }
}

/** One outer slim flank (mesh +X); mirror to −X. Extra near-duplicate plates read as chunky. */
const keepRoot = new Set();
let best = null;
for (const [root, g] of comps) {
  const size = g.min.map((m, i) => g.max[i] - m);
  const center = g.min.map((m, i) => (m + g.max[i]) / 2);
  const outerRight = center[0] >= 0.55;
  const slimFlank = size[0] < 0.08 && size[2] > 1.0 && size[1] < 0.35 && g.verts >= 20;
  if (!outerRight || !slimFlank) continue;
  if (!best || g.verts > best.verts) best = { root, verts: g.verts };
}
if (best) keepRoot.add(best.root);

const keepVert = new Set();
for (let i = 0; i < nV; i++) {
  if (keepRoot.has(find(i))) keepVert.add(i);
}

const keptFaces = [];
let dropped = 0;
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i];
  const b = idx[i + 1];
  const c = idx[i + 2];
  if (keepVert.has(a) && keepVert.has(b) && keepVert.has(c)) keptFaces.push([a, b, c]);
  else dropped++;
}

const outPos = [];
const outNrm = [];
const outUv = [];
const outIdx = [];
const vertMap = new Map();

function emitVert(vi, mirrorX) {
  const key = `${vi}:${mirrorX ? 1 : 0}`;
  const existing = vertMap.get(key);
  if (existing != null) return existing;
  const x = mirrorX ? -pos[vi * 3] : pos[vi * 3];
  const y = pos[vi * 3 + 1];
  const z = pos[vi * 3 + 2];
  const oi = outPos.length / 3;
  outPos.push(x, y, z);
  if (nrm) outNrm.push(mirrorX ? -nrm[vi * 3] : nrm[vi * 3], nrm[vi * 3 + 1], nrm[vi * 3 + 2]);
  if (uv) outUv.push(uv[vi * 2], uv[vi * 2 + 1]);
  vertMap.set(key, oi);
  return oi;
}

function addFace(a, b, c, mirrorX) {
  const ia = emitVert(a, mirrorX);
  const ib = emitVert(b, mirrorX);
  const ic = emitVert(c, mirrorX);
  if (mirrorX) outIdx.push(ia, ic, ib);
  else outIdx.push(ia, ib, ic);
}

for (const [a, b, c] of keptFaces) {
  addFace(a, b, c, false);
  addFace(a, b, c, true);
}

let minY = Infinity;
let minX = Infinity;
let maxX = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;
for (let i = 0; i < outPos.length; i += 3) {
  minY = Math.min(minY, outPos[i + 1]);
  minX = Math.min(minX, outPos[i]);
  maxX = Math.max(maxX, outPos[i]);
  minZ = Math.min(minZ, outPos[i + 2]);
  maxZ = Math.max(maxZ, outPos[i + 2]);
}
const midX = (minX + maxX) / 2;
const midZ = (minZ + maxZ) / 2;
for (let i = 0; i < outPos.length; i += 3) {
  outPos[i] -= midX;
  outPos[i + 1] -= minY;
  outPos[i + 2] -= midZ;
}

if (!existsSync(backupPath) && sourcePath === glbPath) copyFileSync(glbPath, backupPath);

const doc = new Document();
const buffer = doc.createBuffer();
const position = doc
  .createAccessor()
  .setType("VEC3")
  .setArray(new Float32Array(outPos))
  .setBuffer(buffer);
const indices = doc
  .createAccessor()
  .setType("SCALAR")
  .setArray(new Uint32Array(outIdx))
  .setBuffer(buffer);
const outPrim = doc.createPrimitive().setAttribute("POSITION", position).setIndices(indices);
if (outNrm.length) {
  outPrim.setAttribute(
    "NORMAL",
    doc.createAccessor().setType("VEC3").setArray(new Float32Array(outNrm)).setBuffer(buffer),
  );
}
if (outUv.length) {
  outPrim.setAttribute(
    "TEXCOORD_0",
    doc.createAccessor().setType("VEC2").setArray(new Float32Array(outUv)).setBuffer(buffer),
  );
}

const matName = prim.getMaterial()?.getName() || "Carbon";
outPrim.setMaterial(doc.createMaterial(matName).setBaseColorFactor([0.2, 0.82, 0.92, 1]));
const mesh = doc.createMesh("kaeferkraft-lightweight_body").addPrimitive(outPrim);
doc.createScene("Scene").addChild(doc.createNode("kaeferkraft-lightweight_body").setMesh(mesh));

await doc.transform(weld(), dedup(), prune());
await io.write(glbPath, doc);

let maxY = 0;
for (let i = 1; i < outPos.length; i += 3) maxY = Math.max(maxY, outPos[i]);
console.log(
  JSON.stringify(
    {
      source: sourcePath,
      keptComponents: keepRoot.size,
      keptFaces: keptFaces.length,
      droppedFaces: dropped,
      outVerts: outPos.length / 3,
      outFaces: outIdx.length / 3,
      height: +maxY.toFixed(3),
      spanX: +(maxX - minX).toFixed(3),
      spanZ: +(maxZ - minZ).toFixed(3),
    },
    null,
    2,
  ),
);

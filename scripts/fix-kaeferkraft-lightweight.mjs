#!/usr/bin/env node
/**
 * Käferkraft Leichtbau: keep thin outer hole flanks on mesh +X (→ car ±Z after
 * yaw π/2), drop chunky interior mass, mirror to −X, sit on y=0, then emit
 * detached `LightweightL` / `LightweightR` (command either side in F6).
 * Mesh +X → car −Z after mount yaw π/2 = left; mesh −X → car +Z = right.
 * Nose/hood plates need a different yaw — not included in this kit mesh.
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
const alreadySplit =
  src.getRoot().listNodes().some((n) => n.getName() === "LightweightL") &&
  src.getRoot().listNodes().some((n) => n.getName() === "LightweightR");
if (alreadySplit && sourcePath === glbPath) {
  console.log(JSON.stringify({ source: sourcePath, alreadySplit: true }, null, 2));
  process.exit(0);
}
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

const listed = [...comps.entries()].map(([root, g]) => {
  const size = g.min.map((m, i) => g.max[i] - m);
  const center = g.min.map((m, i) => (m + g.max[i]) / 2);
  return { root, verts: g.verts, size, center };
});

/** Outer side-rail flanks (slightly thicker than a single paper plate). */
function isRightFlank(c) {
  return (
    c.center[0] >= 0.55 &&
    c.size[0] < 0.14 &&
    c.size[2] > 0.75 &&
    c.size[1] < 0.4 &&
    c.verts >= 20
  );
}

const keepRoot = new Set();
const rightFlanks = listed.filter(isRightFlank).sort((a, b) => b.verts - a.verts);
for (const c of rightFlanks.slice(0, 2)) keepRoot.add(c.root);

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

const leftFaces = [];
const rightFaces = [];
for (let i = 0; i < outIdx.length; i += 3) {
  const a = outIdx[i];
  const b = outIdx[i + 1];
  const c = outIdx[i + 2];
  const cx = (outPos[a * 3] + outPos[b * 3] + outPos[c * 3]) / 3;
  if (cx >= 0) rightFaces.push([a, b, c]);
  else leftFaces.push([a, b, c]);
}

const doc = new Document();
const buffer = doc.createBuffer();
const mat = doc
  .createMaterial(prim.getMaterial()?.getName() || "Carbon")
  .setBaseColorFactor([0.2, 0.82, 0.92, 1]);

function sideNode(name, faces) {
  const pos = [];
  const nrm = [];
  const uv = [];
  const idx = [];
  const vertMap = new Map();
  const emit = (vi) => {
    const existing = vertMap.get(vi);
    if (existing != null) return existing;
    const oi = pos.length / 3;
    pos.push(outPos[vi * 3], outPos[vi * 3 + 1], outPos[vi * 3 + 2]);
    if (outNrm.length) nrm.push(outNrm[vi * 3], outNrm[vi * 3 + 1], outNrm[vi * 3 + 2]);
    if (outUv.length) uv.push(outUv[vi * 2], outUv[vi * 2 + 1]);
    vertMap.set(vi, oi);
    return oi;
  };
  for (const [a, b, c] of faces) idx.push(emit(a), emit(b), emit(c));

  let cx = 0;
  let cy = 0;
  let cz = 0;
  const n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) {
    cx += pos[i];
    cy += pos[i + 1];
    cz += pos[i + 2];
  }
  cx /= n;
  cy /= n;
  cz /= n;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] -= cx;
    pos[i + 1] -= cy;
    pos[i + 2] -= cz;
  }

  const outPrim = doc
    .createPrimitive()
    .setAttribute(
      "POSITION",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer),
    )
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(idx)).setBuffer(buffer))
    .setMaterial(mat);
  if (nrm.length) {
    outPrim.setAttribute(
      "NORMAL",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(nrm)).setBuffer(buffer),
    );
  }
  if (uv.length) {
    outPrim.setAttribute(
      "TEXCOORD_0",
      doc.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buffer),
    );
  }
  const mesh = doc.createMesh(name).addPrimitive(outPrim);
  const node = doc.createNode(name).setMesh(mesh).setTranslation([cx, cy, cz]);
  return { node, verts: n, faces: faces.length, center: [+cx.toFixed(3), +cy.toFixed(3), +cz.toFixed(3)] };
}

// Mesh +X → car −Z after yaw π/2 = left; mesh −X → car +Z = right.
const lightL = sideNode("LightweightL", rightFaces);
const lightR = sideNode("LightweightR", leftFaces);
const root = doc.createNode("kaeferkraft-lightweight_body").addChild(lightL.node).addChild(lightR.node);
doc.createScene("Scene").addChild(root);

await doc.transform(weld(), dedup(), prune());
await io.write(glbPath, doc);

console.log(
  JSON.stringify(
    {
      source: sourcePath,
      keptComponents: keepRoot.size,
      rightFlanks: rightFlanks.length,
      keptFaces: keptFaces.length,
      droppedFaces: dropped,
      LightweightL: { verts: lightL.verts, faces: lightL.faces, center: lightL.center },
      LightweightR: { verts: lightR.verts, faces: lightR.faces, center: lightR.center },
    },
    null,
    2,
  ),
);

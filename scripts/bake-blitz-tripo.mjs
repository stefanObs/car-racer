#!/usr/bin/env node
/**
 * Bake Tripo Blitz GT into the arcade GLB (nose +Z, BodyPaint atlas).
 *
 * Source (gitignored under assets/tripo-out/blitz/): textured model.glb
 *
 * Usage: node scripts/bake-blitz-tripo.mjs
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
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

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tripoDir = join(rootDir, "assets/tripo-out/blitz");
const carsDir = join(rootDir, "public/models/cars");

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

function rotateY180(doc) {
  forEachPosition(doc, (v, n) => {
    v[0] = -v[0];
    v[2] = -v[2];
    if (n) {
      n[0] = -n[0];
      n[2] = -n[2];
    }
  });
}

/** Map Tripo camera/face (+X) onto Blitz race forward (+Z): (x,z) → (−z, x). */
function facePosZFromTripoX(doc) {
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

function centerSitScale(doc, { targetLen, maxSpan }) {
  const s0 = sceneSize(doc);
  const len = Math.max(s0.size[0], s0.size[2]);
  let scale = targetLen / Math.max(len, 1e-6);
  const span = Math.max(s0.size[0], s0.size[2]) * scale;
  if (maxSpan && span > maxSpan) scale *= maxSpan / span;
  const minY = s0.min[1];
  forEachPosition(doc, (v) => {
    v[0] = (v[0] - s0.cx) * scale;
    v[1] = (v[1] - minY) * scale;
    v[2] = (v[2] - s0.cz) * scale;
  });
  return sceneSize(doc);
}

/** Cabin/spoiler is taller than the nose — put that half at −Z (rear). */
function cabinTowardNegZ(doc) {
  const s = sceneSize(doc);
  const mid = (s.min[2] + s.max[2]) / 2;
  let maxYNeg = -Infinity;
  let maxYPos = -Infinity;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        if (v[2] < mid) maxYNeg = Math.max(maxYNeg, v[1]);
        else maxYPos = Math.max(maxYPos, v[1]);
      }
    }
  }
  if (maxYPos > maxYNeg + 0.01) rotateY180(doc);
}

function comicMaterial(doc, name) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setName(name);
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.85);
    mat.setBaseColorFactor([1, 1, 1, 1]);
    mat.setNormalTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setOcclusionTexture(null);
    mat.setEmissiveTexture(null);
    for (const ext of [...mat.listExtensions()]) ext.dispose();
  }
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
  const preferred = [
    join(dir, "texture/model.glb"),
    join(dir, "blitz-body.glb"),
    join(dir, "model.glb"),
  ];
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

async function loadPrepared(path) {
  if (!existsSync(path)) throw new Error(`Missing Tripo source: ${path}`);
  const doc = await io.read(path);
  await doc.transform(flatten(), dedup());
  bakeAllNodeTransforms(doc);
  await doc.transform(dedup(), prune());
  return doc;
}

const src = findSourceGlb(tripoDir);
if (!src) throw new Error(`No GLB under ${tripoDir}`);
const doc = await loadPrepared(src);
facePosZFromTripoX(doc);
cabinTowardNegZ(doc);
const sized = centerSitScale(doc, { targetLen: 3.7, maxSpan: 3.9 });
comicMaterial(doc, "BodyPaint");
await simplifyDoc(doc, 0.22);
mkdirSync(carsDir, { recursive: true });
const bytes = await io.writeBinary(doc);
writeFileSync(join(carsDir, "blitz.glb"), bytes);
console.log("blitz.glb ← Tripo GT", {
  src,
  bytes: bytes.byteLength,
  size: sized.size.map((v) => +v.toFixed(3)),
});

#!/usr/bin/env node
/**
 * Bake Tripo Käferkraft body + nose props into arcade GLBs.
 *
 * Sources (gitignored under assets/tripo-out/):
 *   body convert GLB, skull/dog/bird textured GLBs
 *
 * Usage: node scripts/bake-kaeferkraft-tripo.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
const tripoDir = join(rootDir, "assets/tripo-out");
const carsDir = join(rootDir, "public/models/cars");
const propsDir = join(rootDir, "public/models/props");

const BODY_SRC = join(tripoDir, "body/tripo-out/372626ca-convert-651b7073/model.glb");
const BODY_FALLBACK = join(tripoDir, "body/texture/model.glb");
const SKULL_SRC = join(tripoDir, "skull/kaeferkraft-skull.glb");
const DOG_SRC = join(tripoDir, "dog/kaeferkraft-dog.glb");
const BIRD_SRC = join(tripoDir, "bird/kaeferkraft-bird.glb");

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

/** Rotate 90° around Y so +Z facing becomes −X (game forward). */
function yawToNegX(doc) {
  // (x, z) → (−z, x) maps +Z to −X
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

function centerSitScale(doc, { targetLen, targetH, maxSpan }) {
  const s0 = sceneSize(doc);
  const len = Math.max(s0.size[0], s0.size[2]);
  let scale = targetLen ? targetLen / Math.max(len, 1e-6) : targetH / Math.max(s0.size[1], 1e-6);
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

/** Rear half has the taller roll cage — put that at +X, nose at −X. */
function noseTowardNegX(doc) {
  const s = sceneSize(doc);
  const mid = (s.min[0] + s.max[0]) / 2;
  let maxYNeg = -Infinity;
  let maxYPos = -Infinity;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        if (v[0] < mid) maxYNeg = Math.max(maxYNeg, v[1]);
        else maxYPos = Math.max(maxYPos, v[1]);
      }
    }
  }
  // Taller half is the cage/cabin = rear. If the tall half is already +X, nose is −X.
  if (maxYNeg > maxYPos + 0.01) rotateY180(doc);
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

async function loadPrepared(path) {
  if (!existsSync(path)) throw new Error(`Missing Tripo source: ${path}`);
  const doc = await io.read(path);
  await doc.transform(flatten(), dedup());
  bakeAllNodeTransforms(doc);
  await doc.transform(dedup(), prune());
  return doc;
}

async function bakeBody() {
  const src = existsSync(BODY_SRC) ? BODY_SRC : BODY_FALLBACK;
  const doc = await loadPrepared(src);
  noseTowardNegX(doc);
  const sized = centerSitScale(doc, { targetLen: 3.35, maxSpan: 3.5 });
  comicMaterial(doc, "BodyPaint");
  await simplifyDoc(doc, 0.22);
  mkdirSync(carsDir, { recursive: true });
  const bytes = await io.writeBinary(doc);
  writeFileSync(join(carsDir, "kaeferkraft.glb"), bytes);
  console.log("kaeferkraft.glb ← Tripo buggy", {
    bytes: bytes.byteLength,
    size: sized.size.map((v) => +v.toFixed(3)),
  });
}

async function bakeProp(src, outName, { targetH, maxSpan, simplifyRatio }) {
  const doc = await loadPrepared(src);
  yawToNegX(doc);
  const sized = centerSitScale(doc, { targetH, maxSpan });
  comicMaterial(doc, outName.includes("skull") ? "Skull" : "Body");
  await simplifyDoc(doc, simplifyRatio);
  mkdirSync(propsDir, { recursive: true });
  const bytes = await io.writeBinary(doc);
  const live = join(propsDir, outName);
  writeFileSync(live, bytes);
  console.log(`${outName} ← Tripo`, {
    bytes: bytes.byteLength,
    h: +sized.size[1].toFixed(3),
    span: +Math.max(sized.size[0], sized.size[2]).toFixed(3),
  });
}

await bakeBody();
await bakeProp(SKULL_SRC, "buggy-skull.glb", { targetH: 0.42, maxSpan: 0.55, simplifyRatio: 0.45 });
await bakeProp(DOG_SRC, "buggy-dog.glb", { targetH: 0.4, maxSpan: 0.48, simplifyRatio: 0.4 });
await bakeProp(BIRD_SRC, "buggy-bird.glb", { targetH: 0.36, maxSpan: 0.5, simplifyRatio: 0.45 });

#!/usr/bin/env node
/**
 * Bake the shared Asphalt-Comic wheel (Tripo P1 + texture) for runtime spin.
 *
 * Source (gitignored): assets/tripo-out/wheels/comic-wheel/
 * Output: public/models/props/comic-wheel.glb
 *
 * Axle along +X, hub at origin, radius 0.5, material Tire.
 * Usage: node scripts/bake-wheels-tripo.mjs
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
const tripoDir = join(rootDir, "assets/tripo-out/wheels/comic-wheel");
const outDir = join(rootDir, "public/models/props");
const outPath = join(outDir, "comic-wheel.glb");

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

/** Permute so the thinnest extent (axle) becomes X. */
function axleAlongX(doc) {
  const s = sceneSize(doc);
  const axis = s.size[0] <= s.size[1] && s.size[0] <= s.size[2] ? 0 : s.size[1] <= s.size[2] ? 1 : 2;
  if (axis === 0) return;
  forEachPosition(doc, (v, n) => {
    if (axis === 1) {
      const x = v[0];
      const y = v[1];
      v[0] = y;
      v[1] = -x;
      if (n) {
        const nx = n[0];
        const ny = n[1];
        n[0] = ny;
        n[1] = -nx;
      }
    } else {
      const x = v[0];
      const z = v[2];
      v[0] = z;
      v[2] = -x;
      if (n) {
        const nx = n[0];
        const nz = n[2];
        n[0] = nz;
        n[2] = -nx;
      }
    }
  });
}

function centerAndScale(doc, targetRadius) {
  const s0 = sceneSize(doc);
  const radius = Math.max(s0.size[1], s0.size[2]) * 0.5;
  const scale = targetRadius / Math.max(radius, 1e-6);
  forEachPosition(doc, (v) => {
    v[0] = (v[0] - s0.cx) * scale;
    v[1] = (v[1] - s0.cy) * scale;
    v[2] = (v[2] - s0.cz) * scale;
  });
  return sceneSize(doc);
}

function comicTireMaterial(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setName("Tire");
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.92);
    mat.setBaseColorFactor([1, 1, 1, 1]);
    mat.setNormalTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setOcclusionTexture(null);
    mat.setEmissiveTexture(null);
    for (const ext of [...mat.listExtensions()]) ext.dispose();
  }
}

function nameWheelNodes(doc) {
  for (const mesh of doc.getRoot().listMeshes()) mesh.setName("Tire");
  for (const node of doc.getRoot().listNodes()) {
    if (node.getMesh()) node.setName("Wheel");
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
  const preferred = [join(dir, "texture/model.glb"), join(dir, "model.glb")];
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
axleAlongX(doc);
const sized = centerAndScale(doc, 0.5);
comicTireMaterial(doc);
nameWheelNodes(doc);
await simplifyDoc(doc, 0.45);
mkdirSync(outDir, { recursive: true });
const bytes = await io.writeBinary(doc);
writeFileSync(outPath, bytes);
console.log("comic-wheel.glb ← Tripo wheel", {
  src,
  bytes: bytes.byteLength,
  size: sized.size.map((v) => +v.toFixed(3)),
  radius: +Math.max(sized.size[1], sized.size[2]).toFixed(3) / 2,
});

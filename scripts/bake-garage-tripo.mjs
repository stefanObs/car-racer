#!/usr/bin/env node
/**
 * Bake Tripo garage workshop props into arcade GLBs (sit y=0, BodyPaint atlas).
 *
 * Sources (gitignored under assets/tripo-out/garage/): textured model.glb
 *
 * Usage: node scripts/bake-garage-tripo.mjs
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { clearNodeTransform, dedup, flatten, getBounds, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tripoRoot = join(rootDir, "assets/tripo-out/garage");
const outDir = join(rootDir, "public/models/garage");

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Height in meters + max XZ span. Front stays Tripo +X. */
const PROPS = [
  { id: "cabinet", dir: "cabinet", file: "cabinet.glb", targetH: 2.0, maxSpan: 1.35, ratio: 0.32 },
  { id: "workbench", dir: "workbench", file: "workbench.glb", targetH: 1.15, maxSpan: 2.35, ratio: 0.3 },
  { id: "tire-stack", dir: "tire-stack", file: "tire-stack.glb", targetH: 1.2, maxSpan: 1.05, ratio: 0.35 },
  { id: "shelf", dir: "shelf", file: "shelf.glb", targetH: 1.85, maxSpan: 2.35, ratio: 0.28 },
  { id: "drums", dir: "drums", file: "drums.glb", targetH: 0.9, maxSpan: 1.55, ratio: 0.4 },
  { id: "toolchest", dir: "toolchest", file: "toolchest.glb", targetH: 1.15, maxSpan: 1.2, ratio: 0.32 },
  { id: "gas", dir: "gas", file: "gas.glb", targetH: 1.35, maxSpan: 0.85, ratio: 0.35 },
  { id: "hoist", dir: "hoist", file: "hoist.glb", targetH: 2.4, maxSpan: 2.35, ratio: 0.38 },
];

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

function centerSitScale(doc, { targetH, maxSpan }) {
  const s0 = sceneSize(doc);
  let scale = targetH / Math.max(s0.size[1], 1e-6);
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

async function bakeOne(spec) {
  const srcDir = join(tripoRoot, spec.dir);
  const src = findSourceGlb(srcDir);
  if (!src) throw new Error(`No GLB under ${srcDir}`);
  const doc = await loadPrepared(src);
  const sized = centerSitScale(doc, { targetH: spec.targetH, maxSpan: spec.maxSpan });
  comicMaterial(doc, "BodyPaint");
  await simplifyDoc(doc, spec.ratio);
  const bytes = await io.writeBinary(doc);
  writeFileSync(join(outDir, spec.file), bytes);
  return {
    id: spec.id,
    src,
    bytes: bytes.byteLength,
    size: sized.size.map((v) => +v.toFixed(3)),
  };
}

mkdirSync(outDir, { recursive: true });
const reports = [];
for (const spec of PROPS) {
  reports.push(await bakeOne(spec));
}
console.log("garage Tripo bake", reports);

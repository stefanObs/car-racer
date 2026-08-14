#!/usr/bin/env node
/**
 * Bake Tripo comic FX chunks into arcade GLBs (shared by every car).
 *
 * Sources (gitignored under assets/tripo-out/fx/): textured model.glb per chunk.
 *
 * Usage: node scripts/bake-fx-tripo.mjs
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
const tripoFx = join(rootDir, "assets/tripo-out/fx");
const outDir = join(rootDir, "public/models/fx");

const JOBS = [
  { id: "smoke-puff", mat: "SmokePuff", longest: 0.55, sit: true, alignLongZ: false, bluntPosZ: false, ratio: 0.45, error: 0.0012 },
  { id: "smoke-heavy", mat: "SmokeHeavy", longest: 0.75, sit: true, alignLongZ: false, bluntPosZ: false, ratio: 0.45, error: 0.0012 },
  { id: "repair-spark", mat: "RepairSpark", longest: 0.25, sit: false, alignLongZ: false, bluntPosZ: false, ratio: 0.45, error: 0.0012 },
  // Keep flame tails — old ratio 0.02 collapsed the Tripo mesh into a sphere-like blob.
  { id: "nitro-orange", mat: "NitroOrange", longest: 0.85, sit: false, alignLongZ: true, bluntPosZ: true, ratio: 0.05, error: 0.0025, baseColor: [1, 0.478, 0.094, 1] },
  { id: "nitro-cyan", mat: "NitroCyan", longest: 0.85, sit: false, alignLongZ: true, bluntPosZ: true, ratio: 0.05, error: 0.0025, baseColor: [0.239, 0.725, 0.78, 1] },
  { id: "lap-shield", mat: "LapShield", longest: 1.4, sit: false, alignLongZ: false, bluntPosZ: false, ratio: 0.4, error: 0.0015 },
];

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

function rotateY90(doc) {
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

function rotateX90(doc) {
  forEachPosition(doc, (v, n) => {
    const y = v[1];
    const z = v[2];
    v[1] = -z;
    v[2] = y;
    if (n) {
      const ny = n[1];
      const nz = n[2];
      n[1] = -nz;
      n[2] = ny;
    }
  });
}

function longestAxis(size) {
  if (size[0] >= size[1] && size[0] >= size[2]) return 0;
  if (size[1] >= size[0] && size[1] >= size[2]) return 1;
  return 2;
}

function alignLongestToZ(doc) {
  const axis = longestAxis(sceneSize(doc).size);
  if (axis === 0) rotateY90(doc);
  else if (axis === 1) rotateX90(doc);
}

function halfMaxRadiusXY(doc, positiveZ) {
  const s = sceneSize(doc);
  const mid = (s.min[2] + s.max[2]) / 2;
  let maxR = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        if (positiveZ ? v[2] < mid : v[2] >= mid) continue;
        const r = Math.hypot(v[0] - s.cx, v[1] - s.cy);
        if (r > maxR) maxR = r;
      }
    }
  }
  return maxR;
}

/** Teardrop head (blunt) toward +Z so the tail streams −Z behind the car. */
function bluntTowardPosZ(doc) {
  const posR = halfMaxRadiusXY(doc, true);
  const negR = halfMaxRadiusXY(doc, false);
  if (negR > posR + 0.001) rotateY180(doc);
}

function centerScale(doc, { longest, sit }) {
  const s0 = sceneSize(doc);
  const span = Math.max(s0.size[0], s0.size[1], s0.size[2]);
  const scale = longest / Math.max(span, 1e-6);
  const minY = s0.min[1];
  forEachPosition(doc, (v) => {
    v[0] = (v[0] - s0.cx) * scale;
    v[1] = sit ? (v[1] - minY) * scale : (v[1] - s0.cy) * scale;
    v[2] = (v[2] - s0.cz) * scale;
  });
  return sceneSize(doc);
}

function comicMaterial(doc, name, baseColor = [1, 1, 1, 1]) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setName(name);
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.85);
    mat.setBaseColorFactor(baseColor);
    mat.setNormalTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setOcclusionTexture(null);
    mat.setEmissiveTexture(null);
    for (const ext of [...mat.listExtensions()]) ext.dispose();
  }
}

async function simplifyDoc(doc, ratio, error = 0.0012) {
  await MeshoptSimplifier.ready;
  const steps = [weld({ tolerance: 0.0002 }), dedup()];
  if (ratio < 0.999) {
    steps.splice(1, 0, simplify({ simplifier: MeshoptSimplifier, ratio, error }));
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

async function bakeOne(job) {
  const srcDir = join(tripoFx, job.id);
  const fallbackDir = job.id === "nitro-cyan" ? join(tripoFx, "nitro-orange") : null;
  const src = findSourceGlb(srcDir) ?? (fallbackDir ? findSourceGlb(fallbackDir) : null);
  if (!src) throw new Error(`No GLB under ${srcDir}`);
  const doc = await loadPrepared(src);
  if (job.alignLongZ) alignLongestToZ(doc);
  if (job.bluntPosZ) bluntTowardPosZ(doc);
  const sized = centerScale(doc, { longest: job.longest, sit: job.sit });
  comicMaterial(doc, job.mat, job.baseColor ?? [1, 1, 1, 1]);
  await simplifyDoc(doc, job.ratio, job.error);
  mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, `${job.id}.glb`);
  const bytes = await io.writeBinary(doc);
  writeFileSync(dest, bytes);
  console.log(`${job.id}.glb ← Tripo FX`, {
    src,
    bytes: bytes.byteLength,
    size: sized.size.map((v) => +v.toFixed(3)),
  });
}

for (const job of JOBS) {
  await bakeOne(job);
}

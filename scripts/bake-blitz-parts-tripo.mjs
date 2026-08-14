#!/usr/bin/env node
/**
 * Bake Tripo Blitz tuning-part add-ons → public/models/parts/blitz-*.glb
 *
 * Sources (gitignored): assets/tripo-out/parts/blitz/<id>/
 * Usage: node scripts/bake-blitz-parts-tripo.mjs
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
const srcRoot = join(rootDir, "assets/tripo-out/parts/blitz");
const outDir = join(rootDir, "public/models/parts");

/** Nose +Z, cabin −Z — same as Blitz body. Rear parts extra yaw 180. */
const JOBS = [
  // Heckspoiler stays the extracted original wing (`npm run cars:extract-blitz-spoiler`) — not Tripo.
  { id: "big_engine", material: "Carbon", toward: "+z", targetSpan: 0.85, maxH: 0.38, simplify: 0.4 },
  { id: "nitro_kit", material: "NitroKit", toward: "-z", targetSpan: 0.9, maxH: 0.42, simplify: 0.4 },
  { id: "spike_bumper", material: "Spike", toward: "+z", targetSpan: 1.68, maxH: 0.32, simplify: 0.4 },
  { id: "offroad_suspension", material: "Spring", toward: "+z", targetSpan: 0.5, maxH: 0.34, simplify: 0.45 },
  // Sill armor + rear V-cage; squeeze width; lift aft hoop onto rear deck.
  {
    id: "reinforced_frame",
    material: "Grey",
    toward: "+z",
    targetSpan: 1.72,
    targetWidth: 1.52,
    maxH: 0.88,
    simplify: 0.35,
    liftAft: { fromZ: -0.2, lift: 0.55 },
  },
  { id: "lightweight_body", material: "Carbon", toward: "+z", targetSpan: 0.85, maxH: 0.24, simplify: 0.4 },
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

function centerSitScale(doc, { targetSpan, maxH, targetWidth }) {
  const s0 = sceneSize(doc);
  const span0 = Math.max(s0.size[0], s0.size[2]);
  let scale = targetSpan / Math.max(span0, 1e-6);
  const h = s0.size[1] * scale;
  if (maxH && h > maxH) scale *= maxH / h;
  const minY = s0.min[1];
  forEachPosition(doc, (v) => {
    v[0] = (v[0] - s0.cx) * scale;
    v[1] = (v[1] - minY) * scale;
    v[2] = (v[2] - s0.cz) * scale;
  });
  if (targetWidth) {
    const s1 = sceneSize(doc);
    const wScale = targetWidth / Math.max(s1.size[0], 1e-6);
    if (Math.abs(wScale - 1) > 0.01) {
      forEachPosition(doc, (v) => {
        v[0] *= wScale;
      });
    }
  }
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

function liftAftRegion(doc, { fromZ, lift }) {
  forEachPosition(doc, (v) => {
    if (v[2] >= fromZ) return;
    const t = Math.min(1, (fromZ - v[2]) / Math.max(0.35, Math.abs(fromZ) + 0.01));
    v[1] += lift * t;
  });
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

async function bakeJob(job) {
  const dir = join(srcRoot, job.id);
  const src = findSourceGlb(dir);
  if (!src) throw new Error(`No GLB under ${dir}`);
  const doc = await loadPrepared(src);
  facePosZFromTripoX(doc);
  if (job.toward === "-z") rotateY180(doc);
  const sized = centerSitScale(doc, {
    targetSpan: job.targetSpan,
    maxH: job.maxH,
    targetWidth: job.targetWidth,
  });
  if (job.liftAft) liftAftRegion(doc, job.liftAft);
  comicMaterial(doc, job.material);
  await simplifyDoc(doc, job.simplify);
  const finalSize = sceneSize(doc);
  mkdirSync(outDir, { recursive: true });
  const bytes = await io.writeBinary(doc);
  const out = join(outDir, `blitz-${job.id}.glb`);
  writeFileSync(out, bytes);
  console.log(`blitz-${job.id}.glb ← Tripo part`, {
    src,
    bytes: bytes.byteLength,
    size: finalSize.size.map((v) => +v.toFixed(3)),
  });
}

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const jobs = only ? JOBS.filter((j) => j.id === only) : JOBS;
if (only && !jobs.length) {
  console.error(`Unknown --only=${only}`);
  process.exit(1);
}

const missing = [];
for (const job of jobs) {
  try {
    await bakeJob(job);
  } catch (err) {
    missing.push(`${job.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
if (missing.length) {
  console.error("bake-blitz-parts-tripo missing/failed:\n" + missing.map((m) => `  - ${m}`).join("\n"));
  process.exit(1);
}

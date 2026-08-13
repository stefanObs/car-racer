#!/usr/bin/env node
/**
 * Bake per-car Tripo Teile add-ons → public/models/parts/{carId}-*.glb
 *
 * Sources (gitignored): assets/tripo-out/parts/{carId}/{partId}/
 * Usage:
 *   node scripts/bake-car-parts-tripo.mjs
 *   node scripts/bake-car-parts-tripo.mjs --car=bison
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
const outDir = join(rootDir, "public/models/parts");
const carFilter = process.argv.find((a) => a.startsWith("--car="))?.slice(6);

/** Shared comic material names (match Blitz bake). */
const MAT = {
  big_engine: "Carbon",
  nitro_kit: "NitroKit",
  spike_bumper: "Spike",
  offroad_suspension: "Spring",
  reinforced_frame: "Grey",
  lightweight_body: "Carbon",
  rear_spoiler: "Spoiler",
};

/**
 * Per-car Tripo part jobs (Heckspoiler included for non-Blitz).
 * toward: race-space face after Tripo→+Z remap.
 */
const CAR_JOBS = {
  bison: [
    { id: "big_engine", toward: "+z", targetSpan: 0.95, maxH: 0.42, simplify: 0.4 },
    { id: "spike_bumper", toward: "+z", targetSpan: 1.55, maxH: 0.4, simplify: 0.4 },
    { id: "nitro_kit", toward: "+z", targetSpan: 0.85, maxH: 0.7, simplify: 0.4 },
    { id: "rear_spoiler", toward: "-z", targetSpan: 1.2, maxH: 0.75, simplify: 0.4 },
    { id: "reinforced_frame", toward: "+z", targetSpan: 1.4, maxH: 1.15, simplify: 0.35 },
  ],
  kaeferkraft: [
    { id: "big_engine", toward: "+z", targetSpan: 0.95, maxH: 0.75, simplify: 0.4 },
    { id: "spike_bumper", toward: "+z", targetSpan: 1.35, maxH: 0.4, simplify: 0.4 },
    { id: "nitro_kit", toward: "+z", targetSpan: 0.7, maxH: 0.65, simplify: 0.4 },
    { id: "rear_spoiler", toward: "-z", targetSpan: 1.05, maxH: 0.55, simplify: 0.4 },
    { id: "reinforced_frame", toward: "+z", targetSpan: 1.5, maxH: 1.0, simplify: 0.35 },
    { id: "lightweight_body", toward: "+z", targetSpan: 1.6, maxH: 0.85, simplify: 0.4 },
  ],
  donnerbuechse: [
    { id: "big_engine", toward: "+z", targetSpan: 0.9, maxH: 0.55, simplify: 0.4 },
    { id: "spike_bumper", toward: "+z", targetSpan: 1.55, maxH: 0.4, simplify: 0.4 },
    { id: "nitro_kit", toward: "+z", targetSpan: 0.75, maxH: 0.6, simplify: 0.4 },
    { id: "rear_spoiler", toward: "-z", targetSpan: 1.15, maxH: 0.7, simplify: 0.4 },
    { id: "reinforced_frame", toward: "+z", targetSpan: 1.9, maxH: 1.05, simplify: 0.35 },
    { id: "lightweight_body", toward: "+z", targetSpan: 2.2, maxH: 1.1, simplify: 0.4 },
  ],
  bunker: [
    { id: "big_engine", toward: "+z", targetSpan: 1.1, maxH: 0.55, simplify: 0.4 },
    { id: "spike_bumper", toward: "+z", targetSpan: 1.7, maxH: 0.45, simplify: 0.4 },
    { id: "nitro_kit", toward: "+z", targetSpan: 0.75, maxH: 0.7, simplify: 0.4 },
    { id: "rear_spoiler", toward: "-z", targetSpan: 1.45, maxH: 0.65, simplify: 0.35 },
    { id: "reinforced_frame", toward: "+z", targetSpan: 2.0, maxH: 0.65, simplify: 0.35 },
    { id: "lightweight_body", toward: "+z", targetSpan: 1.95, maxH: 1.4, simplify: 0.4 },
  ],
};

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

function centerSitScale(doc, { targetSpan, maxH }) {
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
  const doc = await io.read(path);
  await doc.transform(flatten(), dedup());
  bakeAllNodeTransforms(doc);
  await doc.transform(dedup(), prune());
  return doc;
}

async function bakeJob(carId, job) {
  const dir = join(rootDir, "assets/tripo-out/parts", carId, job.id);
  const src = findSourceGlb(dir);
  if (!src) throw new Error(`No GLB under ${dir}`);
  const doc = await loadPrepared(src);
  facePosZFromTripoX(doc);
  if (job.toward === "-z") rotateY180(doc);
  const sized = centerSitScale(doc, { targetSpan: job.targetSpan, maxH: job.maxH });
  comicMaterial(doc, MAT[job.id] ?? "Carbon");
  await simplifyDoc(doc, job.simplify);
  mkdirSync(outDir, { recursive: true });
  const bytes = await io.writeBinary(doc);
  const out = join(outDir, `${carId}-${job.id}.glb`);
  writeFileSync(out, bytes);
  console.log(`${carId}-${job.id}.glb`, {
    src,
    bytes: bytes.byteLength,
    size: sized.size.map((v) => +v.toFixed(3)),
  });
}

const cars = carFilter ? [carFilter] : Object.keys(CAR_JOBS);
const missing = [];
for (const carId of cars) {
  const jobs = CAR_JOBS[carId];
  if (!jobs) {
    missing.push(`unknown car ${carId}`);
    continue;
  }
  for (const job of jobs) {
    try {
      await bakeJob(carId, job);
    } catch (err) {
      missing.push(`${carId}/${job.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
if (missing.length) {
  console.error("bake-car-parts-tripo missing/failed:\n" + missing.map((m) => `  - ${m}`).join("\n"));
  process.exit(1);
}

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
import { recolorKaeferkraftSpikeAlbedo } from "./recolor-kaeferkraft-spike-bumper.mjs";

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
    // Tripo concept faces the closed back at camera; −z flip puts the open grill on race +Z.
    { id: "big_engine", toward: "-z", targetSpan: 0.95, maxH: 0.42, simplify: 0.4 },
    { id: "spike_bumper", toward: "+z", targetSpan: 1.55, maxH: 0.4, simplify: 0.4 },
    { id: "nitro_kit", toward: "+z", targetSpan: 0.85, maxH: 0.7, simplify: 0.4 },
    { id: "rear_spoiler", toward: "-z", targetSpan: 1.2, maxH: 0.75, simplify: 0.4 },
    // ¾ concept skews the rack; straighten + pack arch so feet stay aft of the hoop.
    {
      id: "reinforced_frame",
      toward: "+z",
      targetSpan: 1.35,
      maxH: 1.0,
      simplify: 0.35,
      straightenXZ: true,
      packArchForward: true,
    },
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
    // Bay fill is mostly mount scale in carParts; keep bake compact for garage LOD.
    { id: "big_engine", toward: "+z", targetSpan: 0.9, maxH: 0.55, simplify: 0.4, material: "Chrome" },
    { id: "spike_bumper", toward: "+z", targetSpan: 1.55, maxH: 0.4, simplify: 0.4 },
    { id: "nitro_kit", toward: "+z", targetSpan: 0.75, maxH: 0.6, simplify: 0.4 },
    { id: "rear_spoiler", toward: "-z", targetSpan: 1.15, maxH: 0.7, simplify: 0.4 },
    { id: "reinforced_frame", toward: "+z", targetSpan: 1.9, maxH: 1.05, simplify: 0.35 },
    { id: "lightweight_body", toward: "+z", targetSpan: 2.2, maxH: 1.1, simplify: 0.4 },
  ],
  bunker: [
    // Look sheet panel 1: compact hood scoop (~⅓ hood width, low but readable height).
    { id: "big_engine", toward: "+z", targetSpan: 0.62, maxH: 0.3, simplify: 0.4 },
    { id: "spike_bumper", toward: "+z", targetSpan: 1.7, maxH: 0.45, simplify: 0.4 },
    { id: "nitro_kit", toward: "+z", targetSpan: 0.75, maxH: 0.7, simplify: 0.4 },
    { id: "rear_spoiler", toward: "-z", targetSpan: 1.45, maxH: 0.65, simplify: 0.35 },
    // Look sheet panel 5: full external cage (roof rails + pillars + rockers), not short sill bars.
    { id: "reinforced_frame", toward: "+z", targetSpan: 3.4, maxH: 1.95, simplify: 0.35 },
    // Look sheet panel 6: single door plate with triangular cutouts; dual-mounted on ±X flanks.
    { id: "lightweight_body", toward: "+z", targetSpan: 1.05, maxH: 0.9, simplify: 0.4 },
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

function rotateY(doc, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  forEachPosition(doc, (v, n) => {
    const x = v[0];
    const z = v[2];
    v[0] = c * x + s * z;
    v[2] = -s * x + c * z;
    if (n) {
      const nx = n[0];
      const nz = n[2];
      n[0] = c * nx + s * nz;
      n[2] = -s * nx + c * nz;
    }
  });
}

/**
 * Undo ¾-perspective skew on bed racks: yaw so mid-height left/right means share Z.
 * Uses relative height so it works before or after span fit.
 */
function straightenXZ(doc) {
  const b0 = sceneSize(doc);
  const y0 = b0.min[1];
  const y1 = b0.max[1];
  const ySpan = Math.max(y1 - y0, 1e-6);
  const yLo = y0 + ySpan * 0.3;
  const yHi = y0 + ySpan * 0.7;
  const xAbs = Math.max(Math.abs(b0.min[0]), Math.abs(b0.max[0]), 1e-6);
  const xCut = xAbs * 0.25;
  const left = [];
  const right = [];
  forEachPosition(doc, (v) => {
    if (v[1] < yLo || v[1] > yHi) return;
    if (v[0] < -xCut) left.push([v[0], v[2]]);
    else if (v[0] > xCut) right.push([v[0], v[2]]);
  });
  if (left.length < 8 || right.length < 8) return;
  const mean = (pts, i) => pts.reduce((s, p) => s + p[i], 0) / pts.length;
  const lx = mean(left, 0);
  const lz = mean(left, 1);
  const rx = mean(right, 0);
  const rz = mean(right, 1);
  const yaw = Math.atan2(rz - lz, rx - lx);
  if (!Number.isFinite(yaw) || Math.abs(yaw) < 1e-4) return;
  rotateY(doc, yaw);
}

/**
 * Chase-rack pack: clamp anything forward of the arch plane so feet do not
 * poke past the hoop into the cabin when the arch sits on the cab rear.
 */
function packArchForward(doc) {
  const b0 = sceneSize(doc);
  const y0 = b0.min[1];
  const y1 = b0.max[1];
  const ySpan = Math.max(y1 - y0, 1e-6);
  const yArch = y0 + ySpan * 0.7;
  const archZs = [];
  forEachPosition(doc, (v) => {
    if (v[1] >= yArch) archZs.push(v[2]);
  });
  if (archZs.length < 8) return;
  const archZ = archZs.reduce((s, z) => s + z, 0) / archZs.length;
  const pad = ySpan * 0.02;
  const plane = archZ + pad;
  forEachPosition(doc, (v) => {
    if (v[2] > plane) v[2] = plane;
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
  let sized = centerSitScale(doc, { targetSpan: job.targetSpan, maxH: job.maxH });
  if (job.straightenXZ) {
    straightenXZ(doc);
    sized = centerSitScale(doc, { targetSpan: job.targetSpan, maxH: job.maxH });
  }
  if (job.packArchForward) {
    packArchForward(doc);
    sized = centerSitScale(doc, { targetSpan: job.targetSpan, maxH: job.maxH });
  }
  comicMaterial(doc, job.material ?? MAT[job.id] ?? "Carbon");
  if (carId === "kaeferkraft" && job.id === "spike_bumper") {
    await recolorKaeferkraftSpikeAlbedo(doc);
  }
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

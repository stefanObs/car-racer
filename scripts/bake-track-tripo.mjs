#!/usr/bin/env node
/**
 * Bake Tripo track kit into arcade GLBs (sit y=0, face +Z, tile +X).
 *
 * Sources (gitignored under assets/tripo-out/track/<id>/): textured model.glb
 *
 * Usage: node scripts/bake-track-tripo.mjs
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
const outDir = join(rootDir, "public/models/track");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** @typedef {{ id: string, along: "x" | "z", primary: "x" | "y" | "z", meters: number, maxY?: number, maxX?: number, maxZ?: number, simplify: number }} PropBake */

/** @type {PropBake[]} */
const PROPS = [
  { id: "tire-wall", along: "x", primary: "y", meters: 1.15, simplify: 0.42 },
  { id: "concrete-wall", along: "x", primary: "y", meters: 1.5, simplify: 0.38 },
  { id: "fence", along: "x", primary: "y", meters: 1.1, simplify: 0.72 },
  { id: "crane", along: "x", primary: "y", meters: 18, simplify: 0.28 },
  { id: "container", along: "z", primary: "z", meters: 6.2, maxY: 2.7, simplify: 0.4 },
  { id: "tank", along: "x", primary: "y", meters: 8, simplify: 0.42 },
  // Cups 2–5 theme scenery (proposals)
  { id: "grandstand", along: "x", primary: "y", meters: 6.5, maxX: 14, maxZ: 8, simplify: 0.35 },
  { id: "palm", along: "x", primary: "y", meters: 7.5, maxX: 5, maxZ: 5, simplify: 0.55 },
  { id: "hut", along: "z", primary: "z", meters: 5.5, maxY: 4, simplify: 0.45 },
  { id: "tower", along: "x", primary: "y", meters: 12, maxX: 8, maxZ: 8, simplify: 0.38 },
  { id: "building", along: "z", primary: "y", meters: 10, maxX: 10, maxZ: 10, simplify: 0.4 },
  { id: "cliff", along: "x", primary: "y", meters: 14, maxX: 12, maxZ: 10, simplify: 0.32 },
  { id: "spire", along: "x", primary: "y", meters: 12, maxX: 5, maxZ: 5, simplify: 0.4 },
  { id: "tree", along: "x", primary: "y", meters: 9, maxX: 5, maxZ: 5, simplify: 0.5 },
  { id: "warehouse", along: "z", primary: "z", meters: 14, maxY: 8, simplify: 0.38 },
  { id: "scrub", along: "x", primary: "y", meters: 1.8, maxX: 3.5, maxZ: 3.5, simplify: 0.6 },
  // On-track obstacles (compact — not tiled outer walls)
  { id: "rumble", along: "x", primary: "x", meters: 8.5, maxY: 0.45, maxZ: 5.5, simplify: 0.55 },
  { id: "oil", along: "x", primary: "x", meters: 4.2, maxY: 0.28, maxZ: 3.2, simplify: 0.65 },
  { id: "tire-stack", along: "x", primary: "y", meters: 1.35, maxX: 1.6, maxZ: 1.6, simplify: 0.5 },
  { id: "barrier", along: "x", primary: "y", meters: 1.15, maxX: 2.6, maxZ: 1.1, simplify: 0.48 },
  { id: "ramp", along: "z", primary: "z", meters: 5.2, maxY: 1.05, maxX: 4.5, maxZ: 5.2, simplify: 0.45 },
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

/** Map Tripo camera/face (+X) onto track inward (+Z): (x,z) → (−z, x). */
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

function rotateY90(doc) {
  forEachPosition(doc, (v, n) => {
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
  });
}

function longestHorizontalTo(doc, along) {
  const s = sceneSize(doc);
  const xLonger = s.size[0] >= s.size[2];
  if (along === "x" && !xLonger) rotateY90(doc);
  if (along === "z" && xLonger) rotateY90(doc);
}

function centerSitScale(doc, spec) {
  const s0 = sceneSize(doc);
  const dim =
    spec.primary === "x" ? s0.size[0] : spec.primary === "y" ? s0.size[1] : s0.size[2];
  let scale = spec.meters / Math.max(dim, 1e-6);
  // Apply all span caps against the *current* scale so a later max* cannot undo maxY.
  for (let i = 0; i < 4; i++) {
    const y = s0.size[1] * scale;
    const x = s0.size[0] * scale;
    const z = s0.size[2] * scale;
    let next = scale;
    if (spec.maxY && y > spec.maxY) next = Math.min(next, scale * (spec.maxY / y));
    if (spec.maxX && x > spec.maxX) next = Math.min(next, scale * (spec.maxX / x));
    if (spec.maxZ && z > spec.maxZ) next = Math.min(next, scale * (spec.maxZ / z));
    if (Math.abs(next - scale) < 1e-9) break;
    scale = next;
  }
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
    mat.setRoughnessFactor(0.88);
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
    steps.splice(1, 0, simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0015 }));
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
      if (p.includes("texture") && !fallback) fallback = p;
      else if (!fallback) fallback = p;
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

async function bakeProp(spec) {
  const tripoDir = join(rootDir, "assets/tripo-out/track", spec.id);
  const src = findSourceGlb(tripoDir);
  if (!src) {
    console.warn(`skip ${spec.id}: no GLB under ${tripoDir}`);
    return false;
  }
  const doc = await loadPrepared(src);
  facePosZFromTripoX(doc);
  longestHorizontalTo(doc, spec.along);
  const sized = centerSitScale(doc, spec);
  comicMaterial(doc, spec.id === "container" || spec.id === "tank" ? "BodyPaint" : spec.id);
  await simplifyDoc(doc, spec.simplify);
  mkdirSync(outDir, { recursive: true });
  const bytes = await io.writeBinary(doc);
  const dest = join(outDir, `${spec.id}.glb`);
  writeFileSync(dest, bytes);
  console.log(`${spec.id}.glb ← Tripo`, {
    src,
    bytes: bytes.byteLength,
    size: sized.size.map((v) => +v.toFixed(3)),
    tileAlong: +sized.size[0].toFixed(3),
  });
  return true;
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const jobs = only.length ? PROPS.filter((p) => only.includes(p.id)) : PROPS;
if (!jobs.length) {
  console.error("No matching props. Known:", PROPS.map((p) => p.id).join(", "));
  process.exit(1);
}
for (const spec of jobs) await bakeProp(spec);

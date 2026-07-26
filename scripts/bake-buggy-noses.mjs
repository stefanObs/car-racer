#!/usr/bin/env node
/**
 * Bake Käferkraft nose props → comic GLBs under public/models/props/.
 *   SKETCHFAB_API_TOKEN=… npm run cars:fetch-buggy-noses
 *   npm run cars:bake-buggy-noses
 *
 * Animation armatures leave non-identity node TRS — those must be baked into
 * vertex positions or the “normalized” bird explodes at runtime (~7m tall).
 */
import { existsSync, writeFileSync } from "node:fs";
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
const outDir = join(rootDir, "public/models/props");

const JOBS = [
  { source: "buggy-bird.source.glb", out: "buggy-bird.glb", targetH: 0.55, maxSpan: 0.85, simplifyRatio: 1 },
  { source: "buggy-dog.source.glb", out: "buggy-dog.glb", targetH: 0.48, maxSpan: 0.55, simplifyRatio: 0.4 },
];

function matKind(name, factor) {
  const n = (name || "").toLowerCase();
  const [r, g, b] = factor;
  const lum = r + g + b;
  if (n.includes("eye") || (r > 0.6 && g < 0.3 && b < 0.3)) return "Eye";
  if (lum < 0.35) return "Dark";
  if (lum > 2.2) return "Light";
  return "Body";
}

/** Bake every node matrix into meshes (parents before children). */
function bakeAllNodeTransforms(doc) {
  const scenes = doc.getRoot().listScenes();
  for (const scene of scenes) {
    for (const root of scene.listChildren()) {
      bakeNodeTree(root);
    }
  }
}

function bakeNodeTree(node) {
  clearNodeTransform(node);
  for (const child of node.listChildren()) bakeNodeTree(child);
}

async function bakeOne(sourceName, outName, targetH, maxSpan) {
  const sourcePath = join(outDir, sourceName);
  const livePath = join(outDir, outName);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing ${sourcePath}. Run: npm run cars:fetch-buggy-noses`);
  }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(sourcePath);

  await doc.transform(flatten(), dedup());
  bakeAllNodeTransforms(doc);
  await doc.transform(dedup());

  for (const mat of doc.getRoot().listMaterials()) {
    const factor = mat.getBaseColorFactor();
    const kind = matKind(mat.getName(), factor);
    mat.setName(kind);
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.85);
    if (kind === "Eye") mat.setBaseColorFactor([0.95, 0.15, 0.12, 1]);
    else if (kind === "Dark") mat.setBaseColorFactor([0.15, 0.15, 0.16, 1]);
    else if (kind === "Light") mat.setBaseColorFactor([0.92, 0.93, 0.94, 1]);
    else mat.setBaseColorFactor([0.88, 0.86, 0.82, 1]);
    mat.setBaseColorTexture(null);
  }

  const scene = doc.getRoot().listScenes()[0];
  const bounds = getBounds(scene);
  const size = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  let scale = targetH / Math.max(size[1], 0.001);
  const span = Math.max(size[0], size[2]) * scale;
  if (span > maxSpan) scale *= maxSpan / span;

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        v[0] = (v[0] - cx) * scale;
        v[1] = (v[1] - bounds.min[1]) * scale;
        v[2] = (v[2] - cz) * scale;
        pos.setElement(i, v);
      }
      pos.setArray(pos.getArray());
    }
  }

  await doc.transform(weld({ tolerance: 0.0002 }), dedup());
  // Keep all primitives — prune was dropping wing shards on the animated bird.
  const bytes = await io.writeBinary(doc);
  writeFileSync(livePath, bytes);
  const h = size[1] * scale;
  const outSpan = Math.max(size[0], size[2]) * scale;
  console.log(`${outName} ← ${sourceName} (${bytes.byteLength} bytes, h≈${h.toFixed(2)}m span≈${outSpan.toFixed(2)}m)`);
}

for (const job of JOBS) {
  await bakeOne(job.source, job.out, job.targetH, job.maxSpan);
}

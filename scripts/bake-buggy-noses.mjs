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
  { source: "buggy-bird.source.glb", out: "buggy-bird.glb", targetH: 0.4, maxSpan: 0.65, simplifyRatio: 0.45 },
  // Head-only crop (see cropDogToHead); larger bumper ornament.
  {
    source: "buggy-dog.source.glb",
    out: "buggy-dog.glb",
    targetH: 0.48,
    maxSpan: 0.55,
    simplifyRatio: 0.55,
    cropDogHead: true,
  },
];

function matKind(name, factor) {
  const n = (name || "").toLowerCase();
  const [r, g, b] = factor;
  const lum = r + g + b;
  if (n.includes("eye") || (r > 0.6 && g < 0.3 && b < 0.3)) return "Eye";
  if (n.includes("beak") || n.includes("orange") || (r > 0.55 && g > 0.25 && g < 0.55 && b < 0.35)) return "Beak";
  if (lum < 0.45) return "Dark";
  if (lum > 2.35) return "Light";
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

/** Drop skins/clips so three.js does not zero-out a broken armature at runtime. */
function stripRigAndClips(doc) {
  const root = doc.getRoot();
  for (const node of root.listNodes()) {
    if (node.getSkin()) node.setSkin(null);
  }
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of ["JOINTS_0", "JOINTS_1", "WEIGHTS_0", "WEIGHTS_1"]) {
        const attr = prim.getAttribute(sem);
        if (attr) prim.setAttribute(sem, null);
      }
    }
  }
  for (const anim of [...root.listAnimations()]) anim.dispose();
  for (const skin of [...root.listSkins()]) skin.dispose();
}

/**
 * Keep only the sitting dog's head (upper ~48% of height). Body/paws discarded
 * so the bumper ornament is a big head on the headlight bar.
 */
function cropDogToHead(doc) {
  const scene = doc.getRoot().listScenes()[0];
  const bounds = getBounds(scene);
  const minY = bounds.min[1];
  const sizeY = Math.max(bounds.max[1] - minY, 0.001);
  const neckY = minY + sizeY * 0.72;
  // Head cluster is high-Y and toward +Z (see source high-Y mean).
  const zCut = bounds.min[2] + (bounds.max[2] - bounds.min[2]) * 0.35;


  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const indices = prim.getIndices();
      const triCount = indices ? indices.getCount() / 3 : Math.floor(pos.getCount() / 3);
      const keepOld = [];
      for (let t = 0; t < triCount; t++) {
        let a;
        let b;
        let c;
        if (indices) {
          a = indices.getScalar(t * 3);
          b = indices.getScalar(t * 3 + 1);
          c = indices.getScalar(t * 3 + 2);
        } else {
          a = t * 3;
          b = t * 3 + 1;
          c = t * 3 + 2;
        }
        const ya = pos.getElement(a, [])[1];
        const yb = pos.getElement(b, [])[1];
        const yc = pos.getElement(c, [])[1];
        const za = pos.getElement(a, [])[2];
        const zb = pos.getElement(b, [])[2];
        const zc = pos.getElement(c, [])[2];
        const avgY = (ya + yb + yc) / 3;
        const avgZ = (za + zb + zc) / 3;
        if (avgY >= neckY && avgZ >= zCut) keepOld.push(a, b, c);
      }
      if (keepOld.length < 9) {
        throw new Error("Dog head crop removed all triangles — adjust neck cut.");
      }

      const sems = ["POSITION", "NORMAL", "TEXCOORD_0", "TEXCOORD_1", "COLOR_0"].filter((s) =>
        prim.getAttribute(s),
      );
      const remap = new Map();
      const packed = Object.fromEntries(sems.map((s) => [s, []]));
      const mapVert = (oldIdx) => {
        if (remap.has(oldIdx)) return remap.get(oldIdx);
        const ni = remap.size;
        remap.set(oldIdx, ni);
        for (const s of sems) {
          const attr = prim.getAttribute(s);
          packed[s].push(...attr.getElement(oldIdx, []));
        }
        return ni;
      };
      const newIdx = keepOld.map(mapVert);

      for (const s of sems) {
        const attr = prim.getAttribute(s);
        const Typed = attr.getArray().constructor;
        attr.setArray(new Typed(packed[s]));
      }
      if (indices) {
        const Typed = indices.getArray().constructor;
        indices.setArray(new Typed(newIdx));
      } else {
        const acc = doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(newIdx));
        prim.setIndices(acc);
      }
    }
  }
}

async function bakeOne(sourceName, outName, targetH, maxSpan, simplifyRatio = 1, cropDogHead = false) {
  const sourcePath = join(outDir, sourceName);
  const livePath = join(outDir, outName);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing ${sourcePath}. Run: npm run cars:fetch-buggy-noses`);
  }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(sourcePath);

  await doc.transform(flatten(), dedup());
  bakeAllNodeTransforms(doc);
  stripRigAndClips(doc);
  await doc.transform(dedup(), prune());
  if (cropDogHead) cropDogToHead(doc);

  for (const mat of doc.getRoot().listMaterials()) {
    const factor = mat.getBaseColorFactor();
    const sg = mat.getExtension("KHR_materials_pbrSpecularGlossiness");
    const diffuseTex =
      mat.getBaseColorTexture() ||
      (sg && typeof sg.getDiffuseTexture === "function" ? sg.getDiffuseTexture() : null);
    const textured = !!diffuseTex;
    let kind = matKind(mat.getName(), factor);
    if (textured && factor[0] + factor[1] + factor[2] > 2.5) kind = "Body";
    if (outName.includes("bird") && kind === "Light") kind = "Body";
    mat.setName(kind);
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.85);
    if (kind === "Eye") mat.setBaseColorFactor([0.95, 0.15, 0.12, 1]);
    else if (kind === "Beak") mat.setBaseColorFactor([0.92, 0.48, 0.12, 1]);
    else if (kind === "Dark") mat.setBaseColorFactor([0.22, 0.22, 0.24, 1]);
    else if (kind === "Light") mat.setBaseColorFactor([0.92, 0.93, 0.94, 1]);
    else mat.setBaseColorFactor([1, 1, 1, 1]); // multiply authored diffuse under toon
    // Keep bird/dog albedos when present (comic still via toon shading).
    if (diffuseTex && (outName.includes("bird") || outName.includes("dog"))) {
      mat.setBaseColorTexture(diffuseTex);
    } else {
      mat.setBaseColorTexture(null);
    }
    for (const ext of [...mat.listExtensions()]) ext.dispose();
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

  await MeshoptSimplifier.ready;
  const transforms = [weld({ tolerance: 0.0002 }), dedup()];
  if (simplifyRatio < 0.999) {
    transforms.splice(1, 0, simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: 0.001 }));
    transforms.push(prune());
  }
  await doc.transform(...transforms);
  await doc.transform(prune());
  const bytes = await io.writeBinary(doc);
  writeFileSync(livePath, bytes);
  const h = size[1] * scale;
  const outSpan = Math.max(size[0], size[2]) * scale;
  console.log(`${outName} ← ${sourceName} (${bytes.byteLength} bytes, h≈${h.toFixed(2)}m span≈${outSpan.toFixed(2)}m)`);
}

for (const job of JOBS) {
  await bakeOne(job.source, job.out, job.targetH, job.maxSpan, job.simplifyRatio, !!job.cropDogHead);
}

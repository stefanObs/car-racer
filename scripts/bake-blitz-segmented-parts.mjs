#!/usr/bin/env node
/**
 * Bake Tripo-segmented Blitz wheels + spoiler onto the pre-split BodyPaint atlas.
 *
 * Body: `blitz-pre-wheel-split.glb` (single atlas, welded tires + GT wing).
 * Segment: v2 simple + connectivity — remount `StockWheel_*` and `StockSpoiler`.
 *
 *   node scripts/bake-blitz-segmented-parts.mjs
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  clearNodeTransform,
  dedup,
  flatten,
  getBounds,
  prune,
} from "@gltf-transform/functions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const segDir = join(rootDir, "assets/tripo-out/blitz/segment-wheels-spoiler-v1");
const bodyPath = join(rootDir, "assets/tripo-out/blitz/blitz-pre-wheel-split.glb");
const carsDir = join(rootDir, "public/models/cars");
const partsDir = join(rootDir, "public/models/parts");

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

function meshWorldBounds(mesh) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  let verts = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    verts += pos.getCount();
    for (let i = 0; i < pos.getCount(); i++) {
      const v = pos.getElement(i, []);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const sorted = [...size].sort((a, b) => a - b);
  return {
    min,
    max,
    size,
    cx: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    verts,
    thin: sorted[0],
    long: sorted[2],
  };
}

/** Low disk tires after body align. Axle along X (thin), disk in YZ. */
function isTireMesh(bounds) {
  if (bounds.verts < 350 || bounds.verts > 700) return false;
  if (bounds.min[1] > 0.04) return false;
  const disk = Math.max(bounds.size[1], bounds.size[2]);
  if (disk < 0.45 || disk > 0.75) return false;
  if (bounds.thin > 0.32) return false;
  if (Math.abs(bounds.cx[0]) < 0.45) return false;
  return true;
}

/** GT wing blade, endplates, and struts — high, aft of the cabin. */
function isSpoilerMesh(bounds) {
  if (bounds.verts < 20 || bounds.verts > 250) return false;
  if (bounds.max[1] < 0.72) return false;
  if (bounds.max[2] > -1.2) return false;
  if (bounds.min[1] < 0.45) return false;
  return true;
}

function isStrutPart(bounds) {
  return bounds.size[0] < 0.08 && bounds.min[1] < 0.78;
}

function cornerOf(x, z) {
  const front = z >= 0;
  const left = x < 0;
  if (front) return left ? "FL" : "FR";
  return left ? "RL" : "RR";
}

function findSegmentGlb(dir) {
  const stack = [dir];
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
      if (name === "model.glb" || name === "seg_model.glb") return p;
    }
  }
  return null;
}

function alignSegmentToBody(segDoc, bodyDoc) {
  const seg = sceneSize(segDoc);
  const body = sceneSize(bodyDoc);
  const scale = body.size[2] / Math.max(seg.size[2], 1e-6);
  forEachPosition(segDoc, (v) => {
    v[0] = (v[0] - seg.cx) * scale + body.cx;
    v[1] = (v[1] - seg.min[1]) * scale;
    v[2] = (v[2] - seg.cz) * scale + body.cz;
  });
  return { scale };
}

function remappedPrimitive(doc, buffer, faces, srcPos, srcNrm, srcUv, material) {
  const used = new Map();
  const newPos = [];
  const newNrm = [];
  const newUv = [];
  const newIdx = [];
  for (const [i0, i1, i2] of faces) {
    for (const old of [i0, i1, i2]) {
      if (!used.has(old)) {
        used.set(old, newPos.length / 3);
        const v = srcPos.getElement(old, []);
        newPos.push(v[0], v[1], v[2]);
        if (srcNrm) {
          const n = srcNrm.getElement(old, []);
          newNrm.push(n[0], n[1], n[2]);
        }
        if (srcUv) {
          const u = srcUv.getElement(old, []);
          newUv.push(u[0], u[1]);
        }
      }
      newIdx.push(used.get(old));
    }
  }
  const p = doc
    .createPrimitive()
    .setAttribute(
      "POSITION",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(newPos)).setBuffer(buffer),
    )
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(newIdx)).setBuffer(buffer))
    .setMaterial(material);
  if (newNrm.length) {
    p.setAttribute(
      "NORMAL",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(newNrm)).setBuffer(buffer),
    );
  }
  if (newUv.length === (newPos.length / 3) * 2) {
    p.setAttribute(
      "TEXCOORD_0",
      doc.createAccessor().setType("VEC2").setArray(new Float32Array(newUv)).setBuffer(buffer),
    );
  }
  return p;
}

function remappedPrimitiveLocal(doc, buffer, faces, pos, nrm, uv, material, center) {
  const vertMap = new Map();
  const newPos = [];
  const newNrm = [];
  const newUv = [];
  const newIdx = [];
  const emit = (vi) => {
    if (vertMap.has(vi)) return vertMap.get(vi);
    const v = pos.getElement(vi, []);
    const oi = newPos.length / 3;
    newPos.push(v[0] - center[0], v[1] - center[1], v[2] - center[2]);
    if (nrm) {
      const n = nrm.getElement(vi, []);
      newNrm.push(n[0], n[1], n[2]);
    }
    if (uv) {
      const u = uv.getElement(vi, []);
      newUv.push(u[0], u[1]);
    }
    vertMap.set(vi, oi);
    return oi;
  };
  for (const [a, b, c] of faces) newIdx.push(emit(a), emit(b), emit(c));
  const p = doc
    .createPrimitive()
    .setAttribute(
      "POSITION",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(newPos)).setBuffer(buffer),
    )
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(newIdx)).setBuffer(buffer))
    .setMaterial(material);
  if (newNrm.length) {
    p.setAttribute(
      "NORMAL",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(newNrm)).setBuffer(buffer),
    );
  }
  if (newUv.length === (newPos.length / 3) * 2) {
    p.setAttribute(
      "TEXCOORD_0",
      doc.createAccessor().setType("VEC2").setArray(new Float32Array(newUv)).setBuffer(buffer),
    );
  }
  return p;
}

/** Solid tire volume: disk in YZ, thickness along axle X. */
function inTireCylinder(px, py, pz, tire) {
  const dx = px - tire.center[0];
  const dy = py - tire.center[1];
  const dz = pz - tire.center[2];
  const r = Math.max(tire.size[1], tire.size[2]) * 0.5 * 1.06;
  const halfW = Math.max(tire.size[0] * 0.5 * 1.25, 0.16);
  if (dy * dy + dz * dz <= r * r && Math.abs(dx) <= halfW) return true;
  const hubR = r * 0.52;
  const hubW = Math.max(halfW, 0.22);
  return dy * dy + dz * dz <= hubR * hubR && Math.abs(dx) <= hubW;
}

/**
 * Punch only the GT wing blade and outer endplates. The welded wing's
 * underside (y ~0.84–0.88) is the closed rear lid — a spoiler AABB or a
 * "center lip" y≥0.84 punch deletes that lid and opens a hole when
 * StockSpoiler is hidden. Same lesson as extract-blitz-stock-and-spoiler.
 */
function isWingVertex(x, y, z) {
  if (z > -1.25) return false;
  if (y >= 0.88) return true;
  if (y >= 0.8 && Math.abs(x) > 0.7 && z < -1.42) return true;
  return false;
}

function faceIsWing(a, b, c) {
  let n = 0;
  for (const v of [a, b, c]) if (isWingVertex(v[0], v[1], v[2])) n++;
  return n >= 2;
}

function faceNy(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return uz * vx - ux * vz;
}

/** Wing underside kept as the rear lid still faces −Y; flip so the garage camera sees it. */
function orientRearDeckUp(prim) {
  const pos = prim.getAttribute("POSITION");
  const nrm = prim.getAttribute("NORMAL");
  const idx = prim.getIndices();
  if (!pos || !idx) return 0;
  let flipped = 0;
  const flippedVerts = new Set();
  for (let t = 0; t < idx.getCount() / 3; t++) {
    const i0 = idx.getScalar(t * 3);
    const i1 = idx.getScalar(t * 3 + 1);
    const i2 = idx.getScalar(t * 3 + 2);
    const a = pos.getElement(i0, []);
    const b = pos.getElement(i1, []);
    const c = pos.getElement(i2, []);
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    if (!(cz < -1.32 && cy >= 0.78 && cy <= 0.9 && Math.abs(cx) < 0.72)) continue;
    if (faceNy(a, b, c) >= 0) continue;
    idx.setScalar(t * 3 + 1, i2);
    idx.setScalar(t * 3 + 2, i1);
    flipped++;
    flippedVerts.add(i0);
    flippedVerts.add(i1);
    flippedVerts.add(i2);
  }
  if (nrm) {
    for (const i of flippedVerts) {
      const n = nrm.getElement(i, []);
      if (n[1] >= 0) continue;
      n[0] *= -1;
      n[1] *= -1;
      n[2] *= -1;
      nrm.setElement(i, n);
    }
    nrm.setArray(nrm.getArray());
  }
  idx.setArray(idx.getArray());
  return flipped;
}

/** Wing underside UVs sample black; retarget to the red roof island. */
function recolorRearLidUVs(prim) {
  const pos = prim.getAttribute("POSITION");
  const uv = prim.getAttribute("TEXCOORD_0");
  const idx = prim.getIndices();
  if (!pos || !uv || !idx) return 0;
  let n = 0;
  const touched = new Set();
  for (let t = 0; t < idx.getCount() / 3; t++) {
    const ids = [idx.getScalar(t * 3), idx.getScalar(t * 3 + 1), idx.getScalar(t * 3 + 2)];
    const a = pos.getElement(ids[0], []);
    const b = pos.getElement(ids[1], []);
    const c = pos.getElement(ids[2], []);
    const cy = (a[1] + b[1] + c[1]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    const cx = (a[0] + b[0] + c[0]) / 3;
    if (!(cz < -1.35 && cy >= 0.8 && cy <= 0.9 && Math.abs(cx) < 0.65)) continue;
    for (const i of ids) {
      if (touched.has(i)) continue;
      touched.add(i);
      const v = pos.getElement(i, []);
      const u = 0.53 + ((v[0] + 0.55) / 1.1) * 0.06;
      const vv = 0.33 + ((v[2] + 1.75) / 0.4) * 0.05;
      uv.setElement(i, [u, vv]);
      n++;
    }
  }
  uv.setArray(uv.getArray());
  return n;
}

/** Closed red rear lid — the welded wing was the only cover over this opening. */
function addRearDeckCap(doc, mesh, material) {
  const buffer = doc.getRoot().listBuffers()[0];
  const x0 = -0.56;
  const x1 = 0.56;
  const yFwd = 0.8;
  const yAft = 0.7;
  const zFwd = -1.4;
  const zAft = -1.78;
  const pos = new Float32Array([x0, yFwd, zFwd, x1, yFwd, zFwd, x1, yAft, zAft, x0, yAft, zAft]);
  const nrm = new Float32Array([0, 0.97, 0.24, 0, 0.97, 0.24, 0, 0.97, 0.24, 0, 0.97, 0.24]);
  const uv = new Float32Array([0.545, 0.3, 0.545, 0.3, 0.545, 0.3, 0.545, 0.3]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const cap = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nrm).setBuffer(buffer))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer))
    .setMaterial(material);
  mesh.addPrimitive(cap);
}

function punchVolumes(bodyDoc, tires) {
  const found = [];
  for (const mesh of bodyDoc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const matName = prim.getMaterial()?.getName();
      if (matName && matName !== "BodyPaint") continue;
      found.push({ mesh, prim });
    }
  }
  if (!found.length) throw new Error("BodyPaint prim missing on pre-split body");
  const { mesh, prim } = found[0];
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices();
  const nrm = prim.getAttribute("NORMAL");
  const uv = prim.getAttribute("TEXCOORD_0");
  if (!pos || !idx) throw new Error("body needs indexed POSITION");
  if (!uv) throw new Error("BodyPaint missing TEXCOORD_0");

  const keep = [];
  let droppedTire = 0;
  let droppedSpoiler = 0;
  const triCount = idx.getCount() / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx.getScalar(t * 3);
    const i1 = idx.getScalar(t * 3 + 1);
    const i2 = idx.getScalar(t * 3 + 2);
    const a = pos.getElement(i0, []);
    const b = pos.getElement(i1, []);
    const c = pos.getElement(i2, []);
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    if (tires.some((tire) => inTireCylinder(cx, cy, cz, tire))) {
      droppedTire++;
      continue;
    }
    if (faceIsWing(a, b, c)) {
      droppedSpoiler++;
      continue;
    }
    keep.push([i0, i1, i2]);
  }
  if (keep.length < 1500) throw new Error(`body faces too low after punch: ${keep.length}`);
  const buffer = bodyDoc.getRoot().listBuffers()[0];
  const mat = prim.getMaterial();
  mat.setName("BodyPaint");
  mat.setMetallicFactor(0);
  mat.setRoughnessFactor(0.85);
  const next = remappedPrimitive(bodyDoc, buffer, keep, pos, nrm, uv, mat);
  const flippedDeck = orientRearDeckUp(next);
  const lidUv = recolorRearLidUVs(next);
  mesh.listPrimitives().forEach((p) => mesh.removePrimitive(p));
  mesh.addPrimitive(next);
  addRearDeckCap(bodyDoc, mesh, mat);
  mesh.setName("BodyPaint");
  return { keep: keep.length, droppedTire, droppedSpoiler, flippedDeck, lidUv, bodyMat: mat };
}

function copyPartMaterial(destDoc, srcPrim, name, matName) {
  const srcMat = srcPrim.getMaterial();
  const srcTex = srcMat?.getBaseColorTexture();
  const img = srcTex?.getImage();
  if (!img) throw new Error(`segment part missing albedo (${name})`);
  const mat = destDoc.createMaterial(matName);
  mat.setBaseColorTexture(
    destDoc
      .createTexture(`${matName}Atlas_${name}`)
      .setMimeType(srcTex.getMimeType() || "image/jpeg")
      .setImage(img),
  );
  mat.setBaseColorFactor([1, 1, 1, 1]);
  mat.setMetallicFactor(0);
  mat.setRoughnessFactor(0.9);
  mat.setDoubleSided(true);
  return mat;
}

function cloneMeshInto(destDoc, srcMesh, destMesh, material, center) {
  const buffer = destDoc.getRoot().listBuffers()[0];
  let faces = 0;
  let verts = 0;
  for (const prim of srcMesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const nrm = prim.getAttribute("NORMAL");
    const uv = prim.getAttribute("TEXCOORD_0");
    if (!uv) throw new Error("segment part missing TEXCOORD_0");
    const idx = prim.getIndices();
    const tri = [];
    if (idx) {
      for (let t = 0; t < idx.getCount() / 3; t++) {
        tri.push([idx.getScalar(t * 3), idx.getScalar(t * 3 + 1), idx.getScalar(t * 3 + 2)]);
      }
    } else {
      for (let t = 0; t < pos.getCount() / 3; t++) tri.push([t * 3, t * 3 + 1, t * 3 + 2]);
    }
    destMesh.addPrimitive(remappedPrimitiveLocal(destDoc, buffer, tri, pos, nrm, uv, material, center));
    faces += tri.length;
    verts += pos.getCount();
  }
  return { faces, verts };
}

function combinedBounds(entries) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { bounds } of entries) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], bounds.min[k]);
      max[k] = Math.max(max[k], bounds.max[k]);
    }
  }
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    cx: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const src = srcArg || findSegmentGlb(segDir);
if (!src) throw new Error(`No segmented GLB under ${segDir}`);
if (!existsSync(bodyPath)) throw new Error(`Missing body bake ${bodyPath}`);

const seg = await io.read(src);
await seg.transform(flatten(), dedup());
bakeAllNodeTransforms(seg);
await seg.transform(dedup(), prune());

const body = await io.read(bodyPath);
await body.transform(flatten(), dedup());
bakeAllNodeTransforms(body);

const aligned = alignSegmentToBody(seg, body);

const tireEntries = [];
const spoilerEntries = [];
for (const mesh of seg.getRoot().listMeshes()) {
  const b = meshWorldBounds(mesh);
  if (isTireMesh(b)) tireEntries.push({ mesh, bounds: b });
  else if (isSpoilerMesh(b)) spoilerEntries.push({ mesh, bounds: b });
}
if (tireEntries.length !== 4) {
  throw new Error(`expected 4 tire parts, got ${tireEntries.length}`);
}
if (!spoilerEntries.length) {
  throw new Error("expected spoiler parts (wing / endplates / struts)");
}

const tires = [];
for (const { mesh, bounds: b } of tireEntries) {
  const corner = cornerOf(b.cx[0], b.cx[2]);
  tires.push({
    mesh,
    center: b.cx,
    size: b.size,
    corner,
  });
}
if (new Set(tires.map((t) => t.corner)).size !== 4) {
  throw new Error(`tire corner collision: ${tires.map((t) => t.corner).join(",")}`);
}

const wingEntries = spoilerEntries.filter(({ bounds }) => !isStrutPart(bounds));
const strutEntries = spoilerEntries.filter(({ bounds }) => isStrutPart(bounds));
if (!wingEntries.length) throw new Error("expected GT wing / endplates");
if (strutEntries.length !== 2) {
  throw new Error(`expected 2 spoiler struts, got ${strutEntries.length}`);
}

const spoiler = combinedBounds(wingEntries);

const punch = punchVolumes(body, tires);
await body.transform(dedup(), prune());

const scene = body.getRoot().listScenes()[0];
for (const child of [...scene.listChildren()]) {
  const name = child.getName() ?? "";
  if (name.startsWith("StockWheel_") || name === "StockSpoiler" || name.startsWith("StockStrut_")) scene.removeChild(child);
  if (child.getMesh()?.getName() === "BodyPaint") child.setName("BodyPaint");
}

const wheelSummary = {};
const wheelMeshes = [];
for (const tire of tires) {
  const srcPrim = tire.mesh.listPrimitives()[0];
  const tireMat = copyPartMaterial(body, srcPrim, tire.corner, "Tire");
  const wheelMesh = body.createMesh(`StockWheel_${tire.corner}`);
  const cloned = cloneMeshInto(body, tire.mesh, wheelMesh, tireMat, tire.center);
  const node = body.createNode(`StockWheel_${tire.corner}`);
  node.setMesh(wheelMesh);
  node.setTranslation(tire.center);
  scene.addChild(node);
  wheelMeshes.push(wheelMesh);
  wheelSummary[tire.corner] = {
    center: tire.center.map((v) => +v.toFixed(3)),
    faces: cloned.faces,
    verts: cloned.verts,
  };
}

const spoilerMat = copyPartMaterial(body, wingEntries[0].mesh.listPrimitives()[0], "wing", "Spoiler");
const spoilerMesh = body.createMesh("StockSpoiler");
let spoilerFaces = 0;
let spoilerVerts = 0;
for (const { mesh } of wingEntries) {
  const cloned = cloneMeshInto(body, mesh, spoilerMesh, spoilerMat, spoiler.cx);
  spoilerFaces += cloned.faces;
  spoilerVerts += cloned.verts;
}
const spoilerNode = body.createNode("StockSpoiler");
spoilerMesh.listPrimitives().forEach((p) => p.getMaterial()?.setName("Spoiler"));
spoilerNode.setMesh(spoilerMesh);
spoilerNode.setTranslation(spoiler.cx);
scene.addChild(spoilerNode);

const strutSummary = {};
for (const { mesh, bounds } of strutEntries) {
  const side = bounds.cx[0] < 0 ? "L" : "R";
  const strutMat = copyPartMaterial(body, mesh.listPrimitives()[0], `strut${side}`, "Spoiler");
  const strutMesh = body.createMesh(`StockStrut_${side}`);
  const cloned = cloneMeshInto(body, mesh, strutMesh, strutMat, bounds.cx);
  const node = body.createNode(`StockStrut_${side}`);
  strutMesh.listPrimitives().forEach((p) => p.getMaterial()?.setName("Spoiler"));
  node.setMesh(strutMesh);
  node.setTranslation(bounds.cx);
  scene.addChild(node);
  strutSummary[side] = { center: bounds.cx.map((v) => +v.toFixed(3)), faces: cloned.faces, verts: cloned.verts };
}

await body.transform(dedup({ textures: false }), prune());
for (const wm of wheelMeshes) {
  for (const prim of wm.listPrimitives()) {
    const m = prim.getMaterial();
    if (m) m.setName("Tire");
  }
}

mkdirSync(carsDir, { recursive: true });
const bytes = await io.writeBinary(body);
writeFileSync(join(carsDir, "blitz.glb"), bytes);

const partCenter = combinedBounds(spoilerEntries).cx;
const partDoc = new Document();
partDoc.createBuffer();
const partScene = partDoc.createScene("Spoiler");
const partMesh = partDoc.createMesh("Spoiler");
const partMat = copyPartMaterial(partDoc, spoilerEntries[0].mesh.listPrimitives()[0], "wing", "Spoiler");
for (const { mesh } of spoilerEntries) {
  cloneMeshInto(partDoc, mesh, partMesh, partMat, partCenter);
}
for (const prim of partMesh.listPrimitives()) prim.getMaterial()?.setName("Spoiler");
const partNode = partDoc.createNode("Spoiler");
partNode.setMesh(partMesh);
partScene.addChild(partNode);
forEachPosition(partDoc, (v) => {
  v[1] -= combinedBounds(spoilerEntries).min[1] - partCenter[1];
});
await partDoc.transform(dedup(), prune());
mkdirSync(partsDir, { recursive: true });
const partBytes = await io.writeBinary(partDoc);
writeFileSync(join(partsDir, "blitz-rear_spoiler.glb"), partBytes);

console.log("blitz.glb ← pre-split body + segmented wheels + StockSpoiler", {
  src,
  aligned,
  bytes: bytes.byteLength,
  punch,
  wheels: wheelSummary,
  spoiler: {
    parts: spoilerEntries.length,
    center: spoiler.cx.map((v) => +v.toFixed(3)),
    size: spoiler.size.map((v) => +v.toFixed(3)),
    faces: spoilerFaces,
    verts: spoilerVerts,
    partBytes: partBytes.byteLength,
    struts: strutSummary,
  },
});

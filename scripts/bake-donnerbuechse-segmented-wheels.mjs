#!/usr/bin/env node
/**
 * Bake Tripo-segmented Donnerbüchse wheels onto the pre-split BodyPaint atlas.
 *
 * Body: `donnerbuechse-pre-wheel-segment.glb` (single atlas, welded tires + engine prim).
 * Segment: wheels-only v2 simple + connectivity — remount `StockWheel_*` only.
 * Engine stays a second BodyPaint prim (remount paused — F6 Motor aus
 * identifies exhaust vs block). Punch ground prims only so side pipes are
 * not carved with the front tires. Punch only the **outboard tire rubber**
 * (annulus outside the hub disk) so the original painted hub and the
 * cabin/quarter wall stay — a full tire cylinder opens the hollow shell.
 *
 *   node scripts/bake-donnerbuechse-segmented-wheels.mjs
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
} from "@gltf-transform/functions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const segDirs = [join(rootDir, "assets/tripo-out/donnerbuechse/segment-wheels-only-v1")];
const bodyPath = join(rootDir, "assets/tripo-out/donnerbuechse/donnerbuechse-pre-wheel-segment.glb");
const carsDir = join(rootDir, "public/models/cars");

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

function primWorldBounds(prim) {
  const pos = prim.getAttribute("POSITION");
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  if (!pos) return { min, max, size: [0, 0, 0] };
  for (let i = 0; i < pos.getCount(); i++) {
    const v = pos.getElement(i, []);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[k]);
      max[k] = Math.max(max[k], v[k]);
    }
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** Low disk tires after body align. Axle along X (thin), disk in YZ. Front skinny, rear fat. */
function isTireMesh(bounds) {
  if (bounds.verts < 250 || bounds.verts > 500) return false;
  if (bounds.min[1] > 0.04) return false;
  const disk = Math.max(bounds.size[1], bounds.size[2]);
  if (disk < 0.55 || disk > 1.2) return false;
  if (bounds.thin > 0.55) return false;
  if (Math.abs(bounds.cx[0]) < 0.5) return false;
  return true;
}

function cornerOf(x, z) {
  const front = z >= 0;
  const left = x < 0;
  if (front) return left ? "FL" : "FR";
  return left ? "RL" : "RR";
}

function findSegmentGlb(dirs) {
  const stack = [...dirs];
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
  const halfW = Math.max(tire.size[0] * 0.5 * 1.05, 0.12);
  const r = Math.max(tire.size[1], tire.size[2]) * 0.5 * 1.04;
  return dy * dy + dz * dz <= r * r && Math.abs(dx) <= halfW;
}

/** Outer tire rubber only — keep the painted hub disk that seals the shell. */
function isOutboardTireRubber(cx, cy, cz, tire) {
  const sign = Math.sign(tire.center[0]) || 1;
  if (sign * cx < sign * tire.center[0] - 0.01) return false;
  const r = Math.hypot(cy - tire.center[1], cz - tire.center[2]);
  const hubKeepR = Math.max(tire.size[1], tire.size[2]) * 0.5 * 0.55;
  return r > hubKeepR;
}

function punchTireVolumes(bodyDoc, tires) {
  const found = [];
  for (const mesh of bodyDoc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const matName = prim.getMaterial()?.getName();
      if (matName && matName !== "BodyPaint") continue;
      const b = primWorldBounds(prim);
      // Engine is a second BodyPaint prim sitting above the ground — do not punch pipes.
      if (b.min[1] > 0.05) continue;
      found.push({ mesh, prim });
    }
  }
  if (!found.length) throw new Error("ground BodyPaint prim missing on pre-split body");

  let keepTotal = 0;
  let droppedTire = 0;
  for (const { mesh, prim } of found) {
    const pos = prim.getAttribute("POSITION");
    const idx = prim.getIndices();
    const nrm = prim.getAttribute("NORMAL");
    const uv = prim.getAttribute("TEXCOORD_0");
    if (!pos || !idx) throw new Error("body needs indexed POSITION");
    if (!uv) throw new Error("BodyPaint missing TEXCOORD_0");

    const keep = [];
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
      const tire = tires.find(
        (candidate) =>
          inTireCylinder(cx, cy, cz, candidate) && isOutboardTireRubber(cx, cy, cz, candidate),
      );
      if (tire) {
        droppedTire++;
        continue;
      }
      keep.push([i0, i1, i2]);
    }
    keepTotal += keep.length;
    const buffer = bodyDoc.getRoot().listBuffers()[0];
    const mat = prim.getMaterial();
    mat.setName("BodyPaint");
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.85);
    const next = remappedPrimitive(bodyDoc, buffer, keep, pos, nrm, uv, mat);
    mesh.removePrimitive(prim);
    mesh.addPrimitive(next);
    mesh.setName("BodyPaint");
  }
  if (keepTotal < 800) throw new Error(`body faces too low after punch: ${keepTotal}`);
  if (droppedTire < 400) throw new Error(`outboard tire punch too sparse: ${droppedTire}`);
  return { keep: keepTotal, droppedTire };
}

function copyTireMaterial(destDoc, srcPrim, name) {
  const srcMat = srcPrim.getMaterial();
  const srcTex = srcMat?.getBaseColorTexture();
  const img = srcTex?.getImage();
  if (!img) throw new Error(`segment tire missing albedo (${name})`);
  const mat = destDoc.createMaterial("Tire");
  mat.setBaseColorTexture(
    destDoc
      .createTexture(`TireAtlas_${name}`)
      .setMimeType(srcTex.getMimeType() || "image/jpeg")
      .setImage(img),
  );
  mat.setBaseColorFactor([1, 1, 1, 1]);
  mat.setMetallicFactor(0);
  mat.setRoughnessFactor(0.9);
  mat.setDoubleSided(true);
  return mat;
}

function cloneTireMesh(destDoc, srcMesh, destMesh, material, center) {
  const buffer = destDoc.getRoot().listBuffers()[0];
  let faces = 0;
  let verts = 0;
  for (const prim of srcMesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const nrm = prim.getAttribute("NORMAL");
    const uv = prim.getAttribute("TEXCOORD_0");
    if (!uv) throw new Error("segment tire missing TEXCOORD_0");
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

const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const src = srcArg || findSegmentGlb(segDirs);
if (!src) throw new Error(`No segmented GLB under ${segDirs.join(" | ")}`);
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
for (const mesh of seg.getRoot().listMeshes()) {
  const b = meshWorldBounds(mesh);
  if (isTireMesh(b)) tireEntries.push({ mesh, bounds: b });
}
if (tireEntries.length !== 4) {
  throw new Error(`expected 4 tire parts, got ${tireEntries.length}`);
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

const punch = punchTireVolumes(body, tires);
await body.transform(dedup(), prune());

const scene = body.getRoot().listScenes()[0];
for (const child of [...scene.listChildren()]) {
  const name = child.getName() ?? "";
  if (name.startsWith("StockWheel_")) scene.removeChild(child);
  if (child.getMesh()?.getName() === "BodyPaint") child.setName("BodyPaint");
}

const wheelSummary = {};
const wheelMeshes = [];
for (const tire of tires) {
  const srcPrim = tire.mesh.listPrimitives()[0];
  const tireMat = copyTireMaterial(body, srcPrim, tire.corner);
  const wheelMesh = body.createMesh(`StockWheel_${tire.corner}`);
  const cloned = cloneTireMesh(body, tire.mesh, wheelMesh, tireMat, tire.center);
  const node = body.createNode(`StockWheel_${tire.corner}`);
  node.setMesh(wheelMesh);
  node.setTranslation(tire.center);
  scene.addChild(node);
  wheelMeshes.push(wheelMesh);
  wheelSummary[tire.corner] = {
    center: tire.center.map((v) => +v.toFixed(3)),
    size: tire.size.map((v) => +v.toFixed(3)),
    faces: cloned.faces,
    verts: cloned.verts,
  };
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
writeFileSync(join(carsDir, "donnerbuechse.glb"), bytes);
console.log("donnerbuechse.glb ← pre-split body + segmented wheels", {
  src,
  aligned,
  bytes: bytes.byteLength,
  punch,
  wheels: wheelSummary,
});

// Engine remount is paused until exhaust vs block is boxed (F6 Motor aus).
// Re-enable: spawn `scripts/bake-donnerbuechse-segmented-engine.mjs` here.

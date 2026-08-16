#!/usr/bin/env node
/**
 * Bake Tripo-segmented Bunker tires onto the good pre-split BodyPaint atlas.
 *
 * Same contract as Bison: keep pre-split body, punch tire ellipsoids, remount
 * `StockWheel_*` with comic albedo face disks (do not UV-carve BodyPaint).
 *
 * Body: `assets/tripo-out/bunker/bunker-pre-wheel-split.glb`
 * Segment: `assets/tripo-out/bunker/segment-wheels-only-v1/`
 * Albedo: `assets/tripo-concepts/bunker-tire-albedo.png`
 *
 *   node scripts/bake-bunker-segmented-wheels.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
  weld,
} from "@gltf-transform/functions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const segDir = join(rootDir, "assets/tripo-out/bunker/segment-wheels-only-v1");
const bodyPath = join(rootDir, "assets/tripo-out/bunker/bunker-pre-wheel-split.glb");
const tireAlbedoPath = join(rootDir, "assets/tripo-concepts/bunker-tire-albedo.png");
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
  return {
    min,
    max,
    size,
    cx: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    verts,
    thin: Math.min(...size),
  };
}

/** Tripo-normalized APC tires (axle along X) after baking node transforms. */
function isTireMesh(bounds) {
  if (bounds.verts < 700 || bounds.verts > 950) return false;
  const disk = Math.max(bounds.size[1], bounds.size[2]);
  if (disk < 0.18 || disk > 0.28) return false;
  if (bounds.thin > 0.12) return false;
  if (Math.abs(bounds.cx[0]) < 0.15) return false;
  return true;
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

function recenterMesh(mesh, offset) {
  const [ox, oy, oz] = offset;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    for (let i = 0; i < pos.getCount(); i++) {
      const v = pos.getElement(i, []);
      pos.setElement(i, [v[0] - ox, v[1] - oy, v[2] - oz]);
    }
    pos.setArray(pos.getArray());
  }
}

function setAnnulusDiskUvs(doc, prim, { mirrorU = false } = {}) {
  const pos = prim.getAttribute("POSITION");
  if (!pos) return;
  let rMin = Infinity;
  let rMax = 0;
  for (let i = 0; i < pos.getCount(); i++) {
    const v = pos.getElement(i, []);
    const r = Math.hypot(v[1], v[2]);
    if (r < 1e-5) continue;
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
  }
  if (!(rMax > rMin) || !Number.isFinite(rMin)) {
    rMin = 0;
    rMax = Math.max(rMax, 1e-3);
  }
  const albedoR0 = 0.58;
  const albedoR1 = 0.98;
  const uvs = new Float32Array(pos.getCount() * 2);
  for (let i = 0; i < pos.getCount(); i++) {
    const v = pos.getElement(i, []);
    const r = Math.hypot(v[1], v[2]);
    const len = Math.max(r, 1e-6);
    let t = (r - rMin) / (rMax - rMin);
    t = Math.min(1, Math.max(0, t));
    const rUv = albedoR0 + t * (albedoR1 - albedoR0);
    let u = 0.5 + (v[2] / len) * rUv * 0.5;
    const vv = 0.5 + (v[1] / len) * rUv * 0.5;
    if (mirrorU) u = 1 - u;
    uvs[i * 2] = Math.min(1, Math.max(0, u));
    uvs[i * 2 + 1] = Math.min(1, Math.max(0, vv));
  }
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  prim.setAttribute(
    "TEXCOORD_0",
    doc.createAccessor().setType("VEC2").setArray(uvs).setBuffer(buffer),
  );
}

function filterFacesOutsideHub(faces, pos, holeFrac = 0.42) {
  let rMax = 0;
  for (let i = 0; i < pos.getCount(); i++) {
    const v = pos.getElement(i, []);
    rMax = Math.max(rMax, Math.hypot(v[1], v[2]));
  }
  const holeR = rMax * holeFrac;
  if (!(holeR > 0.02)) return { faces, dropped: 0, holeR: 0 };
  const kept = [];
  let dropped = 0;
  for (const tri of faces) {
    const [i0, i1, i2] = tri;
    const a = pos.getElement(i0, []);
    const b = pos.getElement(i1, []);
    const c = pos.getElement(i2, []);
    const ra = Math.hypot(a[1], a[2]);
    const rb = Math.hypot(b[1], b[2]);
    const rc = Math.hypot(c[1], c[2]);
    if (Math.min(ra, rb, rc) < holeR) {
      dropped++;
      continue;
    }
    kept.push(tri);
  }
  if (kept.length < Math.max(12, faces.length * 0.35)) {
    return { faces, dropped: 0, holeR };
  }
  return { faces: kept, dropped, holeR };
}

function addComicWheelFace(doc, mesh, { xOffset, radius, material, mirrorU, buffer }) {
  const segs = 32;
  const pos = [xOffset, 0, 0];
  const nrm = [Math.sign(xOffset) || 1, 0, 0];
  const uvs = [0.5, 0.5];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const y = Math.sin(a) * radius;
    const z = Math.cos(a) * radius;
    pos.push(xOffset, y, z);
    nrm.push(Math.sign(xOffset) || 1, 0, 0);
    let u = 0.5 + (z / radius) * 0.5;
    const v = 0.5 + (y / radius) * 0.5;
    if (mirrorU) u = 1 - u;
    uvs.push(u, v);
  }
  const idx = [];
  const flip = xOffset < 0;
  for (let i = 0; i < segs; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % segs);
    if (flip) idx.push(0, b, a);
    else idx.push(0, a, b);
  }
  const prim = doc
    .createPrimitive()
    .setAttribute(
      "POSITION",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer),
    )
    .setAttribute(
      "NORMAL",
      doc.createAccessor().setType("VEC3").setArray(new Float32Array(nrm)).setBuffer(buffer),
    )
    .setAttribute(
      "TEXCOORD_0",
      doc.createAccessor().setType("VEC2").setArray(new Float32Array(uvs)).setBuffer(buffer),
    )
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(idx)).setBuffer(buffer))
    .setMaterial(material);
  mesh.addPrimitive(prim);
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
  if (newUv.length) {
    p.setAttribute(
      "TEXCOORD_0",
      doc.createAccessor().setType("VEC2").setArray(new Float32Array(newUv)).setBuffer(buffer),
    );
  }
  return p;
}

function punchTireVolumes(bodyDoc, tireCenters) {
  const found = [];
  for (const mesh of bodyDoc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMaterial()?.getName() === "BodyPaint") found.push({ mesh, prim });
    }
  }
  if (!found.length) throw new Error("BodyPaint prim missing on pre-split body");
  const { mesh, prim } = found[0];
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices();
  const nrm = prim.getAttribute("NORMAL");
  const uv = prim.getAttribute("TEXCOORD_0");
  if (!pos || !idx) throw new Error("body needs indexed POSITION");

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
    let inTire = false;
    for (const tire of tireCenters) {
      const dx = cx - tire.center[0];
      const dy = cy - tire.center[1];
      const dz = cz - tire.center[2];
      if ((dx * dx) / (tire.rx * tire.rx) + (dy * dy) / (tire.ry * tire.ry) + (dz * dz) / (tire.rz * tire.rz) <= 1) {
        inTire = true;
        break;
      }
    }
    if (!inTire) keep.push([i0, i1, i2]);
  }
  if (keep.length < 500) throw new Error(`body faces too low after punch: ${keep.length}`);
  const buffer = bodyDoc.getRoot().listBuffers()[0];
  const mat = prim.getMaterial();
  mat.setName("BodyPaint");
  mat.setMetallicFactor(0);
  mat.setRoughnessFactor(0.85);
  const next = remappedPrimitive(bodyDoc, buffer, keep, pos, nrm, uv, mat);
  mesh.listPrimitives().forEach((p) => mesh.removePrimitive(p));
  mesh.addPrimitive(next);
  mesh.setName("BodyPaint");
  return keep.length;
}

const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const src = srcArg || findSegmentGlb(segDir);
if (!src) throw new Error(`No segmented GLB under ${segDir}`);
if (!existsSync(bodyPath)) throw new Error(`Missing body bake ${bodyPath}`);
if (!existsSync(tireAlbedoPath)) throw new Error(`Missing tire albedo ${tireAlbedoPath}`);

const seg = await io.read(src);
await seg.transform(flatten(), dedup());
bakeAllNodeTransforms(seg);
await seg.transform(dedup(), prune());

const tireEntries = [];
for (const mesh of seg.getRoot().listMeshes()) {
  const b = meshWorldBounds(mesh);
  if (isTireMesh(b)) tireEntries.push({ mesh, bounds: b });
}
if (tireEntries.length !== 4) {
  throw new Error(`expected 4 tire parts, got ${tireEntries.length}`);
}

const body = await io.read(bodyPath);
await body.transform(flatten(), dedup());
bakeAllNodeTransforms(body);

const aligned = alignSegmentToBody(seg, body);

const tires = [];
for (const { mesh } of tireEntries) {
  const b = meshWorldBounds(mesh);
  const corner = cornerOf(b.cx[0], b.cx[2]);
  tires.push({
    mesh,
    center: b.cx,
    corner,
    rx: Math.max(0.22, b.size[0] * 0.65),
    ry: Math.max(0.28, b.size[1] * 0.65),
    rz: Math.max(0.28, b.size[2] * 0.65),
  });
}
if (new Set(tires.map((t) => t.corner)).size !== 4) {
  throw new Error(`tire corner collision: ${tires.map((t) => t.corner).join(",")}`);
}

const bodyFaces = punchTireVolumes(body, tires);
await body.transform(weld({ tolerance: 0.00015 }), dedup(), prune());

const scene = body.getRoot().listScenes()[0];
for (const child of [...scene.listChildren()]) {
  if (child.getName()?.startsWith("StockWheel_")) scene.removeChild(child);
}

const tirePng = readFileSync(tireAlbedoPath);
const tireTex = body.createTexture("TireAlbedo").setMimeType("image/png").setImage(tirePng);
const faceMat = body.createMaterial("Tire");
faceMat.setBaseColorTexture(tireTex);
faceMat.setBaseColorFactor([1, 1, 1, 1]);
faceMat.setMetallicFactor(0);
faceMat.setRoughnessFactor(0.9);
faceMat.setDoubleSided(true);

const summary = {};
for (const tire of tires) {
  recenterMesh(tire.mesh, tire.center);
  const local = meshWorldBounds(tire.mesh);
  const wheelMesh = body.createMesh(`StockWheel_${tire.corner}`);
  const buffer = body.getRoot().listBuffers()[0];
  const mirrorU = tire.corner === "FL" || tire.corner === "RL";
  let hubDropped = 0;
  for (const prim of tire.mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const nrm = prim.getAttribute("NORMAL");
    const idx = prim.getIndices();
    const faces = [];
    if (idx) {
      for (let t = 0; t < idx.getCount() / 3; t++) {
        faces.push([idx.getScalar(t * 3), idx.getScalar(t * 3 + 1), idx.getScalar(t * 3 + 2)]);
      }
    } else {
      for (let t = 0; t < pos.getCount() / 3; t++) faces.push([t * 3, t * 3 + 1, t * 3 + 2]);
    }
    const carved = filterFacesOutsideHub(faces, pos, 0.42);
    hubDropped += carved.dropped;
    const p = remappedPrimitive(body, buffer, carved.faces, pos, nrm, null, faceMat);
    setAnnulusDiskUvs(body, p, { mirrorU });
    wheelMesh.addPrimitive(p);
  }
  const halfW = Math.max(local.size[0] * 0.5, 0.06);
  const faceR = Math.max(local.size[1], local.size[2]) * 0.48;
  for (const sign of [-1, 1]) {
    addComicWheelFace(body, wheelMesh, {
      xOffset: sign * (halfW + 0.03),
      radius: faceR * 0.92,
      material: faceMat,
      mirrorU: sign < 0 ? !mirrorU : mirrorU,
      buffer,
    });
  }
  const node = body.createNode(`StockWheel_${tire.corner}`);
  node.setMesh(wheelMesh);
  node.setTranslation(tire.center);
  scene.addChild(node);
  summary[tire.corner] = {
    center: tire.center.map((v) => +v.toFixed(3)),
    hasMap: true,
    hasFace: true,
    faces: 2,
    faceR: +faceR.toFixed(3),
    mirrorU,
    hubDropped,
  };
}

await body.transform(dedup(), prune());
mkdirSync(carsDir, { recursive: true });
const bytes = await io.writeBinary(body);
writeFileSync(join(carsDir, "bunker.glb"), bytes);
console.log("bunker.glb ← pre-split body + segmented tires + comic albedo", {
  src,
  bodyPath,
  aligned,
  bytes: bytes.byteLength,
  bodyFaces,
  wheels: summary,
});

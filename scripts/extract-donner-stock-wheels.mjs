#!/usr/bin/env node
/**
 * @deprecated Use `npm run cars:bake-donnerbuechse-segmented-wheels` (Tripo mesh
 * segment + remount). UV/color carve of BodyPaint islands fails texture/QA.
 *
 *   node scripts/extract-donner-stock-wheels.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, prune, weld } from "@gltf-transform/functions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const carPath = join(root, "public/models/cars/donnerbuechse.glb");
const backupPath = join(root, "assets/tripo-out/donnerbuechse/donnerbuechse-pre-wheel-split.glb");
const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const srcPath = srcArg || carPath;

const CORNERS = ["FL", "FR", "RL", "RR"];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function isDarkGreyPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Authored rubber / rim shadow — not body blue, not bright chrome.
  return max < 110 && max - min < 50 && b <= r + 18;
}

/** Tire volume only — keep blue rails / arches on BodyPaint. */
function inWheelVolume(x, y, z) {
  if (y < -0.02 || y > 0.62) return false;
  if (Math.abs(x) < 0.62 || Math.abs(x) > 1.25) return false;
  const front = z >= 0.9 && z <= 1.98;
  const rear = z <= -0.65 && z >= -1.98;
  return front || rear;
}

function cornerOf(x, z) {
  const front = z >= 0;
  const left = x < 0;
  if (front) return left ? "FL" : "FR";
  return left ? "RL" : "RR";
}

function remappedPrimitive(doc, buffer, faces, srcPos, srcNrm, srcUv, material, offset) {
  const used = new Map();
  const newPos = [];
  const newNrm = [];
  const newUv = [];
  const newIdx = [];
  const [ox, oy, oz] = offset ?? [0, 0, 0];
  for (const [i0, i1, i2] of faces) {
    for (const old of [i0, i1, i2]) {
      if (!used.has(old)) {
        used.set(old, newPos.length / 3);
        const v = srcPos.getElement(old, []);
        newPos.push(v[0] - ox, v[1] - oy, v[2] - oz);
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

function faceCenter(pos, face) {
  const a = pos.getElement(face[0], []);
  const b = pos.getElement(face[1], []);
  const c = pos.getElement(face[2], []);
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
}

function aabbCenter(pos, faces) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const face of faces) {
    for (const i of face) {
      const v = pos.getElement(i, []);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
  }
  return min.map((m, i) => (m + max[i]) / 2);
}

mkdirSync(dirname(backupPath), { recursive: true });
if (!srcArg) copyFileSync(carPath, backupPath);

const src = await io.read(srcPath);
await src.transform(dedup(), flatten(), weld());

const bodyMesh = src.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
const prim = bodyMesh?.listPrimitives()[0];
if (!prim) throw new Error("BodyPaint mesh/prim missing");
const pos = prim.getAttribute("POSITION");
const idx = prim.getIndices();
const nrm = prim.getAttribute("NORMAL");
const uv = prim.getAttribute("TEXCOORD_0");
const srcMat = prim.getMaterial();
if (!pos || !idx || !srcMat || !uv) throw new Error("need POSITION+indices+uv+material");

const tex = srcMat.getBaseColorTexture();
const img = tex?.getImage();
if (!img) throw new Error("BodyPaint needs baseColor texture for dark-grey tire mask");
const { data: atlas, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({
  resolveWithObject: true,
});

function sampleAtlas(u, v) {
  const x = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width)));
  const y = Math.min(info.height - 1, Math.max(0, Math.floor((1 - v) * info.height)));
  const o = (y * info.width + x) * 4;
  return [atlas[o], atlas[o + 1], atlas[o + 2]];
}

function faceIsDarkWheel(a, b, c, i0, i1, i2) {
  const verts = [a, b, c];
  // All three verts in a tire volume — reject skirts/cross-car spans that steal blue rails.
  if (!verts.every((v) => inWheelVolume(v[0], v[1], v[2]))) return false;
  const side = Math.sign(a[0]);
  if (side === 0 || verts.some((v) => Math.sign(v[0]) !== side)) return false;
  let dark = 0;
  for (const i of [i0, i1, i2]) {
    const t = uv.getElement(i, []);
    const [r, g, b] = sampleAtlas(t[0], t[1]);
    if (isDarkGreyPixel(r, g, b)) dark++;
  }
  return dark >= 2;
}

const bodyFaces = [];
const byCorner = { FL: [], FR: [], RL: [], RR: [] };
const triCount = idx.getCount() / 3;
for (let t = 0; t < triCount; t++) {
  const i0 = idx.getScalar(t * 3);
  const i1 = idx.getScalar(t * 3 + 1);
  const i2 = idx.getScalar(t * 3 + 2);
  const a = pos.getElement(i0, []);
  const b = pos.getElement(i1, []);
  const c = pos.getElement(i2, []);
  const face = [i0, i1, i2];
  if (faceIsDarkWheel(a, b, c, i0, i1, i2)) {
    const [cx, , cz] = faceCenter(pos, face);
    byCorner[cornerOf(cx, cz)].push(face);
  } else {
    bodyFaces.push(face);
  }
}

for (const corner of CORNERS) {
  if (byCorner[corner].length < 40) {
    throw new Error(`${corner} wheel faces too low: ${byCorner[corner].length}`);
  }
}
if (bodyFaces.length < 1500) throw new Error(`body faces too low: ${bodyFaces.length}`);

const out = await io.read(srcPath);
await out.transform(dedup(), flatten(), weld());

const outBodyMesh = out.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
const outPrim = outBodyMesh.listPrimitives()[0];
const outMat = outPrim.getMaterial();
outMat.setName("BodyPaint");
const buffer = out.getRoot().listBuffers()[0];

const bodyPrim = remappedPrimitive(out, buffer, bodyFaces, pos, nrm, uv, outMat);
outBodyMesh.listPrimitives().forEach((p) => outBodyMesh.removePrimitive(p));
outBodyMesh.addPrimitive(bodyPrim);

const scene = out.getRoot().listScenes()[0];
for (const child of [...scene.listChildren()]) {
  if (child.getName()?.startsWith("StockWheel_")) {
    scene.removeChild(child);
  }
}

const tireMat = out.createMaterial("Tire");
tireMat.setBaseColorFactor([0.12, 0.12, 0.14, 1]);
tireMat.setMetallicFactor(0);
tireMat.setRoughnessFactor(0.92);

const summary = {};
for (const corner of CORNERS) {
  const faces = byCorner[corner];
  const center = aabbCenter(pos, faces);
  const wheelPrim = remappedPrimitive(out, buffer, faces, pos, nrm, uv, tireMat, center);
  const wheelMesh = out.createMesh(`StockWheel_${corner}`);
  wheelMesh.addPrimitive(wheelPrim);
  const node = out.createNode(`StockWheel_${corner}`);
  node.setMesh(wheelMesh);
  node.setTranslation(center);
  scene.addChild(node);
  summary[corner] = { faces: faces.length, center: center.map((v) => +v.toFixed(3)) };
}

await out.transform(prune(), dedup());
const bytes = await io.writeBinary(out);
writeFileSync(carPath, Buffer.from(bytes));

console.log("donnerbuechse.glb stock wheels split", {
  bodyFaces: bodyFaces.length,
  wheels: summary,
  bytes: bytes.byteLength,
});

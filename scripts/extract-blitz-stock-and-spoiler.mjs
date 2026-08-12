#!/usr/bin/env node
/**
 * From pre-wing-free Blitz (has windshield + GT wing):
 *  - stock body = mesh without wing faces → public/models/cars/blitz.glb
 *  - Heckspoiler part = extracted wing → public/models/parts/blitz-rear_spoiler.glb
 *
 * Source: git 292c6a6 blitz.glb (or --from path).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  clearNodeTransform,
  dedup,
  flatten,
  getBounds,
  prune,
  weld,
} from "@gltf-transform/functions";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outCar = join(root, "public/models/cars/blitz.glb");
const outPart = join(root, "public/models/parts/blitz-rear_spoiler.glb");
const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const srcPath = srcArg || join("/tmp/blitz-fix/blitz-with-wing.glb");

if (!srcArg) {
  execFileSync("git", ["show", "292c6a6:public/models/cars/blitz.glb"], {
    cwd: root,
    maxBuffer: 20e6,
    stdio: ["ignore", "pipe", "inherit"],
  });
  // rewrite via shell redirect already done by caller sometimes — ensure file
  try {
    readFileSync(srcPath);
  } catch {
    mkdirSync(dirname(srcPath), { recursive: true });
    const buf = execFileSync("git", ["show", "292c6a6:public/models/cars/blitz.glb"], {
      cwd: root,
      maxBuffer: 20e6,
    });
    writeFileSync(srcPath, buf);
  }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** GT wing on old bake: high rear deck geometry (struts + blade). */
function isWingVertex(x, y, z) {
  if (z > -1.22) return false;
  // Strip all rear-deck wing / lip / strut above the trunk sheet
  if (y < 0.72) return false;
  if (y >= 0.78) return true;
  if (Math.abs(x) < 0.62 && z < -1.38) return true;
  return false;
}

function faceIsWing(a, b, c) {
  // Majority of verts in wing region → wing face (keeps body seams clean)
  let n = 0;
  for (const v of [a, b, c]) if (isWingVertex(v[0], v[1], v[2])) n++;
  return n >= 2;
}

function bakeNodeTree(node) {
  clearNodeTransform(node);
  for (const child of node.listChildren()) bakeNodeTree(child);
}

function forEachPos(doc, fn) {
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

function sitAndCenter(doc, { length = null, materialName = "BodyPaint" } = {}) {
  for (const scene of doc.getRoot().listScenes()) {
    for (const rootN of scene.listChildren()) bakeNodeTree(rootN);
  }
  let b = getBounds(doc.getRoot().listScenes()[0]);
  forEachPos(doc, (v) => {
    v[0] -= (b.min[0] + b.max[0]) / 2;
    v[1] -= b.min[1];
    v[2] -= (b.min[2] + b.max[2]) / 2;
  });
  if (length) {
    b = getBounds(doc.getRoot().listScenes()[0]);
    const sz = b.max[2] - b.min[2];
    const s = length / Math.max(sz, 1e-6);
    forEachPos(doc, (v) => {
      v[0] *= s;
      v[1] *= s;
      v[2] *= s;
    });
    b = getBounds(doc.getRoot().listScenes()[0]);
    forEachPos(doc, (v) => {
      v[1] -= b.min[1];
      v[2] -= (b.min[2] + b.max[2]) / 2;
      v[0] -= (b.min[0] + b.max[0]) / 2;
    });
  }
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      if (m) m.setName(materialName);
    }
  }
}

async function splitSource() {
  const doc = await io.read(srcPath);
  await doc.transform(dedup(), flatten(), weld());

  // Assume single mesh / first prim with indices
  const mesh = doc.getRoot().listMeshes()[0];
  if (!mesh) throw new Error("no mesh");
  const prim = mesh.listPrimitives()[0];
  if (!prim) throw new Error("no prim");
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices();
  if (!pos || !idx) throw new Error("need POSITION+indices");

  const bodyFaces = [];
  const wingFaces = [];
  const triCount = idx.getCount() / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx.getScalar(t * 3);
    const i1 = idx.getScalar(t * 3 + 1);
    const i2 = idx.getScalar(t * 3 + 2);
    const a = pos.getElement(i0, []);
    const b = pos.getElement(i1, []);
    const c = pos.getElement(i2, []);
    if (faceIsWing(a, b, c)) wingFaces.push([i0, i1, i2]);
    else bodyFaces.push([i0, i1, i2]);
  }
  console.log("faces body", bodyFaces.length, "wing", wingFaces.length);

  function buildSubDoc(faces, materialName) {
    const sub = new Document();
    const buffer = sub.createBuffer();
    const scene = sub.createScene("Scene");
    const node = sub.createNode("Root");
    scene.addChild(node);
    const m = sub.createMesh("Mesh");
    node.setMesh(m);

    // Remap used verts
    const used = new Map();
    const newPos = [];
    const newNrm = [];
    const newUv = [];
    const nrmAttr = prim.getAttribute("NORMAL");
    const uvAttr = prim.getAttribute("TEXCOORD_0");
    const newIdx = [];
    for (const [i0, i1, i2] of faces) {
      for (const old of [i0, i1, i2]) {
        if (!used.has(old)) {
          used.set(old, newPos.length / 3);
          const v = pos.getElement(old, []);
          newPos.push(v[0], v[1], v[2]);
          if (nrmAttr) {
            const n = nrmAttr.getElement(old, []);
            newNrm.push(n[0], n[1], n[2]);
          }
          if (uvAttr) {
            const u = uvAttr.getElement(old, []);
            newUv.push(u[0], u[1]);
          }
        }
        newIdx.push(used.get(old));
      }
    }

    const posAcc = sub
      .createAccessor("POSITION")
      .setType("VEC3")
      .setArray(new Float32Array(newPos))
      .setBuffer(buffer);
    const idxAcc = sub
      .createAccessor("INDICES")
      .setType("SCALAR")
      .setArray(new Uint32Array(newIdx))
      .setBuffer(buffer);
    const p = sub.createPrimitive().setAttribute("POSITION", posAcc).setIndices(idxAcc);
    if (newNrm.length) {
      p.setAttribute(
        "NORMAL",
        sub.createAccessor("NORMAL").setType("VEC3").setArray(new Float32Array(newNrm)).setBuffer(buffer),
      );
    }
    if (newUv.length) {
      p.setAttribute(
        "TEXCOORD_0",
        sub.createAccessor("TEXCOORD_0").setType("VEC2").setArray(new Float32Array(newUv)).setBuffer(buffer),
      );
    }

    // Copy base color texture from source if present
    const srcMat = prim.getMaterial();
    const mat = sub.createMaterial(materialName);
    if (srcMat) {
      const tex = srcMat.getBaseColorTexture();
      if (tex) {
        const img = tex.getImage();
        if (img) {
          const t = sub.createTexture(tex.getName() || "base").setImage(img).setMimeType(tex.getMimeType() || "image/jpeg");
          mat.setBaseColorTexture(t);
        }
      }
      const bc = srcMat.getBaseColorFactor();
      if (bc) mat.setBaseColorFactor(bc);
    }
    p.setMaterial(mat);
    m.addPrimitive(p);
    return sub;
  }

  const bodyDoc = buildSubDoc(bodyFaces, "BodyPaint");
  await bodyDoc.transform(dedup(), weld(), prune());
  sitAndCenter(bodyDoc, { length: 3.7, materialName: "BodyPaint" });
  // Keep Tripo glass albedo (do not opaque-darken cabin windows).
  await io.write(outCar, bodyDoc);
  const bb = getBounds(bodyDoc.getRoot().listScenes()[0]);
  console.log("stock bbox y", (bb.max[1] - bb.min[1]).toFixed(3), "z", (bb.max[2] - bb.min[2]).toFixed(3));

  const wingDoc = buildSubDoc(wingFaces, "Spoiler");
  await wingDoc.transform(dedup(), weld(), prune());
  sitAndCenter(wingDoc, { materialName: "Spoiler" });
  // Cap part height so it mounts as a readable wing
  let wb = getBounds(wingDoc.getRoot().listScenes()[0]);
  const maxH = 0.55;
  const h = wb.max[1] - wb.min[1];
  if (h > maxH) {
    const s = maxH / h;
    forEachPos(wingDoc, (v) => {
      v[0] *= s;
      v[1] *= s;
      v[2] *= s;
    });
    wb = getBounds(wingDoc.getRoot().listScenes()[0]);
    forEachPos(wingDoc, (v) => {
      v[1] -= wb.min[1];
      v[0] -= (wb.min[0] + wb.max[0]) / 2;
      v[2] -= (wb.min[2] + wb.max[2]) / 2;
    });
  }
  await io.write(outPart, wingDoc);
  wb = getBounds(wingDoc.getRoot().listScenes()[0]);
  console.log("spoiler size", {
    x: +(wb.max[0] - wb.min[0]).toFixed(3),
    y: +(wb.max[1] - wb.min[1]).toFixed(3),
    z: +(wb.max[2] - wb.min[2]).toFixed(3),
  });
}

await splitSource();
console.log("wrote", outCar, outPart);

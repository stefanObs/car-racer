#!/usr/bin/env node
/**
 * Remount Donnerbüchse's already-disconnected engine prim as `StockEngine`,
 * then move body-paint-blue faces back onto BodyPaint and aft header tails
 * onto StockEngine. No AABB punch of cabin / wheels.
 *
 *   node scripts/bake-donnerbuechse-segmented-engine.mjs
 *   node scripts/bake-donnerbuechse-segmented-engine.mjs --from=path/to.glb
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import sharp from "sharp";

/** Albedo at mesh (−0.593, 1.097, 0.284) — stock Donner body paint, not chrome. */
export const DONNER_BODY_PAINT_BLUE = [40, 111, 217];

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const carPath = join(rootDir, "public/models/cars/donnerbuechse.glb");
const srcArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const srcPath = srcArg || carPath;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function primWorldBounds(prim) {
  const pos = prim.getAttribute("POSITION");
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  if (!pos) return { min, max, size: [0, 0, 0], verts: 0 };
  for (let i = 0; i < pos.getCount(); i++) {
    const v = pos.getElement(i, []);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[k]);
      max[k] = Math.max(max[k], v[k]);
    }
  }
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    verts: pos.getCount(),
  };
}

/** Hood-bay prim: off the ground, not the full hot-rod length. */
function isEnginePrim(prim) {
  const b = primWorldBounds(prim);
  if (b.verts < 800) return false;
  if (b.min[1] <= 0.05) return false;
  if (b.size[2] >= 2.5) return false;
  if (b.min[2] < -0.4 || b.max[2] > 1.85) return false;
  return true;
}

function countRegion(prim, pred) {
  const pos = prim.getAttribute("POSITION");
  if (!pos) return 0;
  let n = 0;
  for (let i = 0; i < pos.getCount(); i++) {
    const v = pos.getElement(i, []);
    if (pred(v[0], v[1], v[2])) n++;
  }
  return n;
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

function triCentroid(pos, i0, i1, i2) {
  const a = pos.getElement(i0, []);
  const b = pos.getElement(i1, []);
  const c = pos.getElement(i2, []);
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
}

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hueDelta(a, b) {
  return Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
}

/** Same comic body blue as DONNER_BODY_PAINT_BLUE, including darker AO. */
export function isDonnerBodyPaintBlue(rgb) {
  const [h, s] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  const [rh] = rgbToHsv(...DONNER_BODY_PAINT_BLUE);
  return hueDelta(h, rh) <= 28 && s >= 0.22 && rgb[2] > rgb[0] + 12;
}

function sampleAlbedoRgb(tex, u, v) {
  let uu = u - Math.floor(u);
  let vv = v - Math.floor(v);
  if (uu < 0) uu += 1;
  if (vv < 0) vv += 1;
  const px = Math.min(tex.w - 1, Math.max(0, Math.floor(uu * tex.w)));
  const py = Math.min(tex.h - 1, Math.max(0, Math.floor((1 - vv) * tex.h)));
  const i = (py * tex.w + px) * 4;
  return [tex.data[i], tex.data[i + 1], tex.data[i + 2]];
}

async function materialAlbedo(mat) {
  const img = mat?.getBaseColorTexture()?.getImage();
  if (!img) throw new Error(`${mat?.getName() ?? "material"} missing albedo`);
  const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function faceCentroidUv(uv, i0, i1, i2) {
  const a = uv.getElement(i0, []);
  const b = uv.getElement(i1, []);
  const c = uv.getElement(i2, []);
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
}

function faceAlbedoRgb(prim, tex, i0, i1, i2) {
  const uv = prim.getAttribute("TEXCOORD_0");
  if (!uv) return [0, 0, 0];
  const [u, v] = faceCentroidUv(uv, i0, i1, i2);
  return sampleAlbedoRgb(tex, u, v);
}

/** Aft lower zoomie tails left on BodyPaint. */
function isHeaderTailCentroid(p) {
  const ax = Math.abs(p[0]);
  return ax >= 0.58 && ax <= 1.08 && p[1] >= 0.16 && p[1] <= 0.72 && p[2] >= -0.1 && p[2] <= 0.38;
}

function partitionPrimFaces(prim, takePred) {
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices();
  if (!pos || !idx) throw new Error("indexed POSITION required");
  const keep = [];
  const take = [];
  for (let t = 0; t < idx.getCount() / 3; t++) {
    const i0 = idx.getScalar(t * 3);
    const i1 = idx.getScalar(t * 3 + 1);
    const i2 = idx.getScalar(t * 3 + 2);
    const face = [i0, i1, i2];
    if (takePred(prim, i0, i1, i2)) take.push(face);
    else keep.push(face);
  }
  return { keep, take, pos, nrm: prim.getAttribute("NORMAL"), uv: prim.getAttribute("TEXCOORD_0") };
}

function transferTakenFaces(doc, srcMesh, destMesh, destMat, takePred) {
  const buffer = doc.getRoot().listBuffers()[0];
  let moved = 0;
  for (const prim of [...srcMesh.listPrimitives()]) {
    const { keep, take, pos, nrm, uv } = partitionPrimFaces(prim, takePred);
    if (!take.length) continue;
    const srcMat = prim.getMaterial();
    srcMesh.removePrimitive(prim);
    if (keep.length) {
      srcMesh.addPrimitive(remappedPrimitive(doc, buffer, keep, pos, nrm, uv, srcMat));
    }
    destMesh.addPrimitive(remappedPrimitive(doc, buffer, take, pos, nrm, uv, destMat));
    moved += take.length;
  }
  return moved;
}

function countMatchingFaces(mesh, pred) {
  let n = 0;
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    if (!idx) continue;
    for (let t = 0; t < idx.getCount() / 3; t++) {
      const i0 = idx.getScalar(t * 3);
      const i1 = idx.getScalar(t * 3 + 1);
      const i2 = idx.getScalar(t * 3 + 2);
      if (pred(prim, i0, i1, i2)) n++;
    }
  }
  return n;
}

async function reclassifyDonnerEngineFaces(doc) {
  const bodyMesh = doc.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
  const engMesh = doc.getRoot().listMeshes().find((m) => m.getName() === "StockEngine");
  if (!bodyMesh || !engMesh) throw new Error("BodyPaint + StockEngine required for reclassify");
  const bodyMat = bodyMesh.listPrimitives()[0]?.getMaterial();
  const engMat = engMesh.listPrimitives()[0]?.getMaterial();
  if (!bodyMat || !engMat) throw new Error("materials missing for reclassify");
  const bodyTex = await materialAlbedo(bodyMat);
  const engTex = await materialAlbedo(engMat);

  const blueToBody = transferTakenFaces(doc, engMesh, bodyMesh, bodyMat, (prim, i0, i1, i2) =>
    isDonnerBodyPaintBlue(faceAlbedoRgb(prim, engTex, i0, i1, i2)),
  );
  const tailsToEngine = transferTakenFaces(doc, bodyMesh, engMesh, engMat, (prim, i0, i1, i2) => {
    const pos = prim.getAttribute("POSITION");
    if (!pos || !isHeaderTailCentroid(triCentroid(pos, i0, i1, i2))) return false;
    return !isDonnerBodyPaintBlue(faceAlbedoRgb(prim, bodyTex, i0, i1, i2));
  });

  const leftoverBlue = countMatchingFaces(engMesh, (prim, i0, i1, i2) =>
    isDonnerBodyPaintBlue(faceAlbedoRgb(prim, engTex, i0, i1, i2)),
  );
  const leftoverTails = countMatchingFaces(bodyMesh, (prim, i0, i1, i2) => {
    const pos = prim.getAttribute("POSITION");
    if (!pos || !isHeaderTailCentroid(triCentroid(pos, i0, i1, i2))) return false;
    return !isDonnerBodyPaintBlue(faceAlbedoRgb(prim, bodyTex, i0, i1, i2));
  });
  if (leftoverBlue > 12) throw new Error(`body-paint blue still on StockEngine: ${leftoverBlue}`);
  if (leftoverTails > 8) throw new Error(`header tails still on BodyPaint: ${leftoverTails}`);
  if (engMesh.listPrimitives().length < 1) throw new Error("StockEngine emptied by blue return");
  if (bodyMesh.listPrimitives().length < 1) throw new Error("BodyPaint emptied by tail return");
  return { blueToBody, tailsToEngine, leftoverBlue, leftoverTails };
}

/**
 * Move the engine BodyPaint prim onto a StockEngine node at identity
 * (verts already in mesh space). Returns a summary; no-ops if already split.
 */
export async function promoteDonnerStockEngine(doc) {
  const existing = doc.getRoot().listNodes().find((n) => n.getName() === "StockEngine");
  if (existing?.getMesh()) {
    const bodyMats = new Set(
      doc
        .getRoot()
        .listMeshes()
        .filter((m) => m.getName() === "BodyPaint")
        .flatMap((m) => m.listPrimitives().map((p) => p.getMaterial())),
    );
    for (const prim of existing.getMesh().listPrimitives()) {
      const mat = prim.getMaterial();
      if (!mat) continue;
      if (bodyMats.has(mat) || mat.getName() === "BodyPaint") {
        const clone = mat.clone();
        clone.setName("StockEngine");
        clone.setMetallicFactor(0.02);
        clone.setRoughnessFactor(0.84);
        prim.setMaterial(clone);
      } else {
        mat.setName("StockEngine");
      }
    }
    return { already: true, engineVerts: 0, bodyVerts: 0, ...(await reclassifyDonnerEngineFaces(doc)) };
  }

  const bodyNode = doc.getRoot().listNodes().find((n) => {
    const mesh = n.getMesh();
    return n.getName() === "BodyPaint" || mesh?.getName() === "BodyPaint";
  });
  const bodyMesh = bodyNode?.getMesh();
  if (!bodyMesh) throw new Error("BodyPaint mesh missing");

  const enginePrims = bodyMesh.listPrimitives().filter(isEnginePrim);
  if (enginePrims.length !== 1) {
    throw new Error(`expected 1 engine BodyPaint prim, got ${enginePrims.length}`);
  }
  const enginePrim = enginePrims[0];
  const engineBounds = primWorldBounds(enginePrim);

  const cabinOnEngine = countRegion(enginePrim, (_x, y, z) => z < -0.3 && y > 0.8);
  const grilleOnEngine = countRegion(enginePrim, (_x, y, z) => z > 1.55 && y > 0.3);
  if (cabinOnEngine > 8) throw new Error(`engine prim ate cabin verts: ${cabinOnEngine}`);
  if (grilleOnEngine > 40) throw new Error(`engine prim ate grille verts: ${grilleOnEngine}`);

  const srcMat = enginePrim.getMaterial();
  if (!srcMat) throw new Error("engine prim missing material");
  const engMat = srcMat.clone();
  engMat.setName("StockEngine");
  // Distinct PBR so later material-dedup cannot merge this back into BodyPaint.
  engMat.setMetallicFactor(0.02);
  engMat.setRoughnessFactor(0.84);
  enginePrim.setMaterial(engMat);

  bodyMesh.removePrimitive(enginePrim);
  if (bodyMesh.listPrimitives().length < 1) {
    throw new Error("BodyPaint empty after engine remount");
  }
  bodyMesh.setName("BodyPaint");
  bodyNode.setName("BodyPaint");

  const remaining = bodyMesh.listPrimitives();
  let bodyVerts = 0;
  let cabin = 0;
  let grille = 0;
  for (const prim of remaining) {
    bodyVerts += prim.getAttribute("POSITION")?.getCount() ?? 0;
    cabin += countRegion(prim, (_x, y, z) => z < -0.3 && y > 0.8);
    grille += countRegion(prim, (_x, y, z) => z > 1.55 && y > 0.3);
  }
  if (cabin < 200) throw new Error(`cabin missing from BodyPaint: ${cabin}`);
  if (grille < 400) throw new Error(`grille missing from BodyPaint: ${grille}`);

  const wheels = doc
    .getRoot()
    .listNodes()
    .map((n) => n.getName())
    .filter((n) => n?.startsWith("StockWheel_"))
    .sort();
  if (wheels.join() !== "StockWheel_FL,StockWheel_FR,StockWheel_RL,StockWheel_RR") {
    throw new Error(`StockWheel_* missing after engine remount: ${wheels.join(",")}`);
  }

  const engMesh = doc.createMesh("StockEngine");
  engMesh.addPrimitive(enginePrim);
  const scene = doc.getRoot().listScenes()[0];
  if (!scene) throw new Error("scene missing");
  const engNode = doc.createNode("StockEngine");
  engNode.setMesh(engMesh);
  engNode.setTranslation([0, 0, 0]);
  scene.addChild(engNode);

  const swapped = await reclassifyDonnerEngineFaces(doc);
  return {
    already: false,
    engineVerts: engineBounds.verts,
    engineMin: engineBounds.min.map((v) => +v.toFixed(3)),
    engineMax: engineBounds.max.map((v) => +v.toFixed(3)),
    bodyVerts,
    cabin,
    grille,
    wheels,
    ...swapped,
  };
}

async function main() {
  if (!existsSync(srcPath)) throw new Error(`Missing ${srcPath}`);
  const doc = await io.read(srcPath);
  const summary = await promoteDonnerStockEngine(doc);
  await doc.transform(dedup({ textures: false, materials: false }), prune());
  const eng = doc.getRoot().listNodes().find((n) => n.getName() === "StockEngine");
  for (const prim of eng?.getMesh()?.listPrimitives() ?? []) {
    prim.getMaterial()?.setName("StockEngine");
  }
  const bytes = await io.writeBinary(doc);
  writeFileSync(carPath, bytes);
  console.log("donnerbuechse.glb ← StockEngine remount (no punch)", {
    src: srcPath,
    bytes: bytes.byteLength,
    ...summary,
  });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1]);
if (invokedDirectly || process.argv[1]?.endsWith("bake-donnerbuechse-segmented-engine.mjs")) {
  await main();
}

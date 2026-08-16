#!/usr/bin/env node
/**
 * Remount Donnerbüchse's already-disconnected engine prim as `StockEngine`.
 *
 * The wheels bake leaves a second BodyPaint prim (hood bay: scoop, block,
 * headers). This step names that prim `StockEngine` at its original vertex
 * positions — no AABB punch, so cabin / grille / chassis / StockWheel_* stay.
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
    return { already: true, engineVerts: 0, bodyVerts: 0 };
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

  return {
    already: false,
    engineVerts: engineBounds.verts,
    engineMin: engineBounds.min.map((v) => +v.toFixed(3)),
    engineMax: engineBounds.max.map((v) => +v.toFixed(3)),
    bodyVerts,
    cabin,
    grille,
    wheels,
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

#!/usr/bin/env node
/**
 * Undo Donnerbüchse StockEngine remount: weld engine prims back onto BodyPaint
 * (Tripo wheels-bake shape). Exhaust stays for F6 Motor-aus.
 *
 *   npm run cars:unbake-donner-stock-engine
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const carPath = join(rootDir, "public/models/cars/donnerbuechse.glb");

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

export async function unbakeDonnerStockEngine(doc) {
  const engNode = doc.getRoot().listNodes().find((n) => n.getName() === "StockEngine");
  const engMesh = engNode?.getMesh() ?? doc.getRoot().listMeshes().find((m) => m.getName() === "StockEngine");
  if (!engMesh) return { welded: false, prims: 0 };

  const bodyNode = doc.getRoot().listNodes().find((n) => {
    const mesh = n.getMesh();
    return n.getName() === "BodyPaint" || mesh?.getName() === "BodyPaint";
  });
  const bodyMesh = bodyNode?.getMesh();
  if (!bodyMesh) throw new Error("BodyPaint mesh missing");

  const bodyMat =
    bodyMesh.listPrimitives().find((p) => p.getMaterial()?.getName() === "BodyPaint")?.getMaterial() ??
    bodyMesh.listPrimitives()[0]?.getMaterial();

  const prims = [...engMesh.listPrimitives()];
  for (const prim of prims) {
    engMesh.removePrimitive(prim);
    if (bodyMat) prim.setMaterial(bodyMat);
    else prim.getMaterial()?.setName("BodyPaint");
    bodyMesh.addPrimitive(prim);
  }

  if (engNode) {
    engNode.setMesh(null);
    const scene = doc.getRoot().listScenes()[0];
    if (scene?.listChildren().includes(engNode)) scene.removeChild(engNode);
    else engNode.getParentNode()?.removeChild(engNode);
    engNode.dispose();
  }
  if (engMesh.listParents().length === 0) engMesh.dispose();

  return { welded: true, prims: prims.length };
}

async function main() {
  if (!existsSync(carPath)) throw new Error(`Missing ${carPath}`);
  const doc = await io.read(carPath);
  const summary = await unbakeDonnerStockEngine(doc);
  await doc.transform(dedup({ textures: false, materials: false }), prune());
  const left = doc.getRoot().listNodes().find((n) => n.getName() === "StockEngine");
  if (left) throw new Error("StockEngine node still present after unbake");
  const bytes = await io.writeBinary(doc);
  writeFileSync(carPath, bytes);
  console.log("donnerbuechse.glb ← BodyPaint + wheels (engine welded, Tripo result)", {
    bytes: bytes.byteLength,
    ...summary,
  });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1]);
if (invokedDirectly || process.argv[1]?.endsWith("unbake-donner-stock-engine.mjs")) {
  await main();
}

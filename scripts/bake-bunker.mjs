#!/usr/bin/env node
/**
 * Bake Bunker from Sketchfab Hummer HX concept low poly (NoOb StUfFs, CC-BY 4.0).
 * Keeps authored albedo maps where present; names materials for garage toon/paint.
 *
 * Source: public/models/cars/bunker.source.glb (gitignored)
 *   SKETCHFAB_API_TOKEN=… npm run cars:fetch-bunker
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(rootDir, "public/models/cars");
const sourcePath = join(outDir, "bunker.source.glb");
const livePath = join(outDir, "bunker.glb");

function classifyMat(name, factor, hasMap) {
  const n = (name || "").toLowerCase();
  const [r, g, b, a = 1] = factor;
  const lum = r + g + b;
  if (n.includes("window") || a < 0.92) return "Glass";
  if (n.includes("leather") || n.includes("seat")) return "Seat";
  if (n.includes("door") || n.includes("_ok") || hasMap) return "BodyPaint";
  if (r > 0.45 && g < 0.25 && b < 0.25) return "TailLight";
  if (lum < 0.12) return "Tire";
  if (lum < 0.55 && Math.abs(r - g) < 0.05 && Math.abs(g - b) < 0.05) return "Dark";
  if (lum > 2.0) return "Chrome";
  return "BodyPaint";
}

export async function bakeBunkerFromHummerHx() {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing ${sourcePath}. Run: SKETCHFAB_API_TOKEN=… npm run cars:fetch-bunker`);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(sourcePath);

  for (const mat of doc.getRoot().listMaterials()) {
    const hasMap = !!mat.getBaseColorTexture();
    const factor = mat.getBaseColorFactor();
    const kind = classifyMat(mat.getName(), factor, hasMap);
    mat.setName(kind);
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(kind === "Chrome" ? 0.45 : 0.85);
    if (kind === "Glass") {
      mat.setBaseColorFactor([0.12, 0.22, 0.38, 0.82]);
      mat.setAlphaMode("BLEND");
    } else if (kind === "BodyPaint" && hasMap) {
      mat.setBaseColorFactor([1, 1, 1, 1]);
    } else if (kind === "Tire") {
      mat.setBaseColorFactor([0.08, 0.08, 0.09, 1]);
    } else if (kind === "Chrome") {
      mat.setBaseColorFactor([0.86, 0.89, 0.92, 1]);
    } else if (kind === "Seat" || kind === "Dark") {
      mat.setBaseColorFactor([0.12, 0.12, 0.13, 1]);
    } else if (kind === "TailLight") {
      mat.setBaseColorFactor([0.88, 0.12, 0.1, 1]);
    } else if (kind === "BodyPaint") {
      mat.setBaseColorFactor([0.53, 0.56, 0.59, 1]);
    }
  }

  await MeshoptSimplifier.ready;
  await doc.transform(
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.55, error: 0.001 }),
    dedup(),
    prune(),
  );

  const bytes = await io.writeBinary(doc);
  writeFileSync(livePath, bytes);
  console.log(`bunker.glb ← Sketchfab Hummer HX (comic bake, ${bytes.byteLength} bytes)`);
  return bytes.byteLength;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  bakeBunkerFromHummerHx().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

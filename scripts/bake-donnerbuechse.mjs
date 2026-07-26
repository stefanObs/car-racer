#!/usr/bin/env node
/**
 * Bake Donnerbüchse from Sketchfab Hotrod (car-go, CC-BY 4.0).
 * Keeps the authored albedo atlas (Asphalt-Comic toon + map in-engine),
 * simplifies geometry for arcade runtime.
 *
 * Source: public/models/cars/donnerbuechse.source.glb (gitignored)
 *   SKETCHFAB_API_TOKEN=… npm run cars:fetch-donnerbuechse
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
const sourcePath = join(outDir, "donnerbuechse.source.glb");
const livePath = join(outDir, "donnerbuechse.glb");

export async function bakeDonnerbuechseFromSketchfab() {
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Missing ${sourcePath}. Run: SKETCHFAB_API_TOKEN=… npm run cars:fetch-donnerbuechse`,
    );
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(sourcePath);

  // Garage paint tints BodyPaint; atlas map stays for comic detail.
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setName("BodyPaint");
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(0.85);
  }

  await MeshoptSimplifier.ready;
  await doc.transform(
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.08, error: 0.0015 }),
    dedup(),
    prune(),
  );

  const bytes = await io.writeBinary(doc);
  writeFileSync(livePath, bytes);
  console.log(`donnerbuechse.glb ← Sketchfab Hotrod (textured comic bake, ${bytes.byteLength} bytes)`);
  return bytes.byteLength;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  bakeDonnerbuechseFromSketchfab().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

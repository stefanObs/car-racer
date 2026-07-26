#!/usr/bin/env node
/**
 * Download Sketchfab Hummer HX concept low poly
 * (UID 056296664d2c4edba6f90644e22834a4) → bunker.source.glb
 * Requires SKETCHFAB_API_TOKEN (never commit the token).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UID = "056296664d2c4edba6f90644e22834a4";
const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(rootDir, "public/models/cars/bunker.source.glb");

const token = process.env.SKETCHFAB_API_TOKEN;
if (!token) {
  console.error("Set SKETCHFAB_API_TOKEN (Sketchfab → Settings → Password & API).");
  process.exit(1);
}

const metaRes = await fetch(`https://api.sketchfab.com/v3/models/${UID}/download`, {
  headers: { Authorization: `Token ${token}` },
});
if (!metaRes.ok) {
  console.error("Sketchfab download API failed:", metaRes.status, await metaRes.text());
  process.exit(1);
}
const meta = await metaRes.json();
const url = meta.glb?.url;
if (!url) {
  console.error("No GLB URL in Sketchfab response");
  process.exit(1);
}

console.log("Downloading Hummer HX GLB…");
const glbRes = await fetch(url);
if (!glbRes.ok) {
  console.error("GLB download failed:", glbRes.status);
  process.exit(1);
}
const buf = Buffer.from(await glbRes.arrayBuffer());
writeFileSync(outPath, buf);
console.log(`Wrote ${outPath} (${buf.length} bytes)`);

#!/usr/bin/env node
/**
 * Fetch Sketchfab CC-BY props for Käferkraft nose variants.
 * Free3D links (bird-with-wings-above-head / dog-sitting) are Personal Use / blocked —
 * these CC-BY stand-ins match the look for commercial redistrib.
 *
 *   SKETCHFAB_API_TOKEN=… npm run cars:fetch-buggy-noses
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(rootDir, "public/models/props");

/** @type {{ id: string; uid: string; file: string; credit: string }[]} */
const PROPS = [
  {
    id: "bird",
    uid: "474f2cdac04c4a42a5f5aaddd8930577",
    file: "buggy-bird.source.glb",
    credit: "Pigeon – Stylized Animated by AnimalMesh 3D (CC-BY 4.0)",
  },
  {
    id: "dog",
    uid: "fe1ca729b8694482acdb625e006ef2cd",
    file: "buggy-dog.source.glb",
    credit: "Sitting dog cast (Каслинское) by dima051983 (CC-BY 4.0)",
  },
];

const token = process.env.SKETCHFAB_API_TOKEN;
if (!token) {
  console.error("Set SKETCHFAB_API_TOKEN (Sketchfab → Settings → Password & API).");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const prop of PROPS) {
  const metaRes = await fetch(`https://api.sketchfab.com/v3/models/${prop.uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!metaRes.ok) {
    console.error(prop.id, "download API failed:", metaRes.status, await metaRes.text());
    process.exit(1);
  }
  const meta = await metaRes.json();
  const url = meta.glb?.url;
  if (!url) {
    console.error(prop.id, "no GLB URL");
    process.exit(1);
  }
  const glbRes = await fetch(url);
  if (!glbRes.ok) {
    console.error(prop.id, "GLB fetch failed:", glbRes.status);
    process.exit(1);
  }
  const buf = Buffer.from(await glbRes.arrayBuffer());
  const path = join(outDir, prop.file);
  writeFileSync(path, buf);
  console.log(`Wrote ${path} (${buf.length} bytes) — ${prop.credit}`);
}

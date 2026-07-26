#!/usr/bin/env node
/**
 * Polish shipped car GLBs (free assets only).
 * - Bison: Mitsubishi L200 (Poly Pizza / Muhammad Reyhan, CC-BY 3.0) rematerialized.
 * - Donnerbüchse: Sketchfab Hotrod by car-go (CC-BY 4.0) — texture-split comic bake.
 * - Käferkraft: keep GetGLB buggy (`npm run cars:tune-kaeferkraft`)
 *
 * Usage: node scripts/polish-car-glbs.mjs
 * Hotrod source: public/models/cars/donnerbuechse.source.glb (gitignored)
 *   SKETCHFAB_API_TOKEN=… npm run cars:fetch-donnerbuechse
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { bakeDonnerbuechseFromSketchfab } from "./bake-donnerbuechse.mjs";

globalThis.Blob = Blob;
globalThis.self = globalThis;
class FileReaderPolyfill {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer())
      .then((ab) => {
        this.result = ab;
        this.onloadend?.({ target: this });
      })
      .catch((err) => this.onerror?.(err));
  }
}
globalThis.FileReader = FileReaderPolyfill;

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(rootDir, "public/models/cars");
mkdirSync(outDir, { recursive: true });

const BISON_SOURCE_URL = "https://static.poly.pizza/ecae441a-cba8-4dd6-9795-207a72d7e88e.glb";

async function exportGroupGlb(group, filename) {
  const exporter = new GLTFExporter();
  const ab = await new Promise((resolve, reject) => {
    exporter.parse(group, (res) => resolve(res), reject, { binary: true });
  });
  const buf = Buffer.from(ab);
  writeFileSync(join(outDir, filename), buf);
  return buf.length;
}

async function ensureBisonSource(sourcePath) {
  if (existsSync(sourcePath)) return;
  console.log("Downloading L200 pickup…", BISON_SOURCE_URL);
  const res = await fetch(BISON_SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  writeFileSync(sourcePath, Buffer.from(await res.arrayBuffer()));
}

function loadGlb(path) {
  const buf = readFileSync(path);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject);
  });
}

function classifyL200(matName, meshName) {
  const m = (matName || "").toLowerCase();
  const n = (meshName || "").toLowerCase();

  if (/mesh[2-7]/i.test(n)) {
    if (m.includes("lightgray") || m.includes("m06") || m.includes("gainsboro") || m.includes("0132")) {
      return "chrome";
    }
    return "tire";
  }

  if (m.includes("a05")) return "tail";
  if (m.includes("d05") || m.includes("gainsboro") || m.includes("0130")) return "chrome";
  if (m.includes("m08") || m.includes("l05") || m.includes("0132") || m.includes("lightgray") || m.includes("m06")) {
    return "glass";
  }
  if (m.includes("0137") || m.includes("black")) return "chrome";
  if (
    m.includes("charcoal") ||
    m.includes("0136") ||
    m.includes("darkgray") ||
    m.includes("0135") ||
    m.includes("dimgray") ||
    m.includes("0134") ||
    m.includes("m00") ||
    m.includes("frontcolor") ||
    m.includes("snow") ||
    m.includes("m02")
  ) {
    return "body";
  }
  return "body";
}

async function bakeBisonPickup() {
  const source = join(outDir, "bison.source.glb");
  await ensureBisonSource(source);

  const body = new MeshStandardMaterial({ name: "BodyPaint", color: 0x2f9e44, metalness: 0, roughness: 0.85 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xdce2e8, metalness: 0.4, roughness: 0.45 });
  const glass = new MeshStandardMaterial({ name: "Glass", color: 0x2b6cb0, metalness: 0, roughness: 0.35 });
  const tail = new MeshStandardMaterial({ name: "TailLight", color: 0xe03131, metalness: 0, roughness: 0.7 });
  const byKind = { body, tire, chrome, glass, tail };

  const gltf = await loadGlb(source);
  const root = gltf.scene;
  root.name = "bison";

  root.traverse((obj) => {
    const mesh = obj;
    if (!mesh.isMesh) return;
    const meshName = mesh.name || mesh.parent?.name || "";
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => byKind[classifyL200(mat?.name, meshName)] ?? body);
    mesh.material = next.length === 1 ? next[0] : next;
  });

  const bytes = await exportGroupGlb(root, "bison.glb");
  console.log(`bison.glb ← L200 crew-cab rematerialized (${bytes} bytes)`);
}

await bakeBisonPickup();
await bakeDonnerbuechseFromSketchfab();
console.log("ok");

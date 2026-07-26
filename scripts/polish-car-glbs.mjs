#!/usr/bin/env node
/**
 * Polish shipped car GLBs (free assets only — no TurboSquid redistrib).
 * - Bison: Mitsubishi L200 (Poly Pizza / Muhammad Reyhan, CC-BY 3.0) rematerialized.
 *   Modern crew-cab curves; silhouette inspired by TurboSquid 1675577 (ref only).
 * - Käferkraft: keep GetGLB buggy (cars:tune-kaeferkraft)
 * - Donnerbüchse: generated classic hot-rod
 *
 * Usage: node scripts/polish-car-glbs.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

/** Poly Pizza — Mitsubishi L200 by Muhammad Reyhan (CC-BY 3.0). */
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

function addMesh(group, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
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

  // Wheel meshes Mesh2–Mesh7
  if (/mesh[2-7]/i.test(n)) {
    if (m.includes("lightgray") || m.includes("m06") || m.includes("gainsboro") || m.includes("0132")) {
      return "chrome";
    }
    return "tire";
  }

  // Lights
  if (m.includes("a05")) return "tail"; // red
  if (m.includes("d05") || m.includes("gainsboro") || m.includes("0130")) return "chrome";

  // Windows / deep black glass
  if (m.includes("m08") || m.includes("l05") || m.includes("0137") || m.includes("black")) {
    return "glass";
  }

  // L200 body panels are mostly Charcoal / DarkGray / white accents → garage paint
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
    m.includes("m02") ||
    m.includes("m06") ||
    m.includes("0132")
  ) {
    return "body";
  }

  return "body";
}

/** Modern crew-cab L200 — natural panel curves (CC-BY 3.0, credit in SOURCES.md). */
async function bakeBisonPickup() {
  const live = join(outDir, "bison.glb");
  const source = join(outDir, "bison.source.glb");
  await ensureBisonSource(source);

  const body = new MeshStandardMaterial({ name: "BodyPaint", color: 0x2f9e44, metalness: 0, roughness: 0.85 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xdce2e8, metalness: 0.4, roughness: 0.45 });
  const dark = new MeshStandardMaterial({ name: "Dark", color: 0x1b1b1f, metalness: 0, roughness: 0.9 });
  const glass = new MeshStandardMaterial({ name: "Glass", color: 0x10141c, metalness: 0, roughness: 0.35 });
  const tail = new MeshStandardMaterial({ name: "TailLight", color: 0xe03131, metalness: 0, roughness: 0.7 });

  const byKind = { body, tire, chrome, dark, glass, tail };

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

async function generateHotRod() {
  const group = new Group();
  group.name = "donnerbuechse";

  const paint = new MeshStandardMaterial({ name: "BodyPaint", color: 0x339af0, metalness: 0, roughness: 0.85 });
  const shade = new MeshStandardMaterial({ name: "Dark", color: 0x1b1b1f, metalness: 0, roughness: 0.9 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xc8ccd4, metalness: 0.4, roughness: 0.45 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const glassMat = new MeshStandardMaterial({ name: "Glass", color: 0x10141c, metalness: 0, roughness: 0.4 });
  const rim = new MeshStandardMaterial({ name: "Chrome", color: 0xe9ecef, metalness: 0.35, roughness: 0.5 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) =>
    addMesh(group, geo, mat, x, y, z, rx, ry, rz);

  add(new BoxGeometry(1.55, 0.32, 3.35), paint, 0, 0.42, 0.05);
  add(new BoxGeometry(1.4, 0.16, 3.1), shade, 0, 0.24, 0.05);
  add(new BoxGeometry(1.35, 0.2, 1.65), paint, 0, 0.62, 0.95);
  add(new BoxGeometry(1.35, 0.58, 0.95), paint, 0, 0.88, -0.95);
  add(new BoxGeometry(1.15, 0.08, 0.8), shade, 0, 1.2, -0.95);
  add(new BoxGeometry(1.1, 0.42, 0.08), glassMat, 0, 1.0, -0.45);
  add(new BoxGeometry(1.3, 0.28, 0.55), paint, 0, 0.62, -1.6);
  add(new BoxGeometry(0.85, 0.55, 0.95), chrome, 0, 0.95, 0.35);
  for (const z of [-0.2, 0, 0.2]) {
    add(new CylinderGeometry(0.09, 0.11, 0.5, 10), chrome, 0, 1.4, 0.35 + z);
    add(new TorusGeometry(0.11, 0.025, 6, 12), chrome, 0, 1.65, 0.35 + z, Math.PI / 2, 0, 0);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      add(
        new CylinderGeometry(0.05, 0.06, 0.75, 8),
        chrome,
        side * 0.78,
        0.55 - i * 0.04,
        0.1 - i * 0.1,
        0,
        0,
        side * 0.95,
      );
    }
  }
  add(new SphereGeometry(0.12, 10, 8), chrome, -0.45, 0.55, 1.75);
  add(new SphereGeometry(0.12, 10, 8), chrome, 0.45, 0.55, 1.75);
  add(new BoxGeometry(0.9, 0.12, 0.08), paint, 0, 0.55, -1.88);

  const wheel = (x, z, r, w) => {
    add(new CylinderGeometry(r, r, w, 18), tire, x, r, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.62, r * 0.62, w * 1.08, 12), rim, x, r, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.22, r * 0.22, w * 1.12, 8), chrome, x, r, z, 0, 0, Math.PI / 2);
  };
  wheel(-0.78, 1.15, 0.28, 0.28);
  wheel(0.78, 1.15, 0.28, 0.28);
  wheel(-0.82, -1.15, 0.48, 0.42);
  wheel(0.82, -1.15, 0.48, 0.42);

  const bytes = await exportGroupGlb(group, "donnerbuechse.glb");
  console.log(`donnerbuechse.glb ← generated hot rod (${bytes} bytes)`);
}

await bakeBisonPickup();
await generateHotRod();
console.log("ok");

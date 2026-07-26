#!/usr/bin/env node
/**
 * Polish shipped car GLBs (free assets only — no TurboSquid/CGTrader Editorial redistrib).
 * - Bison: Mitsubishi L200 (Poly Pizza / Muhammad Reyhan, CC-BY 3.0) rematerialized.
 * - Käferkraft: keep GetGLB buggy (cars:tune-kaeferkraft)
 * - Donnerbüchse: generated RatRod silhouette (CGTrader #481449 as visual ref only —
 *   that listing is Editorial License and cannot ship in-game).
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
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
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

function rbox(w, h, d, radius = 0.08, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(radius, w / 2.2, h / 2.2, d / 2.2));
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
  // Cabin greenhouse: dark inserts (M08/L05) + upper cabin panes (LightGray/M06 on body mesh).
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
  const live = join(outDir, "bison.glb");
  const source = join(outDir, "bison.source.glb");
  await ensureBisonSource(source);

  const body = new MeshStandardMaterial({ name: "BodyPaint", color: 0x2f9e44, metalness: 0, roughness: 0.85 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xdce2e8, metalness: 0.4, roughness: 0.45 });
  // Comic blue greenhouse (windshield + cabin glass) — flat readable tint.
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

/**
 * RatRod hot rod — chopped coupe, exposed blower engine, side pipes, fat rears.
 * Silhouette inspired by CGTrader free RatRod #481449 (Editorial — not shipped).
 */
async function generateHotRod() {
  const group = new Group();
  group.name = "donnerbuechse";

  const paint = new MeshStandardMaterial({ name: "BodyPaint", color: 0x339af0, metalness: 0, roughness: 0.85 });
  const shade = new MeshStandardMaterial({ name: "Dark", color: 0x1b1b1f, metalness: 0, roughness: 0.9 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xdce2e8, metalness: 0.45, roughness: 0.4 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const glass = new MeshStandardMaterial({ name: "Glass", color: 0x10141c, metalness: 0, roughness: 0.35 });
  const rim = new MeshStandardMaterial({ name: "Chrome", color: 0xe9ecef, metalness: 0.35, roughness: 0.5 });
  const valve = new MeshStandardMaterial({ name: "Chrome", color: 0xe03131, metalness: 0.2, roughness: 0.6 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) =>
    addMesh(group, geo, mat, x, y, z, rx, ry, rz);

  // Low slammed chassis (rat-rod: no full fenders)
  add(rbox(1.55, 0.28, 3.15, 0.1), paint, 0, 0.38, 0.05);
  add(rbox(1.4, 0.16, 2.95, 0.07), shade, 0, 0.22, 0.05);

  // Long open nose deck (hood omitted — engine sits on top)
  add(rbox(1.35, 0.14, 1.35, 0.08), paint, 0, 0.58, 1.05);

  // Chopped cabin — short / low greenhouse behind blower
  add(rbox(1.45, 0.72, 1.15, 0.12), paint, 0, 0.92, -0.75);
  add(rbox(1.25, 0.1, 0.95, 0.05), shade, 0, 1.32, -0.78);
  add(rbox(1.25, 0.48, 0.08, 0.04), glass, 0, 1.05, -0.18, -0.32, 0, 0);
  add(rbox(0.06, 0.4, 0.85, 0.03), glass, 0.74, 1.0, -0.75);
  add(rbox(0.06, 0.4, 0.85, 0.03), glass, -0.74, 1.0, -0.75);
  add(rbox(1.4, 0.32, 0.55, 0.1), paint, 0, 0.62, -1.5);

  // Exposed V8 + triple blower (CGTrader RatRod cue)
  add(rbox(0.9, 0.65, 1.05, 0.1), chrome, 0, 0.95, 0.5);
  for (const sx of [-0.38, 0.38]) {
    add(rbox(0.2, 0.22, 0.9, 0.05), valve, sx, 1.12, 0.5);
  }
  for (const z of [-0.22, 0, 0.22]) {
    add(new CylinderGeometry(0.1, 0.12, 0.55, 12), chrome, 0, 1.5, 0.5 + z);
    add(new TorusGeometry(0.12, 0.028, 6, 14), chrome, 0, 1.78, 0.5 + z, Math.PI / 2, 0, 0);
  }

  // Vertical grille + round lamps
  add(rbox(0.55, 0.7, 0.12, 0.04), chrome, 0, 0.7, 1.85);
  for (const y of [0.5, 0.65, 0.8, 0.95]) {
    add(new BoxGeometry(0.42, 0.04, 0.04), shade, 0, y, 1.92);
  }
  add(new SphereGeometry(0.14, 12, 10), chrome, -0.55, 0.62, 1.78);
  add(new SphereGeometry(0.14, 12, 10), chrome, 0.55, 0.62, 1.78);
  add(new SphereGeometry(0.09, 10, 8), glass, -0.55, 0.62, 1.88);
  add(new SphereGeometry(0.09, 10, 8), glass, 0.55, 0.62, 1.88);

  // Triple side-exit exhausts
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      add(
        new CylinderGeometry(0.055, 0.065, 0.9, 10),
        chrome,
        side * 0.72,
        0.7 - i * 0.05,
        0.2 - i * 0.12,
        0.12,
        0,
        side * (0.9 + i * 0.06),
      );
      add(
        new CylinderGeometry(0.075, 0.065, 0.12, 10),
        chrome,
        side * 1.08,
        0.42 - i * 0.08,
        -0.12 - i * 0.1,
        0,
        0,
        side * 0.95,
      );
    }
  }

  add(rbox(0.85, 0.12, 0.08, 0.03), paint, 0, 0.55, -1.82);

  // Skinny fronts / fat rears (rat-rod stance)
  const wheel = (x, z, r, w) => {
    add(new CylinderGeometry(r, r, w, 20), tire, x, r + 0.02, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.55, r * 0.55, w * 1.08, 14), rim, x, r + 0.02, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.2, r * 0.2, w * 1.14, 10), chrome, x, r + 0.02, z, 0, 0, Math.PI / 2);
  };
  wheel(-0.78, 1.2, 0.3, 0.26);
  wheel(0.78, 1.2, 0.3, 0.26);
  wheel(-0.85, -1.15, 0.55, 0.48);
  wheel(0.85, -1.15, 0.55, 0.48);

  const bytes = await exportGroupGlb(group, "donnerbuechse.glb");
  console.log(`donnerbuechse.glb ← RatRod silhouette bake (${bytes} bytes)`);
}

await bakeBisonPickup();
await generateHotRod();
console.log("ok");

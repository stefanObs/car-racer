#!/usr/bin/env node
/**
 * Polish shipped car GLBs (free assets only — no TurboSquid).
 * - Bison: generated crew-cab pickup (TurboSquid pickup ref only)
 * - Käferkraft: generated dune-hunter / sand-rail buggy
 * - Donnerbüchse: generated classic hot-rod
 *
 * Usage: node scripts/polish-car-glbs.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
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

// three.js GLTFExporter expects browser Blob/FileReader
globalThis.Blob = Blob;
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/models/cars");
mkdirSync(outDir, { recursive: true });

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

/** Crew-cab pickup (TurboSquid pick-up-car-1095115 as visual ref only). */
async function generatePickup() {
  const group = new Group();
  group.name = "bison";

  const paint = new MeshStandardMaterial({ name: "BodyPaint", color: 0x2f9e44, metalness: 0, roughness: 0.85 });
  const shade = new MeshStandardMaterial({ name: "Dark", color: 0x1b1b1f, metalness: 0, roughness: 0.9 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xc8ccd4, metalness: 0.35, roughness: 0.5 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const rim = new MeshStandardMaterial({ name: "Chrome", color: 0xe9ecef, metalness: 0.3, roughness: 0.55 });
  const glass = new MeshStandardMaterial({ name: "Glass", color: 0x10141c, metalness: 0, roughness: 0.4 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) =>
    addMesh(group, geo, mat, x, y, z, rx, ry, rz);

  // High chassis + belly
  add(new BoxGeometry(1.95, 0.38, 3.25), paint, 0, 0.55, 0);
  add(new BoxGeometry(1.85, 0.2, 3.05), shade, 0, 0.32, 0);

  // Crew cab (upright greenhouse)
  add(new BoxGeometry(1.9, 1.0, 1.55), paint, 0, 1.22, 0.55);
  add(new BoxGeometry(1.65, 0.62, 0.1), glass, 0, 1.38, 1.3);
  add(new BoxGeometry(1.75, 0.1, 1.4), shade, 0, 1.78, 0.5);
  // Side glass strips
  add(new BoxGeometry(0.06, 0.42, 1.15), glass, 0.98, 1.38, 0.55);
  add(new BoxGeometry(0.06, 0.42, 1.15), glass, -0.98, 1.38, 0.55);
  // B-pillars
  for (const z of [0.95, 0.25]) {
    add(new BoxGeometry(0.08, 0.68, 0.08), shade, 0.95, 1.38, z);
    add(new BoxGeometry(0.08, 0.68, 0.08), shade, -0.95, 1.38, z);
  }

  // Hood + scoop
  add(new BoxGeometry(1.75, 0.26, 0.95), paint, 0, 0.92, 1.55);
  add(new BoxGeometry(0.62, 0.18, 0.65), shade, 0, 1.12, 1.45);

  // Open bed + rails + tailgate
  add(new BoxGeometry(1.75, 0.12, 1.35), shade, 0, 0.82, -1.2);
  add(new BoxGeometry(0.12, 0.52, 1.3), shade, -0.88, 1.12, -1.2);
  add(new BoxGeometry(0.12, 0.52, 1.3), shade, 0.88, 1.12, -1.2);
  add(new BoxGeometry(1.75, 0.48, 0.12), paint, 0, 1.08, -1.85);

  // Bull / brush bar
  add(new BoxGeometry(1.85, 0.52, 0.12), shade, 0, 0.7, 2.05);
  for (const y of [0.55, 0.75, 0.95]) {
    add(new CylinderGeometry(0.035, 0.035, 1.7, 8), shade, 0, y, 2.12, 0, 0, Math.PI / 2);
  }
  for (const x of [-0.75, 0, 0.75]) {
    add(new CylinderGeometry(0.04, 0.04, 0.52, 8), shade, x, 0.7, 2.12);
  }

  // Side steps + mirrors
  for (const sx of [-1.0, 1.0]) {
    add(new BoxGeometry(0.2, 0.08, 1.35), shade, sx, 0.35, 0.4);
    add(new BoxGeometry(0.12, 0.1, 0.22), shade, sx * 1.05, 1.35, 1.15);
  }

  // Lights
  add(new SphereGeometry(0.13, 10, 8), chrome, -0.7, 0.72, 2.0);
  add(new SphereGeometry(0.13, 10, 8), chrome, 0.7, 0.72, 2.0);
  add(new BoxGeometry(1.4, 0.14, 0.08), paint, 0, 1.05, -1.92);

  // Dual exhaust tips
  add(new CylinderGeometry(0.06, 0.07, 0.25, 8), chrome, -0.35, 0.35, -2.0, Math.PI / 2);
  add(new CylinderGeometry(0.06, 0.07, 0.25, 8), chrome, 0.35, 0.35, -2.0, Math.PI / 2);

  // Fat off-road wheels
  const wheel = (x, z, r, w) => {
    add(new CylinderGeometry(r, r, w, 18), tire, x, r, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.58, r * 0.58, w * 1.08, 12), rim, x, r, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.2, r * 0.2, w * 1.14, 8), chrome, x, r, z, 0, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(new BoxGeometry(w * 0.32, 0.07, 0.09), tire, x, r + Math.sin(a) * r * 0.9, z + Math.cos(a) * r * 0.9);
    }
  };
  wheel(-1.0, 1.15, 0.52, 0.4);
  wheel(1.0, 1.15, 0.52, 0.4);
  wheel(-1.02, -1.2, 0.55, 0.42);
  wheel(1.02, -1.2, 0.55, 0.42);

  const bytes = await exportGroupGlb(group, "bison.glb");
  console.log(`bison.glb ← generated pickup (${bytes} bytes)`);
}

/** Dune-hunter / sand-rail silhouette (TurboSquid 2179513 as visual ref only). */
async function generateDuneBuggy() {
  const group = new Group();
  group.name = "kaeferkraft";

  const paint = new MeshStandardMaterial({ name: "BodyPaint", color: 0x12b886, metalness: 0, roughness: 0.85 });
  const shade = new MeshStandardMaterial({ name: "Dark", color: 0x1b1b1f, metalness: 0, roughness: 0.9 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xc8ccd4, metalness: 0.35, roughness: 0.5 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x141414, metalness: 0, roughness: 0.95 });
  const rim = new MeshStandardMaterial({ name: "Chrome", color: 0xe9ecef, metalness: 0.3, roughness: 0.55 });
  const spring = new MeshStandardMaterial({ name: "Chrome", color: 0xffe066, metalness: 0.15, roughness: 0.7 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) =>
    addMesh(group, geo, mat, x, y, z, rx, ry, rz);

  add(new BoxGeometry(1.15, 0.14, 2.05), shade, 0, 0.42, 0.05);
  add(new BoxGeometry(1.05, 0.1, 1.85), shade, 0, 0.32, 0.05);
  add(new BoxGeometry(1.05, 0.42, 0.65), paint, 0, 0.68, 1.15);
  add(new BoxGeometry(0.12, 0.48, 1.35), paint, -0.62, 0.72, 0.15);
  add(new BoxGeometry(0.12, 0.48, 1.35), paint, 0.62, 0.72, 0.15);
  add(new BoxGeometry(1.1, 0.38, 0.4), paint, 0, 0.68, -0.95);

  for (const sx of [-0.28, 0.28]) {
    add(new BoxGeometry(0.38, 0.38, 0.42), shade, sx, 0.72, 0.2);
    add(new BoxGeometry(0.38, 0.5, 0.12), shade, sx, 1.05, -0.02);
  }

  const tube = (r, h, x, y, z, rx = 0, rz = 0) =>
    add(new CylinderGeometry(r, r, h, 10), shade, x, y, z, rx, 0, rz);
  tube(0.055, 1.35, -0.52, 1.25, -0.15);
  tube(0.055, 1.35, 0.52, 1.25, -0.15);
  tube(0.05, 1.15, 0, 1.9, -0.15, 0, Math.PI / 2);
  tube(0.048, 1.25, -0.48, 1.2, 0.55, 0.7, 0);
  tube(0.048, 1.25, 0.48, 1.2, 0.55, 0.7, 0);
  tube(0.045, 0.95, 0, 1.6, 0.75, 0, Math.PI / 2);
  tube(0.05, 1.05, -0.42, 1.15, -0.85, -0.4, 0);
  tube(0.05, 1.05, 0.42, 1.15, -0.85, -0.4, 0);
  tube(0.045, 0.9, 0, 1.55, -0.9, 0, Math.PI / 2);
  tube(0.04, 1.05, 0, 1.05, -0.15, 0, Math.PI / 2);
  tube(0.038, 0.85, 0, 1.45, 0.2, 0, Math.PI / 2);

  add(new BoxGeometry(0.72, 0.48, 0.55), shade, 0, 0.78, -1.25);
  add(new CylinderGeometry(0.13, 0.16, 0.38, 12), chrome, 0, 1.18, -1.25);
  add(new TorusGeometry(0.16, 0.03, 6, 14), chrome, 0, 1.38, -1.25, Math.PI / 2);

  for (const [wx, wz] of [
    [-0.72, 0.95],
    [0.72, 0.95],
    [-0.75, -0.9],
    [0.75, -0.9],
  ]) {
    add(new CylinderGeometry(0.07, 0.07, 0.45, 8), spring, wx, 0.58, wz);
    add(new TorusGeometry(0.09, 0.025, 6, 10), spring, wx, 0.48, wz, Math.PI / 2);
    add(new TorusGeometry(0.09, 0.025, 6, 10), spring, wx, 0.68, wz, Math.PI / 2);
  }

  add(new SphereGeometry(0.14, 12, 10), chrome, -0.38, 0.72, 1.48);
  add(new SphereGeometry(0.14, 12, 10), chrome, 0.38, 0.72, 1.48);

  const wheel = (x, z, r, w) => {
    add(new CylinderGeometry(r, r, w, 18), tire, x, r + 0.02, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.58, r * 0.58, w * 1.08, 12), rim, x, r + 0.02, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.2, r * 0.2, w * 1.15, 8), chrome, x, r + 0.02, z, 0, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(new BoxGeometry(w * 0.35, 0.08, 0.1), tire, x, r + 0.02 + Math.sin(a) * r * 0.92, z + Math.cos(a) * r * 0.92);
    }
  };
  wheel(-0.88, 1.05, 0.5, 0.38);
  wheel(0.88, 1.05, 0.5, 0.38);
  wheel(-0.92, -1.0, 0.55, 0.42);
  wheel(0.92, -1.0, 0.55, 0.42);

  const bytes = await exportGroupGlb(group, "kaeferkraft.glb");
  console.log(`kaeferkraft.glb ← generated dune buggy (${bytes} bytes)`);
}

async function generateHotRod() {
  const group = new Group();
  group.name = "donnerbuechse";

  const paint = new MeshStandardMaterial({ name: "BodyPaint", color: 0x339af0, metalness: 0, roughness: 0.85 });
  const shade = new MeshStandardMaterial({ name: "Dark", color: 0x1b1b1f, metalness: 0, roughness: 0.9 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xc8ccd4, metalness: 0.4, roughness: 0.45 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const glass = new MeshStandardMaterial({ name: "Glass", color: 0x10141c, metalness: 0, roughness: 0.4 });
  const rim = new MeshStandardMaterial({ name: "Chrome", color: 0xe9ecef, metalness: 0.35, roughness: 0.5 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) =>
    addMesh(group, geo, mat, x, y, z, rx, ry, rz);

  add(new BoxGeometry(1.55, 0.32, 3.35), paint, 0, 0.42, 0.05);
  add(new BoxGeometry(1.4, 0.16, 3.1), shade, 0, 0.24, 0.05);
  add(new BoxGeometry(1.35, 0.2, 1.65), paint, 0, 0.62, 0.95);
  add(new BoxGeometry(1.35, 0.58, 0.95), paint, 0, 0.88, -0.95);
  add(new BoxGeometry(1.15, 0.08, 0.8), shade, 0, 1.2, -0.95);
  add(new BoxGeometry(1.1, 0.42, 0.08), glass, 0, 1.0, -0.45);
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

await generatePickup();
await generateDuneBuggy();
await generateHotRod();
console.log("ok");

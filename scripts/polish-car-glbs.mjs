#!/usr/bin/env node
/**
 * Polish shipped car GLBs (free assets only — no TurboSquid).
 * - Bison: generated lifted crew-cab pickup (TurboSquid 1675577 ref only)
 * - Käferkraft: keep GetGLB buggy (do not overwrite — nicer silhouette)
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

/** Modern lifted crew-cab pickup (TurboSquid 1675577 as visual ref only). */
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

  // Lifted chassis rail (reads as truck, not sedan)
  add(new BoxGeometry(1.85, 0.28, 3.55), paint, 0, 0.62, -0.05);
  add(new BoxGeometry(1.7, 0.18, 3.35), shade, 0, 0.42, -0.05);

  // Long hood deck (generic modern pickup nose)
  add(new BoxGeometry(1.7, 0.32, 1.15), paint, 0, 0.95, 1.45);
  add(new BoxGeometry(1.55, 0.12, 0.95), paint, 0, 1.15, 1.4);
  // Soft grille block + bumper
  add(new BoxGeometry(1.55, 0.45, 0.18), shade, 0, 0.75, 2.05);
  for (const y of [0.62, 0.78, 0.94]) {
    add(new BoxGeometry(1.35, 0.04, 0.06), chrome, 0, y, 2.15);
  }
  add(new BoxGeometry(1.75, 0.16, 0.22), shade, 0, 0.48, 2.05);

  // Black brush / bull bar (category target)
  add(new BoxGeometry(1.7, 0.08, 0.08), shade, 0, 0.95, 2.22);
  add(new BoxGeometry(1.7, 0.08, 0.08), shade, 0, 0.55, 2.22);
  for (const x of [-0.78, -0.26, 0.26, 0.78]) {
    add(new CylinderGeometry(0.035, 0.035, 0.48, 8), shade, x, 0.75, 2.22);
  }

  // Crew cab — upright greenhouse, set behind hood
  add(new BoxGeometry(1.85, 1.05, 1.45), paint, 0, 1.35, 0.35);
  add(new BoxGeometry(1.55, 0.55, 0.08), glass, 0, 1.5, 1.05);
  add(new BoxGeometry(1.7, 0.1, 1.3), shade, 0, 1.92, 0.32);
  add(new BoxGeometry(0.05, 0.42, 1.05), glass, 0.95, 1.48, 0.35);
  add(new BoxGeometry(0.05, 0.42, 1.05), glass, -0.95, 1.48, 0.35);
  // Door / B-pillar lines
  for (const z of [0.75, 0.05]) {
    add(new BoxGeometry(0.07, 0.7, 0.07), shade, 0.94, 1.4, z);
    add(new BoxGeometry(0.07, 0.7, 0.07), shade, -0.94, 1.4, z);
  }

  // Open cargo bed (separate from cab — pickup cue)
  add(new BoxGeometry(1.75, 0.1, 1.55), shade, 0, 0.88, -1.35);
  add(new BoxGeometry(0.1, 0.55, 1.5), shade, -0.9, 1.15, -1.35);
  add(new BoxGeometry(0.1, 0.55, 1.5), shade, 0.9, 1.15, -1.35);
  add(new BoxGeometry(1.75, 0.55, 0.1), paint, 0, 1.15, -2.1);
  // Cab rear wall
  add(new BoxGeometry(1.8, 0.95, 0.1), paint, 0, 1.3, -0.4);

  // Black fender flares (category target)
  for (const [x, z] of [
    [-1.05, 1.15],
    [1.05, 1.15],
    [-1.08, -1.25],
    [1.08, -1.25],
  ]) {
    add(new BoxGeometry(0.35, 0.55, 0.85), shade, x, 0.75, z);
  }

  // Side steps + mirrors
  for (const sx of [-1.05, 1.05]) {
    add(new BoxGeometry(0.18, 0.07, 1.5), shade, sx, 0.4, 0.2);
    add(new BoxGeometry(0.14, 0.1, 0.25), shade, sx * 1.02, 1.45, 0.95);
  }

  // Lights
  add(new BoxGeometry(0.28, 0.14, 0.08), chrome, -0.55, 0.85, 2.12);
  add(new BoxGeometry(0.28, 0.14, 0.08), chrome, 0.55, 0.85, 2.12);
  add(new BoxGeometry(0.35, 0.16, 0.08), paint, -0.55, 1.2, -2.16);
  add(new BoxGeometry(0.35, 0.16, 0.08), paint, 0.55, 1.2, -2.16);

  // Fat off-road wheels with rims
  const wheel = (x, z, r, w) => {
    add(new CylinderGeometry(r, r, w, 18), tire, x, r + 0.05, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.58, r * 0.58, w * 1.1, 12), rim, x, r + 0.05, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.22, r * 0.22, w * 1.16, 8), chrome, x, r + 0.05, z, 0, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(
        new BoxGeometry(w * 0.3, 0.07, 0.09),
        tire,
        x,
        r + 0.05 + Math.sin(a) * r * 0.9,
        z + Math.cos(a) * r * 0.9,
      );
    }
  };
  wheel(-1.05, 1.2, 0.55, 0.42);
  wheel(1.05, 1.2, 0.55, 0.42);
  wheel(-1.08, -1.3, 0.58, 0.45);
  wheel(1.08, -1.3, 0.58, 0.45);

  const bytes = await exportGroupGlb(group, "bison.glb");
  console.log(`bison.glb ← generated pickup (${bytes} bytes)`);
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
await generateHotRod();
console.log("ok");

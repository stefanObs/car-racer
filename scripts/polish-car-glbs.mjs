#!/usr/bin/env node
/**
 * Polish shipped car GLBs (free assets only — no TurboSquid/CGTrader Editorial redistrib).
 * - Bison: Mitsubishi L200 (Poly Pizza / Muhammad Reyhan, CC-BY 3.0) rematerialized.
 * - Käferkraft: keep GetGLB buggy (cars:tune-kaeferkraft)
 * - Donnerbüchse: generated curved hot-rod bake (CGTrader #481449 visual ref only —
 *   Editorial License — mesh not shipped).
 *
 * Usage: node scripts/polish-car-glbs.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";
import {
  BoxGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  LatheGeometry,
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

function rbox(w, h, d, radius = 0.08, seg = 5) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(radius, w / 2.2, h / 2.2, d / 2.2));
}

function exhaustTube(points, radius = 0.055) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  return new TubeGeometry(curve, 16, radius, 8, false);
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
  const live = join(outDir, "bison.glb");
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

/** Teardrop fender volume (lathed profile) — classic hot-rod haunches. */
function teardropFenderGeo(scaleY = 1, scaleZ = 1) {
  const pts = [
    new Vector2(0.02, -0.55),
    new Vector2(0.28, -0.48),
    new Vector2(0.42, -0.22),
    new Vector2(0.45, 0.05),
    new Vector2(0.38, 0.32),
    new Vector2(0.22, 0.48),
    new Vector2(0.06, 0.55),
  ].map((p) => new Vector2(p.x * scaleY, p.y * scaleZ));
  return new LatheGeometry(pts, 20);
}

/**
 * Classic hot rod — capsule/lathe curves, cycle + teardrop fenders,
 * readable exposed V8 (dark block, red valve covers, blower, tube headers).
 * Material names matter: Chrome forces silver in-engine; Engine/ValveCover keep color.
 */
async function generateHotRod() {
  const group = new Group();
  group.name = "donnerbuechse";

  const paint = new MeshStandardMaterial({ name: "BodyPaint", color: 0x339af0, metalness: 0, roughness: 0.85 });
  const shade = new MeshStandardMaterial({ name: "Dark", color: 0x1b1b1f, metalness: 0, roughness: 0.9 });
  const chrome = new MeshStandardMaterial({ name: "Chrome", color: 0xdce2e8, metalness: 0.45, roughness: 0.4 });
  const tire = new MeshStandardMaterial({ name: "Tire", color: 0x1a1a1a, metalness: 0, roughness: 0.95 });
  const glass = new MeshStandardMaterial({ name: "Glass", color: 0x1c3d66, metalness: 0, roughness: 0.35 });
  const rim = new MeshStandardMaterial({ name: "Chrome", color: 0xe9ecef, metalness: 0.35, roughness: 0.5 });
  // "Engine*" keeps authored color in loadCarGltf and skips garage paint remap.
  const engine = new MeshStandardMaterial({ name: "EngineBlock", color: 0x3a3a42, metalness: 0.2, roughness: 0.75 });
  const valve = new MeshStandardMaterial({ name: "EngineValve", color: 0xc92a2a, metalness: 0.15, roughness: 0.55 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = addMesh(group, geo, mat, x, y, z, rx, ry, rz);
    if (sx !== 1 || sy !== 1 || sz !== 1) m.scale.set(sx, sy, sz);
    return m;
  };

  // —— Soft body (restrained curves — not balloon capsules)
  add(rbox(1.48, 0.3, 3.35, 0.14, 6), paint, 0, 0.4, 0.05);
  add(rbox(1.32, 0.14, 3.1, 0.08, 5), shade, 0, 0.22, 0.05);

  // Long hood with gentle nose taper + rounded tip
  add(rbox(1.28, 0.18, 1.45, 0.12, 6), paint, 0, 0.58, 1.05);
  add(rbox(1.05, 0.16, 0.7, 0.11, 5), paint, 0, 0.56, 1.7);
  add(new SphereGeometry(0.32, 14, 12), paint, 0, 0.52, 2.12, 0, 0, 0, 1.45, 0.7, 0.85);

  // Chopped cabin + glass + soft boat-tail
  add(rbox(1.35, 0.58, 1.05, 0.16, 6), paint, 0, 0.95, -0.72);
  add(rbox(1.15, 0.1, 0.88, 0.06, 4), shade, 0, 1.28, -0.75);
  add(rbox(1.15, 0.4, 0.08, 0.05, 4), glass, 0, 1.05, -0.15, -0.3, 0, 0);
  add(rbox(0.07, 0.34, 0.75, 0.03, 3), glass, 0.7, 0.98, -0.72);
  add(rbox(0.07, 0.34, 0.75, 0.03, 3), glass, -0.7, 0.98, -0.72);
  add(rbox(1.28, 0.32, 0.58, 0.12, 5), paint, 0, 0.62, -1.52);
  add(new SphereGeometry(0.38, 12, 10), paint, 0, 0.58, -1.72, 0, 0, 0, 1.4, 0.55, 0.7);
  add(rbox(0.5, 0.38, 0.42, 0.06, 4), shade, 0, 0.82, -0.55);

  // Cycle fenders (front) + teardrop haunches (rear)
  for (const side of [-1, 1]) {
    const front = add(new TorusGeometry(0.32, 0.075, 10, 22, Math.PI * 1.1), paint, side * 0.68, 0.38, 1.28);
    front.rotation.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI / 2);
    const rear = add(teardropFenderGeo(0.95, 1.05), paint, side * 0.82, 0.48, -1.12);
    rear.rotation.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    rear.scale.set(0.85, 0.78, 0.95);
  }

  // —— Exposed V8 (must read as a motor in toon/chrome remap)
  add(rbox(0.78, 0.2, 0.95, 0.05, 4), shade, 0, 0.68, 0.42); // oil pan
  add(rbox(0.9, 0.48, 1.05, 0.07, 5), engine, 0, 0.98, 0.42); // iron block
  add(rbox(0.55, 0.12, 0.95, 0.04, 4), shade, 0, 1.18, 0.42); // valley
  for (const side of [-1, 1]) {
    add(rbox(0.28, 0.26, 0.98, 0.06, 4), valve, side * 0.4, 1.22, 0.42, 0, 0, side * 0.42);
    for (let i = 0; i < 4; i++) {
      add(new CylinderGeometry(0.028, 0.028, 0.05, 8), chrome, side * 0.4, 1.38, 0.12 + i * 0.18);
    }
  }
  // Blower / roots supercharger
  add(rbox(0.34, 0.2, 0.7, 0.04, 4), engine, 0, 1.38, 0.42);
  add(rbox(0.28, 0.08, 0.55, 0.03, 3), chrome, 0, 1.5, 0.42);
  for (const z of [-0.2, 0, 0.2]) {
    add(new CylinderGeometry(0.09, 0.11, 0.32, 14), chrome, 0, 1.72, 0.42 + z);
    add(new ConeGeometry(0.13, 0.1, 14), chrome, 0, 1.92, 0.42 + z);
    add(new TorusGeometry(0.11, 0.022, 8, 16), shade, 0, 1.88, 0.42 + z, Math.PI / 2, 0, 0);
  }
  // Front pulley + belt + distributor
  add(new CylinderGeometry(0.14, 0.14, 0.08, 16), chrome, 0, 0.95, 1.0, 0, 0, Math.PI / 2);
  add(new TorusGeometry(0.16, 0.022, 8, 18), shade, 0, 0.95, 1.0, 0, 0, Math.PI / 2);
  add(new CylinderGeometry(0.055, 0.065, 0.14, 10), shade, 0.14, 1.4, 0.72);
  add(new SphereGeometry(0.05, 8, 6), chrome, 0.14, 1.5, 0.72);

  // Tube headers → side pipes
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z0 = 0.18 - i * 0.14;
      add(
        exhaustTube(
          [
            [side * 0.48, 1.05, z0],
            [side * 0.72, 0.85, z0 - 0.02],
            [side * 0.95, 0.55, -0.05 - i * 0.08],
            [side * 1.12, 0.38, -0.28 - i * 0.09],
          ],
          0.04,
        ),
        chrome,
        0,
        0,
        0,
      );
      add(new CylinderGeometry(0.06, 0.045, 0.14, 12), chrome, side * 1.14, 0.36, -0.35 - i * 0.09, 0, 0, side * 1.05);
    }
  }

  // Grille + bug-eye lights + rear bar
  add(rbox(0.52, 0.62, 0.1, 0.05, 4), chrome, 0, 0.62, 2.28);
  for (const y of [0.42, 0.52, 0.62, 0.72, 0.82]) {
    add(new BoxGeometry(0.4, 0.028, 0.03), shade, 0, y, 2.34);
  }
  for (const sx of [-1, 1]) {
    add(new SphereGeometry(0.14, 12, 10), chrome, sx * 0.58, 0.58, 2.12);
    add(new SphereGeometry(0.085, 10, 8), glass, sx * 0.58, 0.58, 2.22);
  }
  add(rbox(0.9, 0.12, 0.1, 0.04, 4), paint, 0, 0.48, -1.95);

  const wheel = (x, z, r, w) => {
    add(new CylinderGeometry(r, r, w, 22), tire, x, r + 0.02, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.55, r * 0.55, w * 1.08, 14), rim, x, r + 0.02, z, 0, 0, Math.PI / 2);
    add(new CylinderGeometry(r * 0.18, r * 0.18, w * 1.12, 10), chrome, x, r + 0.02, z, 0, 0, Math.PI / 2);
  };
  wheel(-0.78, 1.28, 0.3, 0.26);
  wheel(0.78, 1.28, 0.3, 0.26);
  wheel(-0.92, -1.18, 0.56, 0.52);
  wheel(0.92, -1.18, 0.56, 0.52);

  const bytes = await exportGroupGlb(group, "donnerbuechse.glb");
  console.log(`donnerbuechse.glb ← curved hot-rod bake (${bytes} bytes)`);
}

await bakeBisonPickup();
await generateHotRod();
console.log("ok");

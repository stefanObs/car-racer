#!/usr/bin/env node
/**
 * Polish shipped car GLBs (free assets only — no TurboSquid).
 * - Bison: Kenney truck-flat (CC0) + flat comic materials
 * - Käferkraft: prune micro debris, comic materials
 * - Donnerbüchse: generated classic hot-rod (long hood / chopped cabin / fat rears)
 *
 * Usage: node scripts/polish-car-glbs.mjs [/path/to/kenney/Models/GLB\ format]
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

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
const kenneyDir = process.argv[2] || "/tmp/car-assets/Models/GLB format";

mkdirSync(outDir, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function makeMat(doc, name, hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return doc
    .createMaterial(name)
    .setBaseColorFactor([r, g, b, 1])
    .setMetallicFactor(name === "Chrome" ? 0.35 : 0)
    .setRoughnessFactor(name === "Chrome" ? 0.45 : 0.85);
}

function primVolume(prim) {
  const arr = prim.getAttribute("POSITION")?.getArray();
  if (!arr || arr.length < 9) return 0;
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = arr[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return (
    Math.max(max[0] - min[0], 0.001) *
    Math.max(max[1] - min[1], 0.001) *
    Math.max(max[2] - min[2], 0.001)
  );
}

function nodeStats(node) {
  const mesh = node.getMesh();
  if (!mesh) return { vol: 0, cy: 0, verts: 0 };
  let vol = 0;
  let cy = 0;
  let verts = 0;
  for (const prim of mesh.listPrimitives()) {
    vol = Math.max(vol, primVolume(prim));
    const arr = prim.getAttribute("POSITION")?.getArray();
    if (!arr) continue;
    for (let i = 0; i < arr.length; i += 3) {
      cy += arr[i + 1];
      verts++;
    }
  }
  return { vol, cy: verts ? cy / verts : 0, verts };
}

async function polishBison() {
  const src = join(kenneyDir, "truck-flat.glb");
  if (!existsSync(src)) throw new Error(`Missing ${src} — unzip Kenney Car Kit first`);
  const doc = await io.read(src);
  const body = makeMat(doc, "BodyPaint", 0x2f9e44);
  const tire = makeMat(doc, "Tire", 0x1a1a1a);
  const chrome = makeMat(doc, "Chrome", 0xc8ccd4);

  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const name = (node.getName() || "").toLowerCase();
    for (const prim of mesh.listPrimitives()) {
      prim.setMaterial(name.includes("wheel") ? tire : body);
    }
    // subtle rim cue: second prim on wheels if present
    const prims = mesh.listPrimitives();
    if (name.includes("wheel") && prims.length > 1) prims[1].setMaterial(chrome);
  }
  for (const t of [...doc.getRoot().listTextures()]) t.dispose();
  await io.write(join(outDir, "bison.glb"), doc);
  console.log("bison.glb ← Kenney truck-flat (flat mats)");
}

async function polishBuggy() {
  const live = join(outDir, "kaeferkraft.glb");
  const backup = join(outDir, "kaeferkraft.source.glb");
  if (!existsSync(backup) && existsSync(live)) {
    // One-time: preserve the dense GetGLB source before first prune
    const probe = await io.read(live);
    const meshCount = probe.getRoot().listNodes().filter((n) => n.getMesh()).length;
    if (meshCount > 50) copyFileSync(live, backup);
  }
  const doc = await io.read(existsSync(backup) ? backup : live);
  const rootDoc = doc.getRoot();
  const meshNodes = rootDoc.listNodes().filter((n) => n.getMesh());
  if (meshNodes.length <= 40 && !existsSync(backup)) {
    console.log("kaeferkraft.glb already pruned — skip");
    return;
  }

  const body = makeMat(doc, "BodyPaint", 0x12b886);
  const dark = makeMat(doc, "Dark", 0x1b1b1f);
  const tire = makeMat(doc, "Tire", 0x141414);
  const chrome = makeMat(doc, "Chrome", 0xe9ecef);

  const ranked = meshNodes
    .map((n) => ({ n, ...nodeStats(n) }))
    .sort((a, b) => b.vol - a.vol);
  const maxV = ranked[0]?.vol || 1;
  const keep = new Set(ranked.filter((r) => r.vol >= maxV * 0.035 || r.vol >= 0.05).map((r) => r.n));
  for (const r of ranked.slice(0, 22)) keep.add(r.n);

  const drop = ranked.filter((r) => !keep.has(r.n));
  for (const { n } of drop) {
    const mesh = n.getMesh();
    n.setMesh(null);
    for (const parent of rootDoc.listNodes()) {
      if (parent.listChildren().includes(n)) parent.removeChild(n);
    }
    for (const scene of rootDoc.listScenes()) {
      if (scene.listChildren().includes(n)) scene.removeChild(n);
    }
  }

  for (const r of ranked) {
    if (!keep.has(r.n)) continue;
    const mesh = r.n.getMesh();
    if (!mesh) continue;
    const sizeHint = Math.cbrt(r.vol);
    const wheelish = r.cy < 0.22 && sizeHint > 0.28 && sizeHint < 0.9;
    const cageish = sizeHint < 0.5 && r.cy > 0.3;
    for (const prim of mesh.listPrimitives()) {
      if (wheelish) prim.setMaterial(tire);
      else if (cageish) prim.setMaterial(dark);
      else if (r.vol > maxV * 0.35) prim.setMaterial(body);
      else if (r.cy > 0.5 && sizeHint < 0.45) prim.setMaterial(chrome);
      else prim.setMaterial(body);
    }
    if (wheelish) {
      for (const prim of mesh.listPrimitives()) prim.setMaterial(tire);
      // Light rim cue on a second prim if present (inner disc)
      const prims = mesh.listPrimitives();
      if (prims.length > 1) prims[0].setMaterial(chrome);
    }
  }

  for (const t of [...rootDoc.listTextures()]) t.dispose();
  await io.write(live, doc);
  const left = rootDoc.listNodes().filter((n) => n.getMesh()).length;
  console.log(`kaeferkraft.glb ← pruned to ${left} meshes (was ${meshNodes.length})`);
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

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
  };

  // Classic hot-rod proportions (long hood, chopped cabin, fat rears)
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
    // hub
    add(new CylinderGeometry(r * 0.22, r * 0.22, w * 1.12, 8), chrome, x, r, z, 0, 0, Math.PI / 2);
  };
  wheel(-0.78, 1.15, 0.28, 0.28);
  wheel(0.78, 1.15, 0.28, 0.28);
  wheel(-0.82, -1.15, 0.48, 0.42);
  wheel(0.82, -1.15, 0.48, 0.42);

  const exporter = new GLTFExporter();
  const ab = await new Promise((resolve, reject) => {
    exporter.parse(group, (res) => resolve(res), reject, { binary: true });
  });
  const buf = Buffer.from(ab);
  writeFileSync(join(outDir, "donnerbuechse.glb"), buf);
  console.log(`donnerbuechse.glb ← generated hot rod (${buf.length} bytes)`);
}

await polishBison();
await polishBuggy();
await generateHotRod();
console.log("ok");

#!/usr/bin/env node
/**
 * Käferkraft Verstärkter Rahmen: straight Grey cylinders in mesh space (nose −X).
 * Replaces the Tripo blob. Waist rails follow BodyPaint garage picks
 * (caps buried into the hull) plus a diagonal from the rear insertion
 * to the cage top-front. Radius matches the welded stock cage.
 *
 *   node scripts/bake-kaeferkraft-pole-frame.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

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
const outPath = join(rootDir, "public/models/parts/kaeferkraft-reinforced_frame.glb");

const RADIUS = 0.025;
/** Bury both caps along the pole so cut edges sit inside BodyPaint. */
const INTO = 0.08;
/**
 * Live Waist span — BodyPaint garage picks (mesh m, nose −X).
 * Keep in sync with `buildReinforcedFrame("buggy")` in src/render/carPartBuilders.ts.
 * Viewer-right from behind (−Z): (−0.551, 1.029, −0.490) → (0.799, 0.947, −0.498)
 * Viewer-left from behind (+Z): (−0.504, 1.061, 0.490) → (0.579, 1.063, 0.570)
 */
const WAIST_SPANS = [
  { front: [-0.551, 1.029, -0.49], rear: [0.799, 0.947, -0.498] },
  { front: [-0.504, 1.061, 0.49], rear: [0.579, 1.063, 0.57] },
];
/** Stock cage top-front tube (mesh space, nose −X). */
const CAGE_FRONT_TOP = { x: -0.24, y: 1.48, z: 0.48 };
const GREY = 0x6a7078;

function extendIntoFrame(a, b, into) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  return [
    [a[0] - ux * into, a[1] - uy * into, a[2] - uz * into],
    [b[0] + ux * into, b[1] + uy * into, b[2] + uz * into],
  ];
}

function addPole(parent, a, b, name) {
  const ax = new Vector3(...a);
  const bx = new Vector3(...b);
  const dir = bx.clone().sub(ax);
  const len = dir.length();
  const mesh = new Mesh(
    new CylinderGeometry(RADIUS, RADIUS, len, 8),
    new MeshStandardMaterial({
      color: GREY,
      metalness: 0,
      roughness: 0.75,
      name: "Grey",
    }),
  );
  mesh.name = name;
  mesh.position.copy(ax.add(bx).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
  parent.add(mesh);
}

const g = new Group();
g.name = "kaeferkraft-reinforced_frame";
for (const span of WAIST_SPANS) {
  const [front, rear] = extendIntoFrame(span.front, span.rear, INTO);
  addPole(g, front, rear, "Waist");
  addPole(g, rear, [CAGE_FRONT_TOP.x, CAGE_FRONT_TOP.y, Math.sign(span.rear[2]) * CAGE_FRONT_TOP.z], "WaistToFrontTop");
}

const exporter = new GLTFExporter();
const ab = await new Promise((resolve, reject) => {
  exporter.parse(g, (res) => resolve(res), reject, { binary: true });
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(ab));
console.log("wrote", outPath, Buffer.from(ab).byteLength, "bytes, poles", g.children.length);

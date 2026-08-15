#!/usr/bin/env node
/**
 * Käferkraft Verstärkter Rahmen: straight Grey cylinders in mesh space (nose −X).
 * Replaces the Tripo blob. Layout matches the garage red-line overlay
 * (waist rail, rear→dash diagonal, rear stay) — mirrored ±Z. No front-sill
 * diagonal. Radius matches the welded stock cage; ends extend into the joints.
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
const INTO = 0.08;
/** Diagonals / stays — still on the inner cage plane until those poles are retuned. */
const SIDE_Z = 0.43;
/** Waist: just inside BodyPaint side-rail outer (|z|≈0.73), at the rail top (~y1.15). */
const WAIST_Z = 0.7;
const WAIST_Y = 1.14;
const GREY = 0x6a7078;

function extendEnds(a, b, extra) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const s = extra / len;
  return [
    [a[0] - dx * s, a[1] - dy * s, a[2] - dz * s],
    [b[0] + dx * s, b[1] + dy * s, b[2] + dz * s],
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
for (const side of [-1, 1]) {
  const z = SIDE_Z * side;
  const waistZ = WAIST_Z * side;
  addPole(g, ...extendEnds([-0.48, WAIST_Y, waistZ], [0.5, WAIST_Y, waistZ], INTO), "Waist");
  addPole(g, ...extendEnds([0.48, 1.54, z], [-0.5, 0.8, z], INTO), "XRearToDash");
  addPole(g, ...extendEnds([0.48, 1.54, z], [1.36, 0.7, Math.sign(z) * 0.36], INTO), "RearStay");
}

const exporter = new GLTFExporter();
const ab = await new Promise((resolve, reject) => {
  exporter.parse(g, (res) => resolve(res), reject, { binary: true });
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(ab));
console.log("wrote", outPath, Buffer.from(ab).byteLength, "bytes, poles", g.children.length);

#!/usr/bin/env node
/**
 * Käferkraft Verstärkter Rahmen: straight Grey cylinders in mesh space (nose −X).
 * Replaces the Tripo blob. Waist rails follow BodyPaint garage picks
 * (caps buried into the hull) plus a diagonal from each rear insertion
 * to BodyPaint cage picks. Radius matches the welded stock cage.
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
/** Bury caps along the pole so cut edges sit inside BodyPaint. */
const INTO = 0.08;
const GREY = 0x6a7078;

/**
 * Independent waist rails (mesh m, nose −X). Command `WaistL` or `WaistR` alone.
 * Keep in sync with `buildReinforcedFrame("buggy")`.
 * Stays run from the buried waist rear to a BodyPaint cage pick (cage cap buried).
 */
const WAIST_L = {
  name: "WaistL",
  stay: "WaistToFrontTop_L",
  front: [-0.571, 1.061, -0.449],
  rear: [0.57, 1.051, -0.6],
  cage: [-0.07, 1.586, -0.458],
};
const WAIST_R = {
  name: "WaistR",
  stay: "WaistToFrontTop_R",
  front: [-0.504, 1.061, 0.49],
  rear: [0.579, 1.063, 0.57],
  cage: [-0.053, 1.591, 0.44],
};

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
for (const side of [WAIST_L, WAIST_R]) {
  const [front, rear] = extendIntoFrame(side.front, side.rear, INTO);
  addPole(g, front, rear, side.name);
  addPole(g, rear, extendIntoFrame(rear, side.cage, INTO)[1], side.stay);
}

const exporter = new GLTFExporter();
const ab = await new Promise((resolve, reject) => {
  exporter.parse(g, (res) => resolve(res), reject, { binary: true });
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(ab));
console.log("wrote", outPath, Buffer.from(ab).byteLength, "bytes, poles", g.children.length);

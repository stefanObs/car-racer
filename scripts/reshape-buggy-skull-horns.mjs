#!/usr/bin/env node
/**
 * Restore mesh for the comic single-horn sheet (pre–V-bake texture):
 * public/textures/buggy-skull-horn.png — one curved horn drawing.
 *
 * Builds left/right extruded silhouettes from that texture so YZ/planar UVs
 * match the drawing 1:1 (left arm mirrors U).
 *
 * Usage: node scripts/reshape-buggy-skull-horns.mjs
 * Expects the prior horn PNG already in public/textures/buggy-skull-horn.png
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";
import sharp from "sharp";
import {
  BufferAttribute,
  ExtrudeGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
const glbPath = join(rootDir, "public/models/cars/kaeferkraft.glb");
const texPath = join(rootDir, "public/textures/buggy-skull-horn.png");

/** Bumper placement for the twin horns (front of Käferkraft). */
const PLACE = {
  x: -1.18,
  /** World size of one horn sheet (texture full 0..1 → this rect in YZ). */
  y0: -0.02,
  y1: 0.34,
  /** Right horn sits in +Z; left mirrors. */
  zRight0: 0.02,
  zRight1: 0.42,
  depth: 0.07,
};

const BG = [232, 220, 200];

function isHornPixel(r, g, b) {
  if (Math.hypot(r - BG[0], g - BG[1], b - BG[2]) < 28) return false;
  if (r > 245 && g > 245 && b > 240) return false;
  return true;
}

/** Moore neighborhood contour (outer), clockwise, pixel centers. */
function extractContour(mask, W, H) {
  const key = (x, y) => y * W + x;
  let sx = -1;
  let sy = -1;
  outer: for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[key(x, y)]) {
        sx = x;
        sy = y;
        break outer;
      }
    }
  }
  if (sx < 0) throw new Error("No horn pixels in texture");

  // N, NE, E, SE, S, SW, W, NW
  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];
  const pts = [];
  let x = sx;
  let y = sy;
  let dir = 4; // come from west → start looking south-ish
  const start = key(sx, sy);
  let guard = 0;
  do {
    pts.push([x + 0.5, y + 0.5]);
    let found = false;
    for (let i = 0; i < 8; i++) {
      const nd = (dir + 6 + i) % 8; // turn left first
      const nx = x + dx[nd];
      const ny = y + dy[nd];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!mask[key(nx, ny)]) continue;
      x = nx;
      y = ny;
      dir = nd;
      found = true;
      break;
    }
    if (!found) break;
    guard++;
  } while ((x !== sx || y !== sy) && guard < W * H);

  // Decimate
  const step = Math.max(1, Math.floor(pts.length / 120));
  const slim = [];
  for (let i = 0; i < pts.length; i += step) slim.push(pts[i]);
  return slim;
}

async function loadHornMask() {
  const { data, info } = await sharp(texPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const mask = new Uint8Array(W * H);
  let count = 0;
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    if (isHornPixel(data[i], data[i + 1], data[i + 2])) {
      mask[p] = 1;
      count++;
    }
  }
  if (count < 100) throw new Error("Horn texture mask too small — wrong PNG?");
  return { mask, W, H, count };
}

function contourToShape(contour, W, H, mirrorU) {
  const shape = new Shape();
  const toXZ = (px, py) => {
    // Image: x→U, y down. Shape in local (u, vUp) before world scale.
    let u = px / W;
    const vUp = 1 - py / H;
    if (mirrorU) u = 1 - u;
    return new Vector2(u, vUp);
  };
  const p0 = toXZ(contour[0][0], contour[0][1]);
  shape.moveTo(p0.x, p0.y);
  for (let i = 1; i < contour.length; i++) {
    const p = toXZ(contour[i][0], contour[i][1]);
    shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  return shape;
}

function extrudeHorn(shape, z0, z1, y0, y1, mirrorU) {
  const geo = new ExtrudeGeometry(shape, {
    depth: PLACE.depth,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  // Shape XY = (u,vUp); Extrude +Z local. Map → world: u→Z band, vUp→Y, depth→X.
  const pos = geo.getAttribute("position");
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const vUp = pos.getY(i);
    const d = pos.getZ(i); // 0..depth
    const z = z0 + u * (z1 - z0);
    const y = y0 + vUp * (y1 - y0);
    const x = PLACE.x - PLACE.depth * 0.5 + d;
    pos.setXYZ(i, x, y, z);
    // Texture UVs: same as shape (mirrored for left).
    uvs[i * 2] = mirrorU ? 1 - u : u;
    uvs[i * 2 + 1] = vUp;
  }
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function loadGlb(path) {
  const buf = readFileSync(path);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject);
  });
}

async function exportGlb(root, path) {
  const exporter = new GLTFExporter();
  const ab = await new Promise((resolve, reject) => {
    exporter.parse(root, (res) => resolve(res), reject, { binary: true });
  });
  writeFileSync(path, Buffer.from(ab));
}

const { mask, W, H, count } = await loadHornMask();
const contour = extractContour(mask, W, H);

const gltf = await loadGlb(glbPath);
const root = gltf.scene;
const toRemove = [];
root.traverse((obj) => {
  const mesh = obj;
  if (!mesh.isMesh) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (mats.some((m) => ((m?.name ?? "") + "").toLowerCase().includes("skullhorn"))) {
    toRemove.push(mesh);
  }
});
for (const m of toRemove) m.removeFromParent();

const shapeR = contourToShape(contour, W, H, false);
const shapeL = contourToShape(contour, W, H, true);
const zSpan = PLACE.zRight1 - PLACE.zRight0;
const geoR = extrudeHorn(shapeR, PLACE.zRight0, PLACE.zRight1, PLACE.y0, PLACE.y1, false);
const geoL = extrudeHorn(shapeL, -PLACE.zRight1, -PLACE.zRight0, PLACE.y0, PLACE.y1, true);
const merged = mergeGeometries([geoL, geoR], false);
if (!merged) throw new Error("merge failed");

const mat = new MeshStandardMaterial({
  name: "SkullHorn",
  color: 0xe8dcc8,
  roughness: 0.85,
  metalness: 0.05,
});
const hornMesh = new Mesh(merged, mat);
hornMesh.name = "SkullHorns";
root.add(hornMesh);
await exportGlb(root, glbPath);

console.log("Reshaped horns to prior single-horn texture silhouette", {
  removed: toRemove.length,
  texPixels: count,
  contour: contour.length,
  verts: merged.getAttribute("position").count,
  zSpan,
});

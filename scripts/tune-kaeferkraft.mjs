#!/usr/bin/env node
/**
 * Tune Käferkraft GetGLB buggy materials/meshes (free asset).
 * - Roll cage + rear under-engine tray → BodyPaint (garage color)
 * - Engine + exhaust → silver Chrome
 * - Front skull eyes → red; horns → SkullHorn (bone texture in-engine)
 * - Seats, pedals, gear shift, steering column → black
 * - Drop thin black overlay strips beside body panels
 *
 * Legacy GetGLB tuner. Live mesh is Tripo: `npm run cars:bake-kaeferkraft-tripo`.
 * Prefers public/models/cars/kaeferkraft.source.glb when present.
 * Usage: node scripts/tune-kaeferkraft.mjs
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(rootDir, "public/models/cars");
const live = join(outDir, "kaeferkraft.glb");
const source = join(outDir, "kaeferkraft.source.glb");

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function makeMat(doc, name, hex, { metal = 0, rough = 0.85 } = {}) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return doc
    .createMaterial(name)
    .setBaseColorFactor([r, g, b, 1])
    .setMetallicFactor(metal)
    .setRoughnessFactor(rough);
}

function primCenter(prim) {
  const arr = prim.getAttribute("POSITION")?.getArray();
  if (!arr || arr.length < 3) return { x: 0, y: 0, z: 0, size: [0, 0, 0], verts: 0 };
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = arr[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return {
    x: (min[0] + max[0]) / 2,
    y: (min[1] + max[1]) / 2,
    z: (min[2] + max[2]) / 2,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    verts: arr.length / 3,
  };
}

function matId(name) {
  const m = String(name || "").match(/mat(\d+)/i);
  return m ? Number(m[1]) : -1;
}

/** Black coplanar accents glued beside body panels (mat23). */
function isBlackPanelStrip(c, id) {
  if (id !== 23) return false;
  const [sx, sy, sz] = c.size;
  const thinnest = Math.min(sx, sy, sz);
  if (c.y < 0.05 && Math.abs(c.z) > 0.5 && Math.max(sx, sy) > 0.45) return false;
  if (c.x > 0.9 && Math.max(...c.size) > 0.6) return false;
  if (c.x < -1.2 && c.verts >= 40 && Math.max(...c.size) > 0.2) return false;
  return thinnest < 0.16 || c.verts <= 24;
}

function isTinyEdgeFlake(c, id) {
  if (id !== 13) return false;
  if (c.y > 0.28) return false;
  return c.verts <= 8 && Math.min(...c.size) < 0.08;
}

function isWheel(c) {
  if (c.y > 0.05 || Math.abs(c.z) < 0.5) return false;
  const dims = [...c.size].sort((a, b) => a - b);
  const [thin, mid, long] = dims;
  return mid > 0.35 && long > 0.4 && thin < 0.4 && mid / Math.max(thin, 0.01) > 1.15 && long / mid < 1.35;
}

function isSkullEye(c, id) {
  if (![12, 15, 16].includes(id)) return false;
  return (
    c.x < -1.22 &&
    c.y > -0.1 &&
    c.y < 0.22 &&
    Math.abs(c.z) > 0.12 &&
    Math.abs(c.z) < 0.35 &&
    Math.max(...c.size) < 0.35
  );
}

function isSkullHorn(c, id) {
  if (id !== 18 && id !== 20) return false;
  if (c.x > -1.05 || c.x < -1.35) return false;
  return c.size[1] > 0.25 && c.size[2] > 0.6 && c.y > 0.05;
}

function isSeat(c, id) {
  if (id !== 22) return false;
  if (c.x > 0.45 || c.x < -0.55) return false;
  if (c.y < 0.05 || c.y > 0.55) return false;
  if (Math.abs(c.z) < 0.12 || Math.abs(c.z) > 0.5) return false;
  return c.size[1] > 0.4 && Math.max(c.size[0], c.size[2]) > 0.4;
}

/** Tubular bars over the cockpit — follow garage paint. */
function isRollCage(c, id) {
  if (id !== 13 && id !== 14) return false;
  if (c.y < 0.28) return false;
  const [sx, sy, sz] = c.size;
  const thin = Math.min(sx, sz) < 0.28 || Math.min(sx, sy, sz) < 0.14;
  const tallOrWide = sy > 0.3 || Math.max(sx, sz) > 0.7;
  return thin && tallOrWide;
}

/** Wide flat tray + cradle + lower engine carrier — garage paint, not chrome. */
function isRearUnderEngine(c, id) {
  if (c.x < 0.55 || c.x > 1.35) return false;
  if (isWheel(c)) return false;
  if (![14, 15, 16, 17, 22].includes(id)) return false;
  // Wide skid trays
  if (c.y <= 0.05 && c.size[2] > 0.55 && c.size[1] < 0.22) return true;
  // Compact cradle mounts under the motor
  if (
    c.y > 0.15 &&
    c.y < 0.45 &&
    c.verts < 300 &&
    Math.max(...c.size) < 0.55 &&
    Math.min(...c.size) > 0.04
  ) {
    return true;
  }
  // Lower carrier plate of the engine cluster (reads as “under the motor”)
  if (c.y > 0.02 && c.y < 0.22 && c.verts > 400 && c.verts < 1400 && c.size[1] > 0.4) {
    return true;
  }
  return false;
}

/** Floor pedals in the footwell. */
function isPedal(c, id) {
  if (c.y > -0.08 || c.y < -0.28) return false;
  if (c.x < -0.55 || c.x > 0.05) return false;
  if (Math.abs(c.z) > 0.45) return false;
  if (c.size[1] > 0.14) return false;
  return Math.max(c.size[0], c.size[2]) > 0.07 && Math.max(c.size[0], c.size[2]) < 0.45;
}

/** Gear lever beside the seats. */
function isGearShift(c, id) {
  if (c.x < -0.45 || c.x > -0.1) return false;
  if (c.y < 0.12 || c.y > 0.45) return false;
  if (c.z < 0.08 || c.z > 0.4) return false;
  return Math.max(...c.size) < 0.4 && Math.min(...c.size) < 0.2;
}

/** Steering column shaft + hub (wheel added at runtime). */
function isSteeringColumn(c, id) {
  if (c.x < -0.4 || c.x > -0.1) return false;
  if (Math.abs(c.z) > 0.12) return false;
  // Tall thin shaft
  if (c.size[1] > 0.2 && Math.min(c.size[0], c.size[2]) < 0.12) return true;
  // Hub knob
  if (c.y > 0.05 && c.y < 0.25 && Math.max(...c.size) < 0.12 && c.verts > 50) return true;
  return false;
}

function isRearEngineChrome(c, id) {
  if (c.x < 0.55) return false;
  if (isRearUnderEngine(c, id)) return false;
  if ([15, 16, 17, 19, 21, 22, 23].includes(id)) {
    if (isWheel(c)) return false;
    return true;
  }
  if (c.y > 0.2 && c.size[1] > 0.15 && Math.max(c.size[0], c.size[2]) < 0.55) {
    return id === 12 || id === 14 || id === 15 || id === 16;
  }
  return false;
}

function classify(c, matName) {
  const id = matId(matName);

  if (isSkullEye(c, id)) return "eye";
  if (isSkullHorn(c, id)) return "horn";
  if (isSeat(c, id)) return "seat";
  if (isPedal(c, id) || isGearShift(c, id) || isSteeringColumn(c, id)) return "dark";
  if (isBlackPanelStrip(c, id) || isTinyEdgeFlake(c, id)) return "drop";

  if (isWheel(c)) {
    if (id === 15 || id === 16) return "rim";
    return "tire";
  }

  if (id === 17 || id === 23) {
    const dims = [...c.size].sort((a, b) => a - b);
    if (dims[2] > 0.5 && dims[2] / Math.max(dims[1], 0.01) > 1.6) return "drop";
  }

  // Cage + under-engine tray take garage paint
  if (isRollCage(c, id) || isRearUnderEngine(c, id)) return "body";
  if (isRearEngineChrome(c, id)) return "chrome";

  if (c.x < -1.15 && id === 21) return "skull";
  if (c.x < -1.2 && id === 23 && c.verts >= 40) return "drop";

  if (c.x < -1.2 && (id === 15 || id === 16) && Math.abs(c.z) > 0.1) return "chrome";

  if ([13, 14, 18, 19, 20].includes(id)) return "body";

  if ([15, 16, 22].includes(id)) return "chrome";
  if (id === 17 || id === 23) return "drop";
  if (id === 12) return "chrome";
  if (id === 21) return "skull";

  return "body";
}

async function main() {
  if (!existsSync(source) && existsSync(live)) {
    copyFileSync(live, source);
  }
  const readPath = existsSync(source) ? source : live;
  if (!existsSync(readPath)) throw new Error(`Missing ${readPath}`);

  const doc = await io.read(readPath);
  const root = doc.getRoot();

  const body = makeMat(doc, "BodyPaint", 0x12b886);
  const chrome = makeMat(doc, "Chrome", 0xd8dde3, { metal: 0.55, rough: 0.35 });
  const tire = makeMat(doc, "Tire", 0x1a1a1a);
  const skull = makeMat(doc, "Skull", 0xf1f3f5);
  const skullHorn = makeMat(doc, "SkullHorn", 0xe8dcc8);
  const eye = makeMat(doc, "EyeRed", 0xff1e1e);
  const dark = makeMat(doc, "Dark", 0x1a1a1a);
  const seat = makeMat(doc, "Seat", 0x1a1a1a);

  const counts = {
    body: 0,
    chrome: 0,
    tire: 0,
    rim: 0,
    skull: 0,
    eye: 0,
    horn: 0,
    seat: 0,
    dark: 0,
    drop: 0,
  };
  const dropPrims = [];

  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    for (const prim of mesh.listPrimitives()) {
      const c = primCenter(prim);
      const matName = prim.getMaterial()?.getName() || "";
      const kind = classify(c, matName);
      counts[kind] = (counts[kind] || 0) + 1;

      switch (kind) {
        case "chrome":
        case "rim":
          prim.setMaterial(chrome);
          break;
        case "tire":
          prim.setMaterial(tire);
          break;
        case "skull":
          prim.setMaterial(skull);
          break;
        case "eye":
          prim.setMaterial(eye);
          break;
        case "horn":
          prim.setMaterial(skullHorn);
          break;
        case "dark":
          prim.setMaterial(dark);
          break;
        case "seat":
          prim.setMaterial(seat);
          break;
        case "drop":
          dropPrims.push({ mesh, prim, node });
          break;
        default:
          prim.setMaterial(body);
      }
    }
  }

  for (const { mesh, prim } of dropPrims) {
    mesh.removePrimitive(prim);
  }
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (mesh.listPrimitives().length > 0) continue;
    node.setMesh(null);
    for (const parent of root.listNodes()) {
      if (parent.listChildren().includes(node)) parent.removeChild(node);
    }
    for (const scene of root.listScenes()) {
      if (scene.listChildren().includes(node)) scene.removeChild(node);
    }
  }

  for (const t of [...root.listTextures()]) t.dispose();
  for (const m of [...root.listMaterials()]) {
    const used = root.listMeshes().some((mesh) =>
      mesh.listPrimitives().some((p) => p.getMaterial() === m),
    );
    if (!used) m.dispose();
  }

  await io.write(live, doc);
  console.log("kaeferkraft.glb tuned", counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

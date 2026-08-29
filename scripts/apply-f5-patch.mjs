#!/usr/bin/env node
/**
 * Bake an F5 Mesh-Studio patch into shipped GLBs.
 *
 *   npm run mesh:apply-f5-patch -- tmp/f5-patch.txt
 *   cat tmp/f5-patch.txt | npm run mesh:apply-f5-patch
 *
 * `apply: mount` nodes are printed, not written — update carParts.ts mounts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const HEADER = "CRASH CIRCUIT F5 PATCH v1";

function compose(t, q, s) {
  const [x, y, z, w] = q;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = s[0];
  const sy = s[1];
  const sz = s[2];
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}

function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function invert(m) {
  const inv = new Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (Math.abs(det) < 1e-12) return null;
  for (let i = 0; i < 16; i++) inv[i] /= det;
  return inv;
}

function xform(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function quatYXZ(pitchDeg, yawDeg, rollDeg) {
  const x = (pitchDeg * Math.PI) / 180;
  const y = (yawDeg * Math.PI) / 180;
  const z = (rollDeg * Math.PI) / 180;
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ];
}

function splitArrow(raw) {
  const i = raw.indexOf("->");
  if (i < 0) return [raw.trim(), raw.trim()];
  return [raw.slice(0, i).trim(), raw.slice(i + 2).trim()];
}

function parseVec3(raw) {
  const p = raw.split(",").map((s) => Number(s.trim()));
  return { x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 };
}

function parsePatch(text) {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.trim().startsWith(HEADER)) throw new Error("Not an F5 patch (missing header).");
  const patch = { car: "", nodes: [] };
  let cur = null;
  const flush = () => {
    if (cur) patch.nodes.push(cur);
    cur = null;
  };
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line || line.startsWith("instruction:")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (key === "car") {
      patch.car = val;
      continue;
    }
    if (key === "node") {
      flush();
      cur = { name: val, path: val, file: "", apply: "glb-node", to: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1 }, verts: [] };
      continue;
    }
    if (!cur) continue;
    if (key === "path") cur.path = val;
    else if (key === "file") cur.file = val;
    else if (key === "apply") cur.apply = val === "mount" ? "mount" : "glb-node";
    else if (key === "part") cur.partId = val;
    else if (key === "index") cur.sameNameIndex = Number(val);
    else if (key === "origin") {
      const to = parseVec3(splitArrow(val)[1]);
      cur.to.x = to.x;
      cur.to.y = to.y;
      cur.to.z = to.z;
    } else if (key === "yaw" || key === "pitch" || key === "roll") {
      cur.to[key] = Number(splitArrow(val)[1]);
    } else if (key === "scale") {
      const to = parseVec3(splitArrow(val)[1]);
      cur.to.sx = to.x;
      cur.to.sy = to.y;
      cur.to.sz = to.z;
    } else if (key === "vert") {
      const eq = val.indexOf("=");
      if (eq < 0) continue;
      const i = Number(val.slice(0, eq).trim());
      const p = parseVec3(val.slice(eq + 1));
      cur.verts.push({ i, x: p.x, y: p.y, z: p.z });
    }
  }
  flush();
  if (!patch.car || patch.nodes.length === 0) throw new Error("Patch has no car/nodes.");
  return patch;
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function worldMatrix(node) {
  const chain = [];
  let n = node;
  while (n) {
    chain.push(n);
    n = n.getParentNode();
  }
  let m = identity();
  for (let i = chain.length - 1; i >= 0; i--) {
    const nd = chain[i];
    m = mul(m, compose(nd.getTranslation(), nd.getRotation(), nd.getScale()));
  }
  return m;
}

function parentWorldMatrix(node) {
  const parent = node.getParentNode();
  return parent ? worldMatrix(parent) : identity();
}

function nodePath(node) {
  const names = [];
  let n = node;
  while (n) {
    const name = n.getName()?.trim();
    if (name) names.push(name);
    n = n.getParentNode();
  }
  return names.reverse().join(" / ");
}

function leafName(raw) {
  return String(raw ?? "")
    .split(" / ")
    .at(-1)
    ?.trim() ?? "";
}

function findNode(doc, entry) {
  const want = leafName(entry.name) || leafName(entry.path);
  const named = doc.getRoot().listNodes().filter((n) => {
    const name = n.getName();
    const path = nodePath(n);
    return (
      name === entry.name ||
      name === want ||
      path === entry.path ||
      path.endsWith(entry.path) ||
      path.endsWith(want)
    );
  });
  const byPath = named.filter((n) => !entry.path || nodePath(n) === entry.path || nodePath(n).endsWith(entry.path) || nodePath(n).endsWith(want));
  const pool = byPath.length ? byPath : named;
  if (typeof entry.sameNameIndex === "number" && pool[entry.sameNameIndex]) return pool[entry.sameNameIndex];
  return pool[0] ?? null;
}

function applyNodePose(node, to, extraParentWorld = identity()) {
  const parent = mul(extraParentWorld, parentWorldMatrix(node));
  const inv = invert(parent);
  if (!inv) throw new Error(`Cannot invert parent of ${node.getName()}`);
  const localPos = xform(inv, to.x, to.y, to.z);
  const worldQ = quatYXZ(to.pitch, to.yaw, to.roll);
  const parentQ = rotationOf(parent);
  node.setTranslation(localPos);
  node.setRotation(quatMul(quatConj(parentQ), worldQ));
  node.setScale([to.sx, to.sy, to.sz]);
}

function partIdFromPath(path, name, explicit) {
  if (explicit) return explicit;
  for (const seg of `${path} / ${name}`.split(" / ")) {
    const m = /^carPart-([a-z0-9_]+?)(?:-\d+)?$/.exec(seg.trim());
    if (m) return m[1];
  }
  return undefined;
}

function poseWorldMatrix(to) {
  return compose([to.x, to.y, to.z], quatYXZ(to.pitch, to.yaw, to.roll), [to.sx, to.sy, to.sz]);
}

function partsGlbRel(car, partId) {
  return `public/models/parts/${car}-${partId}.glb`;
}

function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatConj(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}

function rotationOf(m) {
  const sx = Math.hypot(m[0], m[1], m[2]) || 1;
  const sy = Math.hypot(m[4], m[5], m[6]) || 1;
  const sz = Math.hypot(m[8], m[9], m[10]) || 1;
  const r00 = m[0] / sx;
  const r10 = m[1] / sx;
  const r20 = m[2] / sx;
  const r01 = m[4] / sy;
  const r11 = m[5] / sy;
  const r21 = m[6] / sy;
  const r02 = m[8] / sz;
  const r12 = m[9] / sz;
  const r22 = m[10] / sz;
  const tr = r00 + r11 + r22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(r21 - r12) / s, (r02 - r20) / s, (r10 - r01) / s, 0.25 * s];
  } else if (r00 > r11 && r00 > r22) {
    const s = Math.sqrt(1 + r00 - r11 - r22) * 2;
    q = [0.25 * s, (r01 + r10) / s, (r02 + r20) / s, (r21 - r12) / s];
  } else if (r11 > r22) {
    const s = Math.sqrt(1 + r11 - r00 - r22) * 2;
    q = [(r01 + r10) / s, 0.25 * s, (r12 + r21) / s, (r02 - r20) / s];
  } else {
    const s = Math.sqrt(1 + r22 - r00 - r11) * 2;
    q = [(r02 + r20) / s, (r12 + r21) / s, 0.25 * s, (r10 - r01) / s];
  }
  return q;
}

function applyVerts(node, verts) {
  const mesh = node.getMesh();
  if (!mesh || verts.length === 0) return;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    for (const v of verts) {
      if (v.i < 0 || v.i >= pos.getCount()) continue;
      pos.setElement(v.i, [v.x, v.y, v.z]);
    }
  }
}

const arg = process.argv[2];
const text = !arg || arg === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(arg), "utf8");
const patch = parsePatch(text);
const mountsByPart = new Map();
const glbNodes = [];
for (const node of patch.nodes) {
  if (node.apply === "mount") {
    const partId = partIdFromPath(node.path, node.name, node.partId);
    if (partId) mountsByPart.set(partId, node);
    console.log(
      `MOUNT ${patch.car} part=${partId ?? "?"} origin -> ${node.to.x.toFixed(3)}, ${node.to.y.toFixed(3)}, ${node.to.z.toFixed(3)} (edit src/render/carParts.ts)`,
    );
    continue;
  }
  glbNodes.push(node);
}

const docs = new Map();
async function loadDoc(rel) {
  if (docs.has(rel)) return docs.get(rel);
  const abs = join(rootDir, rel);
  if (!existsSync(abs)) return null;
  const rec = { doc: await io.read(abs), abs, dirty: false };
  docs.set(rel, rec);
  return rec;
}

for (const entry of glbNodes) {
  const partId = partIdFromPath(entry.path, entry.name, entry.partId);
  const candidates = [];
  if (entry.file.endsWith(".glb")) candidates.push(entry.file);
  if (partId) {
    const partsRel = partsGlbRel(patch.car, partId);
    if (!candidates.includes(partsRel)) candidates.push(partsRel);
  }
  let applied = false;
  for (const rel of candidates) {
    const rec = await loadDoc(rel);
    if (!rec) continue;
    const node = findNode(rec.doc, entry);
    if (!node) continue;
    const mount = partId ? mountsByPart.get(partId) : undefined;
    const usedMount = Boolean(rel.includes("/parts/") && mount);
    const extra = usedMount ? poseWorldMatrix(mount.to) : identity();
    applyNodePose(node, entry.to, extra);
    applyVerts(node, entry.verts);
    rec.dirty = true;
    applied = true;
    console.log(`OK ${entry.name} in ${rel}${usedMount ? " (mount parent)" : ""}`);
    break;
  }
  if (!applied) {
    console.log(`MISSING ${entry.name} file=${entry.file}`);
  }
}

for (const rec of docs.values()) {
  if (!rec.dirty) continue;
  writeFileSync(rec.abs, await io.writeBinary(rec.doc));
}

console.log(`car ${patch.car}: ${patch.nodes.length} node(s). Then: npm run docs:cheatsheets`);

/**
 * Inspect a GLB: nodes, meshes, primitives, materials, world AABBs.
 * Also builds SVG coordinate grids (meters) for cheat sheets.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Column-major 4×4 identity. */
function matI() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** TRS → column-major 4×4 (glTF quaternion XYZW). */
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
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function xform(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function emptyAabb() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

function expand(aabb, x, y, z) {
  aabb.min[0] = Math.min(aabb.min[0], x);
  aabb.min[1] = Math.min(aabb.min[1], y);
  aabb.min[2] = Math.min(aabb.min[2], z);
  aabb.max[0] = Math.max(aabb.max[0], x);
  aabb.max[1] = Math.max(aabb.max[1], y);
  aabb.max[2] = Math.max(aabb.max[2], z);
}

function mergeAabb(into, other) {
  if (!other || !Number.isFinite(other.min[0])) return;
  expand(into, ...other.min);
  expand(into, ...other.max);
}

export function fmt(n, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  const v = Number(n.toFixed(digits));
  return Object.is(v, -0) ? "0" : String(v);
}

export function fmtVec(v, digits = 3) {
  return `(${fmt(v[0], digits)}, ${fmt(v[1], digits)}, ${fmt(v[2], digits)})`;
}

export function aabbCenter(aabb) {
  return [
    (aabb.min[0] + aabb.max[0]) / 2,
    (aabb.min[1] + aabb.max[1]) / 2,
    (aabb.min[2] + aabb.max[2]) / 2,
  ];
}

export function xmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function primStats(prim, world) {
  const pos = prim.getAttribute("POSITION");
  const mat = prim.getMaterial();
  const aabb = emptyAabb();
  let verts = 0;
  if (pos) {
    verts = pos.getCount();
    const el = [0, 0, 0];
    for (let i = 0; i < verts; i++) {
      pos.getElement(i, el);
      const w = xform(world, el[0], el[1], el[2]);
      expand(aabb, w[0], w[1], w[2]);
    }
  }
  const idx = prim.getIndices();
  const tris = idx ? Math.floor(idx.getCount() / 3) : Math.floor(verts / 3);
  return {
    verts,
    tris,
    material: mat?.getName() || "(unnamed mat)",
    aabb: Number.isFinite(aabb.min[0]) ? aabb : null,
  };
}

function walkNode(node, parentWorld, path, out) {
  const local = compose(node.getTranslation(), node.getRotation(), node.getScale());
  const world = mul(parentWorld, local);
  const mesh = node.getMesh();
  const name = node.getName() || "(unnamed)";
  const here = path ? `${path}/${name}` : name;
  const prims = [];
  const aabb = emptyAabb();
  if (mesh) {
    for (const prim of mesh.listPrimitives()) {
      const st = primStats(prim, world);
      prims.push(st);
      if (st.aabb) mergeAabb(aabb, st.aabb);
    }
  }
  const t = node.getTranslation();
  out.push({
    name,
    path: here,
    mesh: mesh?.getName() || (mesh ? name : null),
    translation: [t[0], t[1], t[2]],
    rotation: [...node.getRotation()],
    scale: [...node.getScale()],
    prims,
    verts: prims.reduce((n, p) => n + p.verts, 0),
    tris: prims.reduce((n, p) => n + p.tris, 0),
    materials: [...new Set(prims.map((p) => p.material))],
    aabb: Number.isFinite(aabb.min[0]) ? aabb : null,
  });
  for (const child of node.listChildren()) walkNode(child, world, here, out);
}

export async function inspectGlb(absPath) {
  const doc = await io.read(absPath);
  const root = doc.getRoot();
  const nodes = [];
  for (const scene of root.listScenes()) {
    const sceneName = scene.getName() || "Scene";
    for (const child of scene.listChildren()) {
      walkNode(child, matI(), sceneName, nodes);
    }
  }
  const rootAabb = emptyAabb();
  for (const n of nodes) mergeAabb(rootAabb, n.aabb);
  const materials = [
    ...new Set(root.listMaterials().map((m) => m.getName() || "(unnamed mat)")),
  ];
  return {
    path: absPath,
    nodeCount: nodes.length,
    nodes,
    materials,
    aabb: Number.isFinite(rootAabb.min[0]) ? rootAabb : null,
  };
}

function niceTicks(span) {
  if (span <= 6) return { minor: 0.25, major: 1 };
  if (span <= 16) return { minor: 0.5, major: 2 };
  if (span <= 40) return { minor: 1, major: 5 };
  if (span <= 120) return { minor: 5, major: 10 };
  return { minor: 10, major: 50 };
}

function roundDown(v, step) {
  return Math.floor(v / step) * step;
}

function roundUp(v, step) {
  return Math.ceil(v / step) * step;
}

/**
 * Orthographic meter grid with boxes + labels.
 * `u`/`v` are the two axes drawn (e.g. x/z for top).
 */
export function gridSvg({
  title,
  uLabel,
  vLabel,
  items = [],
  points = [],
  polylines = [],
  width = 760,
  height = 520,
} = {}) {
  const bounds = emptyAabb();
  expand(bounds, 0, 0, 0);
  for (const it of items) {
    expand(bounds, it.umin, it.vmin, 0);
    expand(bounds, it.umax, it.vmax, 0);
  }
  for (const p of points) expand(bounds, p.u, p.v, 0);
  for (const line of polylines) {
    for (const p of line.pts) expand(bounds, p[0], p[1], 0);
  }
  if (!Number.isFinite(bounds.min[0])) {
    expand(bounds, -1, -1, 0);
    expand(bounds, 1, 1, 0);
  }
  const pad = 0.6;
  let u0 = bounds.min[0] - pad;
  let u1 = bounds.max[0] + pad;
  let v0 = bounds.min[1] - pad;
  let v1 = bounds.max[1] + pad;
  const span = Math.max(u1 - u0, v1 - v0, 1);
  const { minor, major } = niceTicks(span);
  u0 = roundDown(u0, major);
  v0 = roundDown(v0, major);
  u1 = roundUp(u1, major);
  v1 = roundUp(v1, major);
  const left = 56;
  const top = 36;
  const right = 18;
  const bottom = 40;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const sx = innerW / (u1 - u0);
  const sy = innerH / (v1 - v0);
  const X = (u) => left + (u - u0) * sx;
  // SVG Y grows down; +v is up on the page.
  const Y = (v) => top + (v1 - v) * sy;

  const lines = [];
  lines.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#f4efe6"/>`,
    `<rect x="${left}" y="${top}" width="${innerW}" height="${innerH}" fill="#efe8dc" stroke="#1a1a1a" stroke-width="2"/>`,
  );

  for (let u = u0; u <= u1 + 1e-9; u += minor) {
    const majorLine = Math.abs(u / major - Math.round(u / major)) < 1e-6;
    const x = X(u);
    lines.push(
      `<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${top + innerH}" stroke="${
        Math.abs(u) < 1e-9 ? "#e03131" : majorLine ? "#c4b8a4" : "#ddd4c6"
      }" stroke-width="${Math.abs(u) < 1e-9 ? 2 : majorLine ? 1 : 0.6}"/>`,
    );
  }
  for (let v = v0; v <= v1 + 1e-9; v += minor) {
    const majorLine = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const y = Y(v);
    lines.push(
      `<line x1="${left}" y1="${y.toFixed(1)}" x2="${left + innerW}" y2="${y.toFixed(1)}" stroke="${
        Math.abs(v) < 1e-9 ? "#339af0" : majorLine ? "#c4b8a4" : "#ddd4c6"
      }" stroke-width="${Math.abs(v) < 1e-9 ? 2 : majorLine ? 1 : 0.6}"/>`,
    );
  }

  for (let u = u0; u <= u1 + 1e-9; u += major) {
    lines.push(
      `<text x="${X(u).toFixed(1)}" y="${top + innerH + 16}" text-anchor="middle" font-size="11" font-family="ui-monospace,monospace" fill="#1a1a1a">${fmt(u, major < 1 ? 2 : 0)}</text>`,
    );
  }
  for (let v = v0; v <= v1 + 1e-9; v += major) {
    lines.push(
      `<text x="${left - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" font-family="ui-monospace,monospace" fill="#1a1a1a">${fmt(v, major < 1 ? 2 : 0)}</text>`,
    );
  }

  for (const line of polylines) {
    const d = line.pts.map((p, i) => `${i === 0 ? "M" : "L"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
    lines.push(
      `<path d="${d}" fill="none" stroke="${line.color ?? "#1a1a1a"}" stroke-width="${line.width ?? 2.5}" stroke-linejoin="round"/>`,
    );
  }

  for (const it of items) {
    const x = X(Math.min(it.umin, it.umax));
    const y = Y(Math.max(it.vmin, it.vmax));
    const w = Math.abs(X(it.umax) - X(it.umin));
    const h = Math.abs(Y(it.vmax) - Y(it.vmin));
    const fill = it.fill ?? "#f08c0033";
    const stroke = it.stroke ?? "#f08c00";
    lines.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(w, 2).toFixed(1)}" height="${Math.max(h, 2).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`,
    );
    const lx = X((it.umin + it.umax) / 2);
    const ly = Y((it.vmin + it.vmax) / 2);
    lines.push(
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="10" font-family="ui-sans-serif,sans-serif" font-weight="700" fill="#1a1a1a">${xmlEscape(it.name)}</text>`,
    );
  }

  for (const p of points) {
    const x = X(p.u);
    const y = Y(p.v);
    const c = p.color ?? "#12b886";
    lines.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${c}" stroke="#1a1a1a" stroke-width="1.2"/>`,
      `<text x="${(x + 7).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-size="10" font-family="ui-sans-serif,sans-serif" font-weight="700" fill="#1a1a1a">${xmlEscape(p.name)}</text>`,
    );
  }

  lines.push(
    `<text x="${width / 2}" y="22" text-anchor="middle" font-size="14" font-family="ui-sans-serif,sans-serif" font-weight="800" fill="#1a1a1a">${xmlEscape(title)}</text>`,
    `<text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="11" font-family="ui-sans-serif,sans-serif" fill="#5c564c">${xmlEscape(uLabel)} → right · ${xmlEscape(vLabel)} → up · origin = red (${uLabel}) / blue (${vLabel}) · meters</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${lines.join("\n")}\n</svg>`;
}

export function nodesToGridItems(nodes, uIdx, vIdx) {
  const items = [];
  for (const n of nodes) {
    if (!n.aabb) continue;
    if (!n.mesh) continue;
    items.push({
      name: n.name,
      umin: n.aabb.min[uIdx],
      umax: n.aabb.max[uIdx],
      vmin: n.aabb.min[vIdx],
      vmax: n.aabb.max[vIdx],
    });
  }
  return items;
}

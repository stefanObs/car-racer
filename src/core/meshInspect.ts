/** Dev F6 mesh studio — hits in car mesh space (cheat-sheet meters). */

export type MeshInspectHit = {
  name: string;
  x: number;
  y: number;
  z: number;
  id?: string;
  parentId?: string;
};

export type MeshInspectSelection = {
  name: string;
  id: string;
  x: number;
  y: number;
  z: number;
  kind?: "object" | "edge";
  yaw?: number;
  pitch?: number;
  roll?: number;
  sx?: number;
  sy?: number;
  sz?: number;
};

export type MeshInspectPointerKind = "orbit" | "copy" | "menu" | "selectOrMove" | "paintBox" | "resizeBox" | "ignore";

export type MeshInspectBoxFace = "minX" | "maxX" | "minY" | "maxY" | "minZ" | "maxZ";

/** One AABB corner: the three faces that meet there. */
export type MeshInspectBoxCorner = {
  id: string;
  faces: readonly [MeshInspectBoxFace, MeshInspectBoxFace, MeshInspectBoxFace];
};

function boxCorner(
  x: "minX" | "maxX",
  y: "minY" | "maxY",
  z: "minZ" | "maxZ",
): MeshInspectBoxCorner {
  return { id: `${x}-${y}-${z}`, faces: [x, y, z] };
}

/** 8 corners — dots live here so they stay visible outside the car. */
export const MESH_INSPECT_BOX_CORNERS: readonly MeshInspectBoxCorner[] = [
  boxCorner("minX", "minY", "minZ"),
  boxCorner("minX", "minY", "maxZ"),
  boxCorner("minX", "maxY", "minZ"),
  boxCorner("minX", "maxY", "maxZ"),
  boxCorner("maxX", "minY", "minZ"),
  boxCorner("maxX", "minY", "maxZ"),
  boxCorner("maxX", "maxY", "minZ"),
  boxCorner("maxX", "maxY", "maxZ"),
];

export const MESH_INSPECT_BOX_MIN_SIZE = 0.01;

export type MeshInspectDragMode = "free" | "keepY" | "onlyY";

export type MeshInspectTool = "move" | "rotate" | "scaleUniform" | "scaleFree";

export type MeshInspectComponent = "object" | "edge";

/** F6 LMB on the car: turntable, or screen-roll onto a side. */
export type MeshInspectOrbitMode = "turn" | "roll";

export function meshInspectOrbitModeFromValue(raw: string | undefined | null): MeshInspectOrbitMode | null {
  if (raw === "turn" || raw === "roll") return raw;
  return null;
}

export type MeshInspectVec3 = { x: number; y: number; z: number };

/** Mesh-space AABB from a painted screen rectangle (nearest hits). */
export type MeshInspectBox = {
  min: MeshInspectVec3;
  max: MeshInspectVec3;
  names: string[];
};

export type MeshInspectScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** Named node in the F5 catalog — pick internals the ray cannot see. */
export type MeshInspectCatalogEntry = {
  id: string;
  name: string;
  depth: number;
};

export const MESH_INSPECT_DECIMALS = 3;
export const MESH_INSPECT_DRAG_PX = 4;
export const MESH_INSPECT_NUDGE = 0.05;
export const MESH_INSPECT_NUDGE_FINE = 0.01;
export const MESH_INSPECT_NUDGE_COARSE = 0.25;
export const MESH_INSPECT_ROTATE = (5 * Math.PI) / 180;
export const MESH_INSPECT_ROTATE_FINE = Math.PI / 180;
export const MESH_INSPECT_ROTATE_COARSE = (15 * Math.PI) / 180;
export const MESH_INSPECT_ROTATE_PX = 0.008;
export const MESH_INSPECT_SCALE_PX = 0.008;
export const MESH_INSPECT_SCALE_MIN = 0.05;
export const MESH_INSPECT_SCALE_MAX = 20;
export const MESH_INSPECT_SCALE = 1.05;
export const MESH_INSPECT_SCALE_FINE = 1.01;
export const MESH_INSPECT_SCALE_COARSE = 1.15;
export const MESH_INSPECT_BOX_SAMPLE = 16;
export const MESH_INSPECT_BOX_HANDLE_RADIUS = 0.07;
/** Screen-space grab radius around each corner dot (px). */
export const MESH_INSPECT_BOX_HANDLE_PX = 22;

export function formatMeshInspectCoord(n: number, digits = MESH_INSPECT_DECIMALS): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(digits);
}

export function formatMeshInspectLine(
  hit: {
    name: string;
    x: number;
    y: number;
    z: number;
    kind?: "object" | "edge";
    yaw?: number;
    sx?: number;
    sy?: number;
    sz?: number;
  },
  digits = MESH_INSPECT_DECIMALS,
): string {
  const xyz = `${hit.name}  ${formatMeshInspectCoord(hit.x, digits)}, ${formatMeshInspectCoord(hit.y, digits)}, ${formatMeshInspectCoord(hit.z, digits)}`;
  const labeled = hit.kind === "edge" ? `Kante ${xyz}` : xyz;
  const withYaw =
    typeof hit.yaw === "number" ? `${labeled}  yaw ${formatMeshInspectCoord(hit.yaw, 1)}°` : labeled;
  if (typeof hit.sx !== "number") return withYaw;
  const sx = hit.sx;
  const sy = hit.sy ?? sx;
  const sz = hit.sz ?? sx;
  const uniform = Math.abs(sx - sy) < 0.005 && Math.abs(sx - sz) < 0.005;
  const scale = uniform
    ? `×${formatMeshInspectCoord(sx, 2)}`
    : `×${formatMeshInspectCoord(sx, 2)}, ${formatMeshInspectCoord(sy, 2)}, ${formatMeshInspectCoord(sz, 2)}`;
  return `${withYaw}  ${scale}`;
}

/** Panel / clipboard body: one named element per line, nearest first. */
export function formatMeshInspectLines(hits: readonly MeshInspectHit[]): string {
  if (hits.length === 0) return "(nichts)";
  return hits.map((hit) => formatMeshInspectLine(hit)).join("\n");
}

export function formatMeshInspectClipboard(
  hits: readonly MeshInspectHit[],
  selection?: MeshInspectSelection | null,
): string {
  if (selection) return `Mesh-Raum (m)\n${formatMeshInspectLine(selection)}`;
  return `Mesh-Raum (m)\n${formatMeshInspectLines(hits)}`;
}

export function meshInspectBoxCenter(box: MeshInspectBox): MeshInspectVec3 {
  return {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
}

export function meshInspectBoxSize(box: MeshInspectBox): MeshInspectVec3 {
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  };
}

export function formatMeshInspectBox(box: MeshInspectBox, digits = MESH_INSPECT_DECIMALS): string {
  const min = `${formatMeshInspectCoord(box.min.x, digits)}, ${formatMeshInspectCoord(box.min.y, digits)}, ${formatMeshInspectCoord(box.min.z, digits)}`;
  const max = `${formatMeshInspectCoord(box.max.x, digits)}, ${formatMeshInspectCoord(box.max.y, digits)}, ${formatMeshInspectCoord(box.max.z, digits)}`;
  const c = meshInspectBoxCenter(box);
  const s = meshInspectBoxSize(box);
  const center = `${formatMeshInspectCoord(c.x, digits)}, ${formatMeshInspectCoord(c.y, digits)}, ${formatMeshInspectCoord(c.z, digits)}`;
  const size = `${formatMeshInspectCoord(s.x, digits)}, ${formatMeshInspectCoord(s.y, digits)}, ${formatMeshInspectCoord(s.z, digits)}`;
  const lines = [
    "Mesh-Raum Kasten (m)",
    `min: ${min}`,
    `max: ${max}`,
    `center: ${center}`,
    `size: ${size}`,
  ];
  if (box.names.length > 0) lines.push(`Teile: ${box.names.join(", ")}`);
  return lines.join("\n");
}

export function listedMeshInspectBoxes(
  locked: readonly MeshInspectBox[],
  active: MeshInspectBox | null,
): MeshInspectBox[] {
  return active ? [...locked, active] : [...locked];
}

/** Several Kastens for copy/panel. Last is the editable one. */
export function formatMeshInspectBoxes(boxes: readonly MeshInspectBox[]): string {
  if (boxes.length === 0) return "";
  if (boxes.length === 1) return formatMeshInspectBox(boxes[0]!);
  return boxes
    .map((box, i) => {
      const tag = i === boxes.length - 1 ? `#${i + 1} (edit)` : `#${i + 1}`;
      return `${tag}\n${formatMeshInspectBox(box)}`;
    })
    .join("\n\n");
}

/** Inclusive AABB test in mesh-space meters. */
export function meshInspectBoxContains(
  box: Pick<MeshInspectBox, "min" | "max">,
  p: MeshInspectVec3,
  eps = 0,
): boolean {
  return (
    p.x + eps >= box.min.x &&
    p.x - eps <= box.max.x &&
    p.y + eps >= box.min.y &&
    p.y - eps <= box.max.y &&
    p.z + eps >= box.min.z &&
    p.z - eps <= box.max.z
  );
}

export function normalizeMeshInspectScreenRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): MeshInspectScreenRect {
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
  };
}

export function meshInspectScreenRectStyle(rect: MeshInspectScreenRect): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
  };
}

export function meshInspectBoxSamplePoints(
  rect: MeshInspectScreenRect,
  cols = MESH_INSPECT_BOX_SAMPLE,
  rows = MESH_INSPECT_BOX_SAMPLE,
): { x: number; y: number }[] {
  const nx = Math.max(1, cols);
  const ny = Math.max(1, rows);
  const out: { x: number; y: number }[] = [];
  for (let row = 0; row < ny; row++) {
    const v = ny === 1 ? 0.5 : row / (ny - 1);
    for (let col = 0; col < nx; col++) {
      const u = nx === 1 ? 0.5 : col / (nx - 1);
      out.push({
        x: rect.left + u * (rect.right - rect.left),
        y: rect.top + v * (rect.bottom - rect.top),
      });
    }
  }
  return out;
}

export function meshInspectBoxFromPoints(
  points: readonly MeshInspectVec3[],
  names: readonly string[] = [],
): MeshInspectBox | null {
  if (points.length === 0) return null;
  const min = { x: points[0]!.x, y: points[0]!.y, z: points[0]!.z };
  const max = { x: points[0]!.x, y: points[0]!.y, z: points[0]!.z };
  for (const p of points) {
    if (p.x < min.x) min.x = p.x;
    if (p.y < min.y) min.y = p.y;
    if (p.z < min.z) min.z = p.z;
    if (p.x > max.x) max.x = p.x;
    if (p.y > max.y) max.y = p.y;
    if (p.z > max.z) max.z = p.z;
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    unique.push(name);
  }
  return { min, max, names: unique };
}

export function collectMeshInspectBox(
  samples: readonly { x: number; y: number }[],
  pick: (x: number, y: number) => { x: number; y: number; z: number; name: string } | null,
): MeshInspectBox | null {
  const points: MeshInspectVec3[] = [];
  const names: string[] = [];
  for (const sample of samples) {
    const hit = pick(sample.x, sample.y);
    if (!hit) continue;
    points.push(hit);
    names.push(hit.name);
  }
  return meshInspectBoxFromPoints(points, names);
}

export function meshInspectBoxCornerLocal(box: MeshInspectBox, corner: MeshInspectBoxCorner): MeshInspectVec3 {
  const p = { x: 0, y: 0, z: 0 };
  for (const face of corner.faces) {
    const axis = meshInspectBoxResizeAxis(face);
    p[axis] = face.startsWith("min") ? box.min[axis] : box.max[axis];
  }
  return p;
}

export function meshInspectBoxResizeAxis(face: MeshInspectBoxFace): "x" | "y" | "z" {
  if (face === "minX" || face === "maxX") return "x";
  if (face === "minY" || face === "maxY") return "y";
  return "z";
}

export function meshInspectBoxCornerFromKey(raw: string | undefined | null): MeshInspectBoxCorner | null {
  if (!raw) return null;
  return MESH_INSPECT_BOX_CORNERS.find((corner) => corner.id === raw) ?? null;
}

/** Move one AABB face in mesh space; keeps a minimum size. */
export function resizeMeshInspectBox(
  box: MeshInspectBox,
  face: MeshInspectBoxFace,
  meshDelta: MeshInspectVec3,
  minSize = MESH_INSPECT_BOX_MIN_SIZE,
): MeshInspectBox {
  const min = { ...box.min };
  const max = { ...box.max };
  const axis = meshInspectBoxResizeAxis(face);
  const d = meshDelta[axis];
  if (face.startsWith("min")) {
    min[axis] = Math.min(max[axis] - minSize, min[axis] + d);
  } else {
    max[axis] = Math.max(min[axis] + minSize, max[axis] + d);
  }
  return { min, max, names: box.names };
}

/** Drag a corner: move the three faces that meet there. */
export function resizeMeshInspectBoxByCorner(
  box: MeshInspectBox,
  corner: MeshInspectBoxCorner,
  meshDelta: MeshInspectVec3,
  minSize = MESH_INSPECT_BOX_MIN_SIZE,
): MeshInspectBox {
  let next = box;
  for (const face of corner.faces) {
    next = resizeMeshInspectBox(next, face, meshDelta, minSize);
  }
  return next;
}

export function cloneMeshInspectBox(box: MeshInspectBox): MeshInspectBox {
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
    names: [...box.names],
  };
}

/** Lock the current Kasten and make `next` the only editable one. */
export function pushActiveMeshInspectBox(
  locked: readonly MeshInspectBox[],
  active: MeshInspectBox | null,
  next: MeshInspectBox,
): { locked: MeshInspectBox[]; active: MeshInspectBox } {
  const nextLocked = active ? [...locked, cloneMeshInspectBox(active)] : [...locked];
  return { locked: nextLocked, active: cloneMeshInspectBox(next) };
}

/** Drop the last Kasten; the previous locked one becomes editable. */
export function popActiveMeshInspectBox(
  locked: readonly MeshInspectBox[],
  active: MeshInspectBox | null,
): { locked: MeshInspectBox[]; active: MeshInspectBox | null } {
  const stack = listedMeshInspectBoxes(locked, active);
  if (stack.length <= 1) return { locked: [], active: null };
  const remaining = stack.slice(0, -1);
  const prev = remaining[remaining.length - 1]!;
  return {
    locked: remaining.slice(0, -1).map(cloneMeshInspectBox),
    active: cloneMeshInspectBox(prev),
  };
}

export function meshInspectBoxChanged(a: MeshInspectBox, b: MeshInspectBox, eps = 5e-4): boolean {
  return (
    Math.abs(a.min.x - b.min.x) > eps ||
    Math.abs(a.min.y - b.min.y) > eps ||
    Math.abs(a.min.z - b.min.z) > eps ||
    Math.abs(a.max.x - b.max.x) > eps ||
    Math.abs(a.max.y - b.max.y) > eps ||
    Math.abs(a.max.z - b.max.z) > eps
  );
}

export const MESH_INSPECT_PATCH_HEADER = "CRASH CIRCUIT F5 PATCH v1";
export const MESH_INSPECT_PATCH_VERT_CAP = 80;
const POSE_POS_EPS = 5e-4;
const POSE_ANG_EPS = 0.05;
const POSE_SCALE_EPS = 5e-4;

export type MeshInspectPoseSnap = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  sx: number;
  sy: number;
  sz: number;
};

export type MeshInspectPatchVert = { i: number; x: number; y: number; z: number };

export type MeshInspectPatchApply = "glb-node" | "mount";

export type MeshInspectPatchNode = {
  name: string;
  path: string;
  file: string;
  apply: MeshInspectPatchApply;
  partId?: string;
  sameNameIndex?: number;
  from: MeshInspectPoseSnap;
  to: MeshInspectPoseSnap;
  verts?: MeshInspectPatchVert[];
  vertsTruncated?: number;
};

export type MeshInspectPatch = {
  car: string;
  nodes: MeshInspectPatchNode[];
};

export function meshInspectPoseChanged(a: MeshInspectPoseSnap, b: MeshInspectPoseSnap): boolean {
  if (Math.abs(a.x - b.x) > POSE_POS_EPS || Math.abs(a.y - b.y) > POSE_POS_EPS || Math.abs(a.z - b.z) > POSE_POS_EPS) {
    return true;
  }
  if (Math.abs(a.yaw - b.yaw) > POSE_ANG_EPS || Math.abs(a.pitch - b.pitch) > POSE_ANG_EPS || Math.abs(a.roll - b.roll) > POSE_ANG_EPS) {
    return true;
  }
  return Math.abs(a.sx - b.sx) > POSE_SCALE_EPS || Math.abs(a.sy - b.sy) > POSE_SCALE_EPS || Math.abs(a.sz - b.sz) > POSE_SCALE_EPS;
}

export function carPartIdFromObjectName(name: string): string | null {
  const leaf = name.split(" / ").at(-1)?.trim() ?? name;
  const m = /^carPart-([a-z0-9_]+?)(?:-\d+)?$/.exec(leaf);
  return m?.[1] ?? null;
}

/** `carParts / carPart-rear_spoiler / tripo_node_…` → `rear_spoiler`. */
export function carPartIdFromNodePath(path: string, name = ""): string | null {
  for (const seg of `${path} / ${name}`.split(" / ")) {
    const id = carPartIdFromObjectName(seg.trim());
    if (id) return id;
  }
  return null;
}

function formatSnapVec(a: MeshInspectPoseSnap): string {
  return `${formatMeshInspectCoord(a.x)}, ${formatMeshInspectCoord(a.y)}, ${formatMeshInspectCoord(a.z)}`;
}

function formatSnapScale(a: MeshInspectPoseSnap): string {
  return `${formatMeshInspectCoord(a.sx, 3)}, ${formatMeshInspectCoord(a.sy, 3)}, ${formatMeshInspectCoord(a.sz, 3)}`;
}

function formatDeg(n: number): string {
  return formatMeshInspectCoord(n, 1);
}

export function formatMeshInspectPatch(patch: MeshInspectPatch): string {
  const lines = [
    MESH_INSPECT_PATCH_HEADER,
    "instruction: Bake each node's `to` pose into `file`. Run npm run mesh:apply-f5-patch -- <this-file> then npm run docs:cheatsheets.",
    `car: ${patch.car}`,
  ];
  for (const node of patch.nodes) {
    lines.push("");
    lines.push(`node: ${node.name}`);
    lines.push(`path: ${node.path}`);
    lines.push(`file: ${node.file}`);
    lines.push(`apply: ${node.apply}`);
    if (node.partId) lines.push(`part: ${node.partId}`);
    if (typeof node.sameNameIndex === "number") lines.push(`index: ${node.sameNameIndex}`);
    lines.push(`origin: ${formatSnapVec(node.from)} -> ${formatSnapVec(node.to)}`);
    lines.push(`yaw: ${formatDeg(node.from.yaw)} -> ${formatDeg(node.to.yaw)}`);
    lines.push(`pitch: ${formatDeg(node.from.pitch)} -> ${formatDeg(node.to.pitch)}`);
    lines.push(`roll: ${formatDeg(node.from.roll)} -> ${formatDeg(node.to.roll)}`);
    lines.push(`scale: ${formatSnapScale(node.from)} -> ${formatSnapScale(node.to)}`);
    if (node.vertsTruncated) lines.push(`vertsChanged: ${node.vertsTruncated} (truncated)`);
    for (const v of node.verts ?? []) {
      lines.push(
        `vert: ${v.i} = ${formatMeshInspectCoord(v.x)}, ${formatMeshInspectCoord(v.y)}, ${formatMeshInspectCoord(v.z)}`,
      );
    }
  }
  return lines.join("\n");
}

function splitArrow(raw: string): [string, string] {
  const i = raw.indexOf("->");
  if (i < 0) return [raw.trim(), raw.trim()];
  return [raw.slice(0, i).trim(), raw.slice(i + 2).trim()];
}

function parseVec3(raw: string): { x: number; y: number; z: number } {
  const p = raw.split(",").map((s) => Number(s.trim()));
  return { x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 };
}

function emptySnap(): MeshInspectPoseSnap {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1, sz: 1 };
}

export function parseMeshInspectPatch(text: string): MeshInspectPatch | null {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.trim().startsWith(MESH_INSPECT_PATCH_HEADER)) return null;
  const patch: MeshInspectPatch = { car: "", nodes: [] };
  let cur: MeshInspectPatchNode | null = null;
  const flush = (): void => {
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
      cur = {
        name: val,
        path: val,
        file: "",
        apply: "glb-node",
        from: emptySnap(),
        to: emptySnap(),
      };
      continue;
    }
    if (!cur) continue;
    if (key === "path") cur.path = val;
    else if (key === "file") cur.file = val;
    else if (key === "apply") cur.apply = val === "mount" ? "mount" : "glb-node";
    else if (key === "part") cur.partId = val;
    else if (key === "index") cur.sameNameIndex = Number(val);
    else if (key === "origin") {
      const [a, b] = splitArrow(val);
      const from = parseVec3(a);
      const to = parseVec3(b);
      cur.from.x = from.x;
      cur.from.y = from.y;
      cur.from.z = from.z;
      cur.to.x = to.x;
      cur.to.y = to.y;
      cur.to.z = to.z;
    } else if (key === "yaw" || key === "pitch" || key === "roll") {
      const [a, b] = splitArrow(val);
      cur.from[key] = Number(a);
      cur.to[key] = Number(b);
    } else if (key === "scale") {
      const [a, b] = splitArrow(val);
      const from = parseVec3(a);
      const to = parseVec3(b);
      cur.from.sx = from.x;
      cur.from.sy = from.y;
      cur.from.sz = from.z;
      cur.to.sx = to.x;
      cur.to.sy = to.y;
      cur.to.sz = to.z;
    } else if (key === "vertsChanged") {
      cur.vertsTruncated = Number(val);
    } else if (key === "vert") {
      const eq = val.indexOf("=");
      if (eq < 0) continue;
      const i = Number(val.slice(0, eq).trim());
      const p = parseVec3(val.slice(eq + 1));
      cur.verts = cur.verts ?? [];
      cur.verts.push({ i, x: p.x, y: p.y, z: p.z });
    }
  }
  flush();
  if (!patch.car || patch.nodes.length === 0) return null;
  return patch;
}

export function meshInspectPointerAction(
  button: number,
  opts?: {
    edit?: boolean;
    altKey?: boolean;
    boxPaint?: boolean;
    hasBox?: boolean;
    hitHandle?: boolean;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    orbitMode?: MeshInspectOrbitMode;
  },
): MeshInspectPointerKind {
  if (button === 2) return "menu";
  if (button === 1) return "orbit";
  if (button !== 0) return "ignore";
  if (opts?.hitHandle) return "resizeBox";
  if (opts?.boxPaint && opts.shiftKey) return "paintBox";
  if (opts?.orbitMode === "roll" || opts?.altKey || opts?.ctrlKey) return "orbit";
  if (opts?.boxPaint && (!opts.hasBox || opts.shiftKey)) return "paintBox";
  if (opts?.boxPaint && opts.hasBox) return "orbit";
  if (opts?.edit) return "selectOrMove";
  return "orbit";
}

export function meshInspectDragExceeded(
  dx: number,
  dy: number,
  threshold = MESH_INSPECT_DRAG_PX,
): boolean {
  return dx * dx + dy * dy >= threshold * threshold;
}

export function meshInspectDragMode(mods: { shift?: boolean; ctrl?: boolean }): MeshInspectDragMode {
  if (mods.ctrl) return "onlyY";
  if (mods.shift) return "keepY";
  return "free";
}

export function meshInspectNudgeStep(mods: { shift?: boolean; ctrl?: boolean }): number {
  if (mods.ctrl) return MESH_INSPECT_NUDGE_COARSE;
  if (mods.shift) return MESH_INSPECT_NUDGE_FINE;
  return MESH_INSPECT_NUDGE;
}

/** Mesh-space nudge: arrows XZ (up = +Z), PageUp/Down = Y. */
export function meshInspectNudgeDelta(
  code: string,
  mods: { shift?: boolean; ctrl?: boolean },
): { x: number; y: number; z: number } | null {
  const step = meshInspectNudgeStep(mods);
  switch (code) {
    case "ArrowLeft":
      return { x: -step, y: 0, z: 0 };
    case "ArrowRight":
      return { x: step, y: 0, z: 0 };
    case "ArrowUp":
      return { x: 0, y: 0, z: step };
    case "ArrowDown":
      return { x: 0, y: 0, z: -step };
    case "PageUp":
      return { x: 0, y: step, z: 0 };
    case "PageDown":
      return { x: 0, y: -step, z: 0 };
    default:
      return null;
  }
}

export function meshInspectWantParent(mods: { shift?: boolean; ctrl?: boolean; meta?: boolean }): boolean {
  return Boolean(mods.shift);
}

export function meshInspectRotateStep(mods: { shift?: boolean; ctrl?: boolean }): number {
  if (mods.ctrl) return MESH_INSPECT_ROTATE_COARSE;
  if (mods.shift) return MESH_INSPECT_ROTATE_FINE;
  return MESH_INSPECT_ROTATE;
}

/** [ ] or , . yaw the whole mesh in mesh space. */
export function meshInspectYawDelta(
  code: string,
  mods: { shift?: boolean; ctrl?: boolean },
): number | null {
  const step = meshInspectRotateStep(mods);
  switch (code) {
    case "BracketLeft":
    case "Comma":
      return step;
    case "BracketRight":
    case "Period":
      return -step;
    default:
      return null;
  }
}

export function meshInspectToolFromKey(code: string): MeshInspectTool | null {
  if (code === "KeyG") return "move";
  if (code === "KeyR") return "rotate";
  if (code === "KeyS") return "scaleUniform";
  if (code === "KeyX") return "scaleFree";
  return null;
}

export function meshInspectComponentFromKey(code: string): MeshInspectComponent | null {
  if (code === "Digit1" || code === "KeyO") return "object";
  if (code === "Digit2" || code === "KeyK") return "edge";
  return null;
}

/** Esc: drop painted box, then box tool, then edge, then object, then place mode, then F6. */
export function meshInspectEscapeStep(opts: {
  hasEdge?: boolean;
  hasSelection: boolean;
  edit: boolean;
  boxPaint?: boolean;
  hasBox?: boolean;
}): "clearBox" | "leaveBoxPaint" | "clearEdge" | "clearSelection" | "leaveEdit" | "leaveStudio" {
  if (opts.boxPaint && opts.hasBox) return "clearBox";
  if (opts.boxPaint) return "leaveBoxPaint";
  if (opts.hasEdge) return "clearEdge";
  if (opts.hasSelection) return "clearSelection";
  if (opts.edit) return "leaveEdit";
  return "leaveStudio";
}

export function meshInspectGestureAfterDrag(opts: {
  edit: boolean;
  hasSelection: boolean;
  hitIsSelection: boolean;
  hitEmpty: boolean;
  tool?: MeshInspectTool;
  hasEdge?: boolean;
  boxPaint?: boolean;
  hasBox?: boolean;
  hitHandle?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  orbitMode?: MeshInspectOrbitMode;
}): "move" | "rotate" | "moveEdge" | "scaleUniform" | "scaleFree" | "paintBox" | "resizeBox" | "orbit" {
  if (opts.hitHandle) return "resizeBox";
  if (opts.boxPaint && opts.shiftKey) return "paintBox";
  if (opts.orbitMode === "roll" || opts.ctrlKey || opts.altKey) return "orbit";
  if (opts.boxPaint && (!opts.hasBox || opts.shiftKey)) return "paintBox";
  if (opts.boxPaint && opts.hasBox) return "orbit";
  if (!(opts.edit && opts.hasSelection && opts.hitIsSelection)) return "orbit";
  if (opts.tool === "scaleUniform") return "scaleUniform";
  if (opts.tool === "scaleFree") return "scaleFree";
  if (opts.hasEdge && opts.tool !== "rotate") return "moveEdge";
  if (opts.tool === "rotate") return "rotate";
  return "move";
}

export function meshInspectScaleStep(mods: { shift?: boolean; ctrl?: boolean }): number {
  if (mods.ctrl) return MESH_INSPECT_SCALE_COARSE;
  if (mods.shift) return MESH_INSPECT_SCALE_FINE;
  return MESH_INSPECT_SCALE;
}

/** + / − grow or shrink while keeping the current ratio. */
export function meshInspectScaleFactor(code: string, mods: { shift?: boolean; ctrl?: boolean }): number | null {
  const step = meshInspectScaleStep(mods);
  switch (code) {
    case "Equal":
    case "NumpadAdd":
      return step;
    case "Minus":
    case "NumpadSubtract":
      return 1 / step;
    default:
      return null;
  }
}

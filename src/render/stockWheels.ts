import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Object3D,
  Vector3,
  type BufferGeometry as BuffGeo,
} from "three";

/** Prefixed stock tire meshes split out of Tripo body GLBs. */
export const STOCK_WHEEL_PREFIX = "StockWheel_";

export type WheelCorner = "FL" | "FR" | "RL" | "RR";

const CORNERS: WheelCorner[] = ["FL", "FR", "RL", "RR"];

export function stockWheelName(corner: WheelCorner): string {
  return `${STOCK_WHEEL_PREFIX}${corner}`;
}

export function isStockWheelObject(obj: Object3D): boolean {
  return obj.name.startsWith(STOCK_WHEEL_PREFIX) || obj.userData.isStockWheel === true;
}

/** Top-level `StockWheel_FL|FR|RL|RR` — not GLTF primitive children (`…_1`). */
export function isStockWheelRoot(obj: Object3D): boolean {
  if (!isStockWheelObject(obj)) return false;
  const parent = obj.parent;
  return !parent || !isStockWheelObject(parent);
}

function cornerOf(x: number, z: number): WheelCorner {
  const left = x < 0;
  const front = z >= 0;
  if (front) return left ? "FL" : "FR";
  return left ? "RL" : "RR";
}

function isWheelishCentroid(
  x: number,
  y: number,
  z: number,
  minY: number,
  maxY: number,
  maxAbsX: number,
): boolean {
  const height = Math.max(0.01, maxY - minY);
  // Tight band: only low outboard axle pockets — not door / rocker panels.
  const low = y <= minY + height * 0.28;
  const outboard = Math.abs(x) >= maxAbsX * 0.68;
  const front = z >= 0.85;
  const rear = z <= -0.85;
  return low && outboard && (front || rear) && y >= minY - 0.02;
}

type Tri = { i0: number; i1: number; i2: number };

/** Authored / previously extracted tire meshes already present on the car. */
export function hasAuthoredStockWheels(root: Object3D): boolean {
  let found = false;
  root.traverse((obj) => {
    if (found) return;
    if (isStockWheelObject(obj)) found = true;
  });
  return found;
}

const SKIP_WHEEL_EXTRACT = new Set(["StockEngine", "StockCage"]);

/**
 * Split low outboard wheel-arch triangles off each mesh into `StockWheel_*` children
 * so big_wheels can hide stock tires and mount replacements.
 * Skips when the GLB already ships StockWheel_* (e.g. Käferkraft bake).
 */
export function extractStockWheels(root: Object3D): void {
  if (root.userData.stockWheelsExtracted) return;
  root.userData.stockWheelsExtracted = true;
  if (hasAuthoredStockWheels(root)) return;

  root.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (isStockWheelObject(mesh)) return;
    if (SKIP_WHEEL_EXTRACT.has(mesh.name)) return;
    meshes.push(mesh);
  });

  for (const mesh of meshes) {
    splitOneMesh(mesh, root);
  }
}

export type StockWheelScaleOpts = {
  /** Scale along the axle (tire width). Defaults to `scale` (uniform). */
  widthScale?: number;
  /**
   * Shift hubs outboard so extra width does not grow into the body.
   * Skipped when the wheel is already parented under `WheelSpin_*`.
   */
  outboardShift?: number;
};

const _axleSize = new Vector3();
const _axleBox = new Box3();

/**
 * Thinnest **geometry** AABB axis (ignores object.scale) = axle.
 * Blitz/Bison bake thin on X; Käferkraft thin on Z.
 */
export function stockWheelAxleAxis(obj: Object3D): 0 | 1 | 2 {
  _axleBox.makeEmpty();
  let any = false;
  obj.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    if (!any) {
      _axleBox.copy(bb);
      any = true;
    } else {
      _axleBox.union(bb);
    }
  });
  if (!any) return 0;
  _axleBox.getSize(_axleSize);
  const x = Math.max(_axleSize.x, 1e-4);
  const y = Math.max(_axleSize.y, 1e-4);
  const z = Math.max(_axleSize.z, 1e-4);
  if (x <= y && x <= z) return 0;
  if (y <= x && y <= z) return 1;
  return 2;
}

function stockWheelOutboardSign(name: string): 1 | -1 {
  const corner = name.startsWith(STOCK_WHEEL_PREFIX) ? name.slice(STOCK_WHEEL_PREFIX.length) : name;
  return corner.startsWith("FL") || corner.startsWith("RL") ? -1 : 1;
}

/**
 * Scale about each tire's local origin (bake recenters geometry).
 * Uniform `scale` grows the disk; `widthScale` (default = scale) stretches the
 * axle so Große Räder can go wider without a larger diameter.
 * Optional `hubDropY` lowers hubs so radial growth goes into the ground /
 * stance lift instead of up into fenders (caller restores drop=0 when scale
 * returns to 1). Only root StockWheel_* nodes are scaled — nested primitive
 * meshes inherit.
 */
export function applyStockWheelScale(
  root: Object3D,
  scale: number,
  hubDropY = 0,
  opts?: StockWheelScaleOpts,
): void {
  const widthScale = opts?.widthScale ?? scale;
  const outboardShift = opts?.outboardShift ?? 0;
  root.traverse((obj) => {
    if (!isStockWheelRoot(obj)) return;
    if (typeof obj.userData.stockWheelBaseY !== "number") {
      obj.userData.stockWheelBaseY = obj.position.y;
    }
    if (typeof obj.userData.stockWheelBaseX !== "number") {
      obj.userData.stockWheelBaseX = obj.position.x;
    }
    if (typeof obj.userData.stockWheelBaseZ !== "number") {
      obj.userData.stockWheelBaseZ = obj.position.z;
    }
    const axis = widthScale === scale ? 0 : stockWheelAxleAxis(obj);
    if (widthScale === scale) {
      obj.scale.setScalar(scale);
    } else {
      obj.scale.set(
        axis === 0 ? widthScale : scale,
        axis === 1 ? widthScale : scale,
        axis === 2 ? widthScale : scale,
      );
    }
    obj.position.y = obj.userData.stockWheelBaseY - hubDropY;
    const mounted = obj.parent?.name.startsWith("WheelSpin_");
    if (mounted) return;
    const side = stockWheelOutboardSign(obj.name);
    const dx = axis === 0 ? side * outboardShift : 0;
    const dz = axis === 2 ? side * outboardShift : 0;
    obj.position.x = obj.userData.stockWheelBaseX + dx;
    obj.position.z = obj.userData.stockWheelBaseZ + dz;
  });
}

function splitOneMesh(mesh: Mesh, root: Object3D): void {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos || pos.count < 9) return;

  mesh.updateWorldMatrix(true, false);
  const invRoot = root.matrixWorld.clone().invert();
  const local = mesh.matrixWorld.clone().premultiply(invRoot);

  const tmp = new Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  let maxAbsX = 0;
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i).applyMatrix4(local);
    minY = Math.min(minY, tmp.y);
    maxY = Math.max(maxY, tmp.y);
    maxAbsX = Math.max(maxAbsX, Math.abs(tmp.x));
  }
  if (!Number.isFinite(minY) || maxAbsX < 0.2) return;

  const index = geo.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const body: Tri[] = [];
  const byCorner: Record<WheelCorner, Tri[]> = { FL: [], FR: [], RL: [], RR: [] };

  for (let t = 0; t < triCount; t++) {
    let i0: number;
    let i1: number;
    let i2: number;
    if (index) {
      i0 = index.getX(t * 3);
      i1 = index.getX(t * 3 + 1);
      i2 = index.getX(t * 3 + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }
    const a = tmp.fromBufferAttribute(pos, i0).applyMatrix4(local).clone();
    const b = new Vector3().fromBufferAttribute(pos, i1).applyMatrix4(local);
    const c = new Vector3().fromBufferAttribute(pos, i2).applyMatrix4(local);
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    const tri = { i0, i1, i2 };
    if (isWheelishCentroid(cx, cy, cz, minY, maxY, maxAbsX)) {
      byCorner[cornerOf(cx, cz)].push(tri);
    } else {
      body.push(tri);
    }
  }

  const wheelTriTotal = CORNERS.reduce((n, k) => n + byCorner[k].length, 0);
  if (wheelTriTotal < 24 || body.length < 32) return;

  const parent = mesh.parent ?? root;
  const srcMat = mesh.material;

  for (const corner of CORNERS) {
    const tris = byCorner[corner];
    if (tris.length < 6) continue;
    const wheelGeo = geometryFromTris(geo, tris);
    const wheel = new Mesh(wheelGeo, Array.isArray(srcMat) ? srcMat.map((m) => m.clone()) : srcMat.clone());
    wheel.name = stockWheelName(corner);
    wheel.userData.isStockWheel = true;
    wheel.userData.isWheel = true;
    wheel.castShadow = mesh.castShadow;
    wheel.receiveShadow = mesh.receiveShadow;
    // Keep same local transform as the source mesh (geometry still in mesh space).
    wheel.position.copy(mesh.position);
    wheel.quaternion.copy(mesh.quaternion);
    wheel.scale.copy(mesh.scale);
    parent.add(wheel);
  }

  mesh.geometry = geometryFromTris(geo, body);
  mesh.geometry.computeVertexNormals();
}

function geometryFromTris(src: BuffGeo, tris: Tri[]): BufferGeometry {
  const out = new BufferGeometry();
  const pos = src.attributes.position;
  const norm = src.attributes.normal;
  const uv = src.attributes.uv;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const pushVert = (i: number) => {
    positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    if (uv) uvs.push(uv.getX(i), uv.getY(i));
  };

  for (const t of tris) {
    pushVert(t.i0);
    pushVert(t.i1);
    pushVert(t.i2);
  }

  out.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  if (normals.length) out.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  if (uvs.length) out.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Show stock tires unless big_wheels replaces them. */
export function applyStockWheelVisibility(root: Object3D, hideStock: boolean): void {
  root.traverse((obj) => {
    if (!isStockWheelObject(obj)) return;
    obj.visible = !hideStock;
  });
}

/** Visible tire meshes used for ground contact (stock or Große Räder). */
export function isWheelContactObject(obj: Object3D): boolean {
  if (!obj.visible) return false;
  if (isStockWheelObject(obj)) return true;
  if (obj.name === "UpgradeTire" || obj.userData.isUpgradeWheel === true) return true;
  return false;
}

/**
 * Lowest world Y of tire contact patches.
 * Prefer this over `Box3.setFromObject(root)` — invisible FX / debris under the
 * origin would otherwise sink the car and leave detached wheels floating.
 */
export function wheelContactMinY(root: Object3D): number | null {
  root.updateMatrixWorld(true);
  let minY = Infinity;
  let found = false;
  root.traverse((obj) => {
    if (!isWheelContactObject(obj)) return;
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    const world = bb.clone().applyMatrix4(mesh.matrixWorld);
    if (!Number.isFinite(world.min.y)) return;
    minY = Math.min(minY, world.min.y);
    found = true;
  });
  return found ? minY : null;
}

/**
 * Showcase / pad sit height: tires when present, else visible non-FX meshes only.
 */
export function groundContactMinY(root: Object3D): number {
  const wheels = wheelContactMinY(root);
  if (wheels != null) return wheels;

  root.updateMatrixWorld(true);
  const box = new Box3();
  let found = false;
  root.traverse((obj) => {
    if (!obj.visible) return;
    if (obj.name.startsWith("fx-") || obj.userData.tripoFx) return;
    let p: Object3D | null = obj;
    while (p) {
      if (p.name.startsWith("fx-") || p.userData.tripoFx) return;
      p = p.parent;
    }
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    const world = bb.clone().applyMatrix4(mesh.matrixWorld);
    if (!found) {
      box.copy(world);
      found = true;
    } else {
      box.union(world);
    }
  });
  if (found && Number.isFinite(box.min.y)) return box.min.y;
  return new Box3().setFromObject(root).min.y;
}

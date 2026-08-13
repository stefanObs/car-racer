import {
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
  const low = y <= minY + height * 0.42;
  const outboard = Math.abs(x) >= maxAbsX * 0.52;
  // Keep mid-body skirts / doors out — wheels sit near front/rear arches.
  const nearArch = Math.abs(z) >= 0.55;
  return low && outboard && nearArch && y >= minY - 0.02;
}

type Tri = { i0: number; i1: number; i2: number };

/**
 * Split low outboard wheel-arch triangles off each mesh into `StockWheel_*` children
 * so big_wheels can hide stock tires and mount replacements.
 */
export function extractStockWheels(root: Object3D): void {
  if (root.userData.stockWheelsExtracted) return;
  root.userData.stockWheelsExtracted = true;

  root.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (isStockWheelObject(mesh)) return;
    if (mesh.name === "StockEngine") return;
    meshes.push(mesh);
  });

  for (const mesh of meshes) {
    splitOneMesh(mesh, root);
  }
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

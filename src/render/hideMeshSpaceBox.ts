import { BufferAttribute, Mesh, Vector3, type Object3D } from "three";
import type { InterleavedBufferAttribute } from "three";
import { meshInspectBoxContains, type MeshInspectBox, type MeshInspectVec3 } from "../core/meshInspect";
import { carMeshSpaceRoot, isMeshInspectSkipped } from "./meshInspectPick";
import { DONNER_ENGINE_BAY_FILL_NAME } from "./donnerEngineBox";

const INDEX_KEY = "ccHideEngineIndex";
const VIS_KEY = "ccHideEngineVisible";

type HiddenIndexHome = {
  array: Uint16Array | Uint32Array | null;
  itemSize: number;
};

type PosAttr = BufferAttribute | InterleavedBufferAttribute;

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _mid = new Vector3();
const _corner = new Vector3();

export type HideMeshSpaceBoxResult = {
  meshes: number;
  faces: number;
};

function skipHideObject(obj: Object3D): boolean {
  if (isMeshInspectSkipped(obj)) return true;
  let p: Object3D | null = obj;
  while (p) {
    const n = p.name ?? "";
    if (n.startsWith("StockWheel_")) return true;
    if (n.startsWith("carPart-")) return true;
    if (n === DONNER_ENGINE_BAY_FILL_NAME) return true;
    p = p.parent;
  }
  return false;
}

function asMesh(obj: Object3D): Mesh | null {
  const mesh = obj as Mesh;
  return mesh.isMesh ? mesh : null;
}

function isPosAttr(attr: unknown): attr is PosAttr {
  if (!attr || typeof attr !== "object") return false;
  const a = attr as { count?: number; getX?: unknown };
  return typeof a.getX === "function" && (a.count ?? 0) >= 3;
}

function toMeshSpace(mesh: Mesh, space: Object3D, attr: PosAttr, i: number, out: Vector3): Vector3 {
  out.fromBufferAttribute(attr, i);
  mesh.localToWorld(out);
  return space.worldToLocal(out);
}

function asBoxes(box: MeshInspectBox | readonly MeshInspectBox[]): readonly MeshInspectBox[] {
  return Array.isArray(box) ? box : [box];
}

function centroidInBoxes(
  mesh: Mesh,
  space: Object3D,
  pos: PosAttr,
  i0: number,
  i1: number,
  i2: number,
  boxes: readonly MeshInspectBox[],
): boolean {
  toMeshSpace(mesh, space, pos, i0, _a);
  toMeshSpace(mesh, space, pos, i1, _b);
  toMeshSpace(mesh, space, pos, i2, _c);
  _mid.set((_a.x + _b.x + _c.x) / 3, (_a.y + _b.y + _c.y) / 3, (_a.z + _b.z + _c.z) / 3);
  for (const box of boxes) {
    if (meshInspectBoxContains(box, _mid)) return true;
  }
  return false;
}

function copyIndexValues(attr: { count: number; getX: (i: number) => number }): Uint16Array | Uint32Array {
  const count = attr.count;
  const values = new Array<number>(count);
  let max = 0;
  for (let i = 0; i < count; i++) {
    const v = attr.getX(i);
    values[i] = v;
    if (v > max) max = v;
  }
  return max > 65535 ? Uint32Array.from(values) : Uint16Array.from(values);
}

function meshSpaceAabb(
  mesh: Mesh,
  space: Object3D,
): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  if (!bb) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const x of [bb.min.x, bb.max.x]) {
    for (const y of [bb.min.y, bb.max.y]) {
      for (const z of [bb.min.z, bb.max.z]) {
        _corner.set(x, y, z);
        mesh.localToWorld(_corner);
        space.worldToLocal(_corner);
        minX = Math.min(minX, _corner.x);
        minY = Math.min(minY, _corner.y);
        minZ = Math.min(minZ, _corner.z);
        maxX = Math.max(maxX, _corner.x);
        maxY = Math.max(maxY, _corner.y);
        maxZ = Math.max(maxZ, _corner.z);
      }
    }
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

function aabbInsideBox(
  inner: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  box: MeshInspectBox,
  pad = 0.04,
): boolean {
  return (
    inner.min.x >= box.min.x - pad &&
    inner.min.y >= box.min.y - pad &&
    inner.min.z >= box.min.z - pad &&
    inner.max.x <= box.max.x + pad &&
    inner.max.y <= box.max.y + pad &&
    inner.max.z <= box.max.z + pad
  );
}

export type HideMeshSpaceExtra = (p: MeshInspectVec3, mesh: Mesh) => boolean;

function hideFacesOnMesh(
  mesh: Mesh,
  space: Object3D,
  boxes: readonly MeshInspectBox[],
  extra?: HideMeshSpaceExtra,
): number {
  if (mesh.userData[INDEX_KEY]) return 0;
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  if (!isPosAttr(pos)) return 0;

  const idx = geo.getIndex();
  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
  if (triCount < 1) return 0;

  const kept: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    if (centroidInBoxes(mesh, space, pos, i0, i1, i2, boxes)) continue;
    if (extra?.({ x: _mid.x, y: _mid.y, z: _mid.z }, mesh)) continue;
    kept.push(i0, i1, i2);
  }
  const hidden = triCount - kept.length / 3;
  if (hidden < 1) return 0;

  mesh.userData[INDEX_KEY] = {
    array: idx ? copyIndexValues(idx) : null,
    itemSize: 1,
  } satisfies HiddenIndexHome;

  const maxVert = kept.reduce((m, i) => Math.max(m, i), 0);
  const next = maxVert > 65535 ? new Uint32Array(kept) : new Uint16Array(kept);
  geo.setIndex(new BufferAttribute(next, 1));
  if (geo.index) geo.index.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return hidden;
}

function hideContainedMesh(mesh: Mesh, space: Object3D, boxes: readonly MeshInspectBox[]): boolean {
  if (mesh.userData[VIS_KEY] != null) return false;
  const aabb = meshSpaceAabb(mesh, space);
  if (!aabb || !boxes.some((box) => aabbInsideBox(aabb, box))) return false;
  mesh.userData[VIS_KEY] = mesh.visible;
  mesh.visible = false;
  return true;
}

/** Hide triangles whose mesh-space centroid is inside any `box`. Skips wheels and equipped Teile. */
export function hideFacesInMeshSpaceBox(
  carRoot: Object3D,
  box: MeshInspectBox | readonly MeshInspectBox[],
  extra?: HideMeshSpaceExtra,
): HideMeshSpaceBoxResult {
  const boxes = asBoxes(box);
  carRoot.updateMatrixWorld(true);
  const space = carMeshSpaceRoot(carRoot);
  space.updateMatrixWorld(true);
  let meshes = 0;
  let faces = 0;
  carRoot.traverse((obj) => {
    const mesh = asMesh(obj);
    if (!mesh || skipHideObject(mesh)) return;
    if (hideContainedMesh(mesh, space, boxes)) {
      meshes++;
      return;
    }
    const n = hideFacesOnMesh(mesh, space, boxes, extra);
    if (n < 1) return;
    meshes++;
    faces += n;
  });
  return { meshes, faces };
}

export function restoreHiddenMeshFaces(carRoot: Object3D): number {
  let n = 0;
  carRoot.traverse((obj) => {
    const mesh = asMesh(obj);
    if (!mesh) return;
    const vis = mesh.userData[VIS_KEY] as boolean | undefined;
    if (vis != null) {
      mesh.visible = vis;
      delete mesh.userData[VIS_KEY];
      n++;
    }
    const home = mesh.userData[INDEX_KEY] as HiddenIndexHome | undefined;
    if (!home) return;
    if (home.array) mesh.geometry.setIndex(new BufferAttribute(home.array.slice(), home.itemSize));
    else mesh.geometry.setIndex(null);
    delete mesh.userData[INDEX_KEY];
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    n++;
  });
  return n;
}

export function meshHasHiddenFaces(obj: Object3D): boolean {
  const mesh = obj as Mesh;
  return Boolean(mesh.userData?.[INDEX_KEY] || mesh.userData?.[VIS_KEY] != null);
}

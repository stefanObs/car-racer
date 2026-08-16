import { BufferAttribute, BufferGeometry, Vector3, type Mesh } from "three";

const EPS = 1e-5;
const _a = new Vector3();
const _b = new Vector3();
const _local = new Vector3();
const _w0 = new Vector3();
const _w1 = new Vector3();

export type PickedMeshEdge = {
  mesh: Mesh;
  indices: number[];
  i0: number;
  i1: number;
};

export function pointToSegmentDistanceSq(p: Vector3, a: Vector3, b: Vector3): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const apz = p.z - a.z;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  const t = abLenSq < EPS ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq));
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}

export function weldedVertexIndices(pos: BufferAttribute, points: readonly Vector3[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    for (const p of points) {
      const dx = x - p.x;
      const dy = y - p.y;
      const dz = z - p.z;
      if (dx * dx + dy * dy + dz * dz <= EPS * EPS) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

function visitEdges(
  pos: BufferAttribute,
  visit: (i0: number, i1: number) => void,
  index: { count: number; getX: (i: number) => number } | null,
): void {
  const seen = new Set<string>();
  const edge = (i0: number, i1: number): void => {
    if (i0 === i1) return;
    const key = i0 < i1 ? `${i0}:${i1}` : `${i1}:${i0}`;
    if (seen.has(key)) return;
    seen.add(key);
    visit(i0, i1);
  };
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const i0 = index.getX(i);
      const i1 = index.getX(i + 1);
      const i2 = index.getX(i + 2);
      edge(i0, i1);
      edge(i1, i2);
      edge(i2, i0);
    }
    return;
  }
  for (let i = 0; i + 2 < pos.count; i += 3) {
    edge(i, i + 1);
    edge(i + 1, i + 2);
    edge(i + 2, i);
  }
}

export function pickClosestEdgeInGeometry(geo: BufferGeometry, localPoint: Vector3): PickedMeshEdge | null {
  const pos = geo.getAttribute("position");
  if (!(pos instanceof BufferAttribute) || pos.itemSize !== 3 || pos.count < 2) return null;
  let bestI0 = -1;
  let bestI1 = -1;
  let bestD = Infinity;
  visitEdges(
    pos,
    (i0, i1) => {
      _a.fromBufferAttribute(pos, i0);
      _b.fromBufferAttribute(pos, i1);
      const d = pointToSegmentDistanceSq(localPoint, _a, _b);
      if (d >= bestD) return;
      bestD = d;
      bestI0 = i0;
      bestI1 = i1;
    },
    geo.getIndex(),
  );
  if (bestI0 < 0) return null;
  _a.fromBufferAttribute(pos, bestI0);
  _b.fromBufferAttribute(pos, bestI1);
  return {
    mesh: null as unknown as Mesh,
    i0: bestI0,
    i1: bestI1,
    indices: weldedVertexIndices(pos, [_a.clone(), _b.clone()]),
  };
}

export function pickClosestEdge(mesh: Mesh, worldPoint: Vector3): PickedMeshEdge | null {
  mesh.updateMatrixWorld(true);
  const picked = pickClosestEdgeInGeometry(mesh.geometry, mesh.worldToLocal(_local.copy(worldPoint)));
  if (!picked) return null;
  picked.mesh = mesh;
  return picked;
}

export function edgeWorldEnds(edge: PickedMeshEdge, a: Vector3, b: Vector3): void {
  const pos = edge.mesh.geometry.getAttribute("position");
  if (!(pos instanceof BufferAttribute)) {
    a.set(0, 0, 0);
    b.set(0, 0, 0);
    return;
  }
  edge.mesh.updateMatrixWorld(true);
  edge.mesh.localToWorld(a.fromBufferAttribute(pos, edge.i0));
  edge.mesh.localToWorld(b.fromBufferAttribute(pos, edge.i1));
}

export function detachGeometryForEdit(mesh: Mesh): void {
  if (mesh.userData.meshInspectGeoHome) return;
  const pos = mesh.geometry.getAttribute("position");
  if (!(pos instanceof BufferAttribute)) return;
  mesh.geometry = mesh.geometry.clone();
  const next = mesh.geometry.getAttribute("position");
  if (!(next instanceof BufferAttribute)) return;
  mesh.userData.meshInspectGeoHome = Float32Array.from(next.array as ArrayLike<number>);
}

export function restoreGeometryHome(mesh: Mesh): boolean {
  const home = mesh.userData.meshInspectGeoHome as Float32Array | undefined;
  const pos = mesh.geometry.getAttribute("position");
  if (!home || !(pos instanceof BufferAttribute)) return false;
  (pos.array as Float32Array).set(home);
  pos.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  return true;
}

export function applyLocalDeltaToVertices(
  geo: BufferGeometry,
  indices: readonly number[],
  dx: number,
  dy: number,
  dz: number,
): void {
  const pos = geo.getAttribute("position");
  if (!(pos instanceof BufferAttribute)) return;
  const used = new Set<number>();
  for (const i of indices) {
    if (used.has(i) || i < 0 || i >= pos.count) continue;
    used.add(i);
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
  }
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

export function applyWorldDeltaToEdge(edge: PickedMeshEdge, worldDelta: Vector3): void {
  detachGeometryForEdit(edge.mesh);
  edge.mesh.updateMatrixWorld(true);
  _w0.set(0, 0, 0);
  edge.mesh.localToWorld(_w0);
  _w1.copy(_w0).add(worldDelta);
  const local0 = edge.mesh.worldToLocal(_w0.clone());
  const local1 = edge.mesh.worldToLocal(_w1);
  applyLocalDeltaToVertices(
    edge.mesh.geometry,
    edge.indices,
    local1.x - local0.x,
    local1.y - local0.y,
    local1.z - local0.z,
  );
}

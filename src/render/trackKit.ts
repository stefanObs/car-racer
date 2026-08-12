import { Group, InstancedMesh, Mesh, Object3D } from "three";
import { TRACK_PROPS, type TrackPropId } from "../data/trackModels";
import { nearestOnTrack, sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack } from "../track/types";
import { cloneTrackProp, hasTrackProp, propHeightFor, tileAlongFor, trackPropTemplate } from "./loadTrackGltf";

export type WallPlacement = {
  kind: "tire" | "concrete";
  x: number;
  z: number;
  yaw: number;
  side: 1 | -1;
  along: number;
};

/**
 * Tile tire modules on corners and concrete (+fence) on straights.
 * Push outward until nearest-track lateral is clear of asphalt (tight loops
 * can otherwise land a wall module inside another ribbon segment).
 */
export function planWallPlacements(track: BuiltTrack): WallPlacement[] {
  const tireAlong = tileAlongFor("tire-wall");
  const concreteAlong = tileAlongFor("concrete-wall");
  const minClear = track.asphaltHalfWidth + track.grassWidth + 0.45;
  const startOff = track.asphaltHalfWidth + track.grassWidth + 0.65;
  const out: WallPlacement[] = [];

  for (const side of [-1, 1] as const) {
    const start = out.length;
    let lastD = -1e9;
    for (let d = 0; d < track.totalLength; d += 0.32) {
      const s = sampleCenterline(track, d);
      const spacing = s.wall === "tire" ? tireAlong : concreteAlong;
      if (d - lastD < spacing * 0.92) continue;
      const angle = Math.atan2(s.tangent.z, s.tangent.x);
      const yaw = -angle + (side > 0 ? Math.PI : 0);
      let dist = startOff;
      let x = 0;
      let z = 0;
      for (let push = 0; push < 48; push++) {
        x = s.position.x + -s.tangent.z * dist * side;
        z = s.position.z + s.tangent.x * dist * side;
        const near = nearestOnTrack(track, { x, z });
        if (Math.abs(near.lateral) >= minClear) break;
        dist += 2.5;
      }
      // Drop modules that still sit on asphalt after push (pathological pinch).
      const near = nearestOnTrack(track, { x, z });
      if (Math.abs(near.lateral) < track.asphaltHalfWidth + 0.5) continue;
      out.push({
        kind: s.wall,
        x,
        z,
        yaw,
        side,
        along: d,
      });
      lastD = d;
    }
    dropLoopOverlap(out, start, tireAlong, concreteAlong);
  }
  return out;
}

function dropLoopOverlap(
  out: WallPlacement[],
  start: number,
  tireAlong: number,
  concreteAlong: number,
): void {
  if (out.length - start < 2) return;
  const first = out[start]!;
  const last = out[out.length - 1]!;
  const dist = Math.hypot(first.x - last.x, first.z - last.z);
  const spacing = last.kind === "tire" ? tireAlong : concreteAlong;
  if (dist < spacing * 0.7) out.pop();
}

export function instanceTrackProp(
  id: TrackPropId,
  x: number,
  z: number,
  yaw: number,
  y = 0,
  tint?: number,
): Group | null {
  const g = cloneTrackProp(id, tint);
  if (!g) return null;
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  return g;
}

export type PropPose = { x: number; z: number; yaw: number; y?: number };

/** One InstancedMesh per kit submesh — shared geo/mat, few draw calls. */
export function instanceTrackPropBatch(id: TrackPropId, poses: PropPose[]): Group | null {
  if (!hasTrackProp(id) || poses.length === 0) return null;
  const root = trackPropTemplate(id);
  if (!root) return null;
  root.updateMatrixWorld(true);
  const spec = TRACK_PROPS[id];
  const wrap = new Group();
  wrap.name = `track-batch-${id}`;
  wrap.userData.trackProp = id;
  wrap.userData.sharedKit = true;
  const dummy = new Object3D();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const inst = new InstancedMesh(mesh.geometry, mesh.material, poses.length);
    inst.userData.sharedKit = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    for (let i = 0; i < poses.length; i++) {
      const p = poses[i]!;
      dummy.position.set(p.x, p.y ?? 0, p.z);
      dummy.rotation.set(0, p.yaw + spec.yaw, 0);
      dummy.scale.setScalar(spec.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix.clone().multiply(mesh.matrixWorld));
    }
    inst.instanceMatrix.needsUpdate = true;
    wrap.add(inst);
  });
  return wrap.children.length ? wrap : null;
}

/** Repeat a shorter module along each longer wall pose (local +X). */
function tileAlongPoses(poses: PropPose[], moduleAlong: number, wallAlong: number): PropPose[] {
  const n = Math.max(1, Math.round(wallAlong / Math.max(moduleAlong, 0.4)));
  const step = wallAlong / n;
  const out: PropPose[] = [];
  for (const p of poses) {
    const mid = (n - 1) / 2;
    const cy = Math.cos(p.yaw);
    const sy = Math.sin(p.yaw);
    for (let i = 0; i < n; i++) {
      const o = (i - mid) * step;
      out.push({
        x: p.x + o * cy,
        z: p.z - o * sy,
        yaw: p.yaw,
        y: p.y,
      });
    }
  }
  return out;
}

export function instanceConcreteFenceBatch(poses: PropPose[]): Group | null {
  const wall = instanceTrackPropBatch("concrete-wall", poses);
  if (!wall) return null;
  const wrap = new Group();
  wrap.userData.trackProp = "concrete-wall";
  wrap.userData.wallKind = "concrete";
  wrap.add(wall);
  const wallY = propHeightFor("concrete-wall");
  const fenceAlong = tileAlongFor("fence");
  const wallAlong = tileAlongFor("concrete-wall");
  const fencePoses = tileAlongPoses(poses, fenceAlong, wallAlong).map((p) => ({
    ...p,
    y: (p.y ?? 0) + wallY,
  }));
  const fence = instanceTrackPropBatch("fence", fencePoses);
  if (fence) wrap.add(fence);
  return wrap;
}

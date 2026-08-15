import { Group, InstancedMesh, Mesh, Object3D } from "three";
import { TRACK_PROPS, type TrackPropId } from "../data/trackModels";
import { sampleCenterline } from "../track/buildTrack";
import { clearsAllRibbonAsphalt } from "../track/medianBarriers";
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
 * Sit on this ribbon's wall line. Never skip a stretch — dropping modules
 * for dual-ribbon clearance left holes you could drive through onto another leg.
 */
export function planWallPlacements(track: BuiltTrack): WallPlacement[] {
  const tireAlong = tileAlongFor("tire-wall");
  const concreteAlong = tileAlongFor("concrete-wall");
  const startOff = track.asphaltHalfWidth + track.grassWidth + 0.35;
  const out: WallPlacement[] = [];

  for (const side of [-1, 1] as const) {
    const start = out.length;
    let lastD = -1e9;
    for (let d = 0; d < track.totalLength; d += 0.28) {
      const s = sampleCenterline(track, d);
      const spacing = s.wall === "tire" ? tireAlong : concreteAlong;
      if (d - lastD < spacing * 0.78) continue;
      const pose = wallPoseForSample(track, s, d, side, startOff);
      if (!pose) continue;
      out.push(pose);
      lastD = d;
    }
    fillWallGaps(out, start, track, side, tireAlong, concreteAlong, startOff);
    dropLoopOverlap(out, start, tireAlong, concreteAlong, track.totalLength);
  }
  return out;
}

function offsetOnRibbon(
  s: ReturnType<typeof sampleCenterline>,
  dist: number,
  side: 1 | -1,
): { x: number; z: number } {
  return {
    x: s.position.x + -s.tangent.z * dist * side,
    z: s.position.z + s.tangent.x * dist * side,
  };
}

function wallYaw(s: ReturnType<typeof sampleCenterline>, side: 1 | -1): number {
  const angle = Math.atan2(s.tangent.z, s.tangent.x);
  return -angle + (side > 0 ? Math.PI : 0);
}

function wallPoseForSample(
  track: BuiltTrack,
  s: ReturnType<typeof sampleCenterline>,
  along: number,
  side: 1 | -1,
  startOff: number,
): WallPlacement | null {
  const tryDists = [startOff, startOff + 0.55, startOff + 1.3, startOff + 2.4, startOff + 4];
  for (const dist of tryDists) {
    const p = offsetOnRibbon(s, dist, side);
    if (!clearsAllRibbonAsphalt(track, p.x, p.z, { selfAlong: along, padding: 0.2 })) continue;
    return { kind: s.wall, x: p.x, z: p.z, yaw: wallYaw(s, side), side, along };
  }
  return null;
}

function alongDelta(total: number, a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, total - d);
}

function fillWallGaps(
  out: WallPlacement[],
  start: number,
  track: BuiltTrack,
  side: 1 | -1,
  tireAlong: number,
  concreteAlong: number,
  startOff: number,
): void {
  const seq = out.slice(start).sort((a, b) => a.along - b.along);
  if (seq.length < 2) return;
  const extras: WallPlacement[] = [];
  for (let i = 0; i < seq.length; i++) {
    const a = seq[i]!;
    const b = seq[(i + 1) % seq.length]!;
    let gap = b.along - a.along;
    if (gap < 0) gap += track.totalLength;
    const spacing = a.kind === "tire" ? tireAlong : concreteAlong;
    if (gap <= spacing * 1.22) continue;
    const steps = Math.max(1, Math.round(gap / spacing) - 1);
    for (let k = 1; k <= steps; k++) {
      const d = (a.along + (gap * k) / (steps + 1)) % track.totalLength;
      if (seq.some((w) => alongDelta(track.totalLength, w.along, d) < spacing * 0.4)) continue;
      const s = sampleCenterline(track, d);
      const pose = wallPoseForSample(track, s, d, side, startOff);
      if (pose) extras.push(pose);
    }
  }
  if (extras.length) out.splice(start, out.length - start, ...seq, ...extras);
}

function dropLoopOverlap(
  out: WallPlacement[],
  start: number,
  tireAlong: number,
  concreteAlong: number,
  totalLength: number,
): void {
  if (out.length - start < 2) return;
  const slice = out.slice(start).sort((a, b) => a.along - b.along);
  const first = slice[0]!;
  const last = slice[slice.length - 1]!;
  let alongGap = first.along - last.along;
  if (alongGap < 0) alongGap += totalLength;
  const spacing = last.kind === "tire" ? tireAlong : concreteAlong;
  if (alongGap > spacing * 1.5) return;
  const dist = Math.hypot(first.x - last.x, first.z - last.z);
  if (dist < spacing * 0.7) {
    const idx = out.findIndex((w, i) => i >= start && w.along === last.along && w.side === last.side);
    if (idx >= 0) out.splice(idx, 1);
  }
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

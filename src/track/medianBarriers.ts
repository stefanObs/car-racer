import { collisionRadiusFor } from "../data/carModels";
import { nearestOnTrack } from "./buildTrack";
import { findRibbonPinches, type RibbonPinch } from "./layoutRules";
import type { BuiltTrack } from "./types";

export type MedianBarrierPose = {
  x: number;
  z: number;
  type: "tire_stack" | "concrete_barrier";
  /** Along-track of nearest ribbon (for debug / tests). */
  along: number;
};

/**
 * Place solid section barriers along driveable ribbon-hop corridors so players
 * cannot switch segments (CONCEPT: no free cross without a section wall).
 */
export function planMedianBarriers(
  track: BuiltTrack,
  opts: { carRadius?: number } = {},
): MedianBarrierPose[] {
  const carR = opts.carRadius ?? collisionRadiusFor("blitz");
  const pinches = findRibbonPinches(track, { carRadius: carR }).filter((p) => p.midpointDriveable);
  const out: MedianBarrierPose[] = [];
  const minClear = track.asphaltHalfWidth * 0.55;

  for (const pinch of pinches) {
    for (const pose of barriersForPinch(track, pinch, minClear)) {
      if (out.some((o) => Math.hypot(o.x - pose.x, o.z - pose.z) < 3.2)) continue;
      out.push(pose);
    }
  }
  return out;
}

function barriersForPinch(
  track: BuiltTrack,
  pinch: RibbonPinch,
  minClear: number,
): MedianBarrierPose[] {
  const a = sampleApprox(track, pinch.alongA);
  const b = sampleApprox(track, pinch.alongB);
  const poses: MedianBarrierPose[] = [];
  for (let t = 0.25; t <= 0.75; t += 0.25) {
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const near = nearestOnTrack(track, { x, z });
    if (Math.abs(near.lateral) < minClear) continue;
    poses.push({
      x,
      z,
      type: Math.abs(near.lateral) < track.asphaltHalfWidth + 1.2 ? "tire_stack" : "concrete_barrier",
      along: near.distanceAlong,
    });
  }
  // Always try the geometric midpoint if corridor samples were dropped.
  if (poses.length === 0) {
    const near = nearestOnTrack(track, { x: pinch.midX, z: pinch.midZ });
    if (Math.abs(near.lateral) >= minClear) {
      poses.push({
        x: pinch.midX,
        z: pinch.midZ,
        type: "tire_stack",
        along: near.distanceAlong,
      });
    }
  }
  return poses;
}

function sampleApprox(track: BuiltTrack, along: number): { x: number; z: number } {
  const d = ((along % track.totalLength) + track.totalLength) % track.totalLength;
  let best = track.centerline[0]!;
  let bestDist = Infinity;
  for (let i = 0; i < track.cumulativeDistances.length; i++) {
    const err = Math.abs(track.cumulativeDistances[i]! - d);
    if (err < bestDist) {
      bestDist = err;
      best = track.centerline[i]!;
    }
  }
  return { x: best.x, z: best.z };
}

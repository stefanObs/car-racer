import { collisionRadiusFor } from "../data/carModels";
import { nearestOnTrack, sampleCenterline } from "./buildTrack";
import { findRibbonPinches, RIBBON_PINCH_MIN_ALONG_GAP_M } from "./layoutRules";
import type { BuiltTrack } from "./types";

export type MedianBarrierPose = {
  x: number;
  z: number;
  type: "tire_stack" | "concrete_barrier";
  /** Along-track of nearest ribbon (for debug / tests). */
  along: number;
};

function alongGap(track: BuiltTrack, a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, track.totalLength - d);
}

/**
 * True when (x,z) stays off every ribbon's asphalt, including parallel legs
 * (nearest-only checks miss walls that sit on another segment's racing surface).
 */
export function clearsAllRibbonAsphalt(
  track: BuiltTrack,
  x: number,
  z: number,
  opts: { selfAlong?: number; padding?: number } = {},
): boolean {
  const pad = opts.padding ?? 0.5;
  const asphaltR = track.asphaltHalfWidth + pad;
  const near = nearestOnTrack(track, { x, z });
  if (Math.abs(near.lateral) < asphaltR) return false;
  if (opts.selfAlong === undefined) return true;

  for (let d = 0; d < track.totalLength; d += 3) {
    if (alongGap(track, opts.selfAlong, d) < RIBBON_PINCH_MIN_ALONG_GAP_M) continue;
    const s = sampleCenterline(track, d);
    if (Math.hypot(x - s.position.x, z - s.position.z) < asphaltR) return false;
  }
  return true;
}

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
    for (const pose of barriersForPinch(track, pinch.alongA, pinch.alongB, pinch.midX, pinch.midZ, minClear)) {
      if (out.some((o) => Math.hypot(o.x - pose.x, o.z - pose.z) < 3.2)) continue;
      out.push(pose);
    }
  }
  return out;
}

function barriersForPinch(
  track: BuiltTrack,
  alongA: number,
  alongB: number,
  midX: number,
  midZ: number,
  minClear: number,
): MedianBarrierPose[] {
  const a = sampleApprox(track, alongA);
  const b = sampleApprox(track, alongB);
  const poses: MedianBarrierPose[] = [];
  for (let t = 0.25; t <= 0.75; t += 0.25) {
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const near = nearestOnTrack(track, { x, z });
    if (Math.abs(near.lateral) < minClear) continue;
    if (!clearsAllRibbonAsphalt(track, x, z, { selfAlong: alongA, padding: track.asphaltHalfWidth * 0.15 })) {
      continue;
    }
    poses.push({
      x,
      z,
      type: Math.abs(near.lateral) < track.asphaltHalfWidth + 1.2 ? "tire_stack" : "concrete_barrier",
      along: near.distanceAlong,
    });
  }
  if (poses.length === 0) {
    const near = nearestOnTrack(track, { x: midX, z: midZ });
    if (
      Math.abs(near.lateral) >= minClear &&
      clearsAllRibbonAsphalt(track, midX, midZ, { selfAlong: alongA, padding: track.asphaltHalfWidth * 0.15 })
    ) {
      poses.push({
        x: midX,
        z: midZ,
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

import type { BuiltTrack, Vec2 } from "./types";
import { BRIDGE_CLEARANCE_M } from "./bridgeElevation";

/** Proper intersection of two open segments (not just shared endpoints). */
export function segmentsCross(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const dAx = a2.x - a1.x;
  const dAz = a2.z - a1.z;
  const dBx = b2.x - b1.x;
  const dBz = b2.z - b1.z;
  const den = dAx * dBz - dAz * dBx;
  if (Math.abs(den) < 1e-9) return false; // parallel
  const t = ((b1.x - a1.x) * dBz - (b1.z - a1.z) * dBx) / den;
  const u = ((b1.x - a1.x) * dAz - (b1.z - a1.z) * dAx) / den;
  const eps = 1e-4;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

function edgeMidY(elev: number[] | undefined, i: number): number {
  if (!elev?.length) return 0;
  const a = elev[i] ?? 0;
  const b = elev[i + 1] ?? a;
  return (a + b) * 0.5;
}

/**
 * True when the centerline ribbon crosses itself in plan view without a height-separated bridge.
 * Adjacent edges and loop closure neighbors are ignored.
 */
export function centerlineSelfIntersects(
  points: Vec2[],
  opts: { minIndexGap?: number; elevation?: number[] } = {},
): boolean {
  const n = points.length;
  if (n < 6) return false;
  const minGap = opts.minIndexGap ?? 3;
  const elev = opts.elevation;
  const illegal = (i: number, j: number): boolean => {
    if (!segmentsCross(points[i]!, points[i + 1]!, points[j]!, points[j + 1]!)) return false;
    const dy = Math.abs(edgeMidY(elev, i) - edgeMidY(elev, j));
    return dy < BRIDGE_CLEARANCE_M;
  };
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + minGap; j < n - 1; j++) {
      if (i === 0 && j >= n - 1 - minGap) continue;
      if (illegal(i, j)) return true;
    }
  }
  const c1 = points[n - 1]!;
  const c2 = points[0]!;
  for (let j = minGap; j < n - 1 - minGap; j++) {
    if (!segmentsCross(c1, c2, points[j]!, points[j + 1]!)) continue;
    const yClose = ((elev?.[n - 1] ?? 0) + (elev?.[0] ?? 0)) * 0.5;
    const yJ = edgeMidY(elev, j);
    if (Math.abs(yClose - yJ) < BRIDGE_CLEARANCE_M) return true;
  }
  return false;
}

export function trackSelfIntersects(track: BuiltTrack): boolean {
  return centerlineSelfIntersects(track.centerline, { elevation: track.elevation });
}

/**
 * Heading change across the start/finish seam (degrees).
 * Large values mean the closing stitch forces a U-turn at the ZIEL line.
 */
export function loopSeamKinkDegrees(track: BuiltTrack, probeM = 3): number {
  const len = track.totalLength;
  if (len < probeM * 2) return 0;
  const before = sampleTangent(track, len - probeM);
  const after = sampleTangent(track, probeM);
  const dot = Math.max(-1, Math.min(1, before.x * after.x + before.z * after.z));
  return (Math.acos(dot) * 180) / Math.PI;
}

function sampleTangent(track: BuiltTrack, distance: number): Vec2 {
  const d = ((distance % track.totalLength) + track.totalLength) % track.totalLength;
  const dists = track.cumulativeDistances;
  let i = 1;
  while (i < dists.length && dists[i]! < d) i++;
  const i1 = Math.min(i, track.centerline.length - 1);
  const i0 = Math.max(0, i1 - 1);
  const a = track.centerline[i0]!;
  const b = track.centerline[i1]!;
  const tx = b.x - a.x;
  const tz = b.z - a.z;
  const n = Math.hypot(tx, tz) || 1;
  return { x: tx / n, z: tz / n };
}

/** World position on the racing ribbon (lateral 0 = center, + = left of travel). */
export function pointOnTrack(
  track: BuiltTrack,
  distanceAlong: number,
  lateral: number,
): Vec2 {
  const d =
    ((distanceAlong % track.totalLength) + track.totalLength) % track.totalLength;
  const dists = track.cumulativeDistances;
  let i = 1;
  while (i < dists.length && dists[i]! < d) i++;
  const i0 = Math.max(0, i - 1);
  const i1 = Math.min(dists.length - 1, i);
  const d0 = dists[i0]!;
  const d1 = dists[i1]!;
  const t = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
  const p0 = track.centerline[i0]!;
  const p1 = track.centerline[i1]!;
  const x = p0.x + (p1.x - p0.x) * t;
  const z = p0.z + (p1.z - p0.z) * t;
  let tx = p1.x - p0.x;
  let tz = p1.z - p0.z;
  const len = Math.hypot(tx, tz) || 1;
  tx /= len;
  tz /= len;
  // Left normal
  const lx = -tz;
  const lz = tx;
  return { x: x + lx * lateral, z: z + lz * lateral };
}

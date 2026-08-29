import type { BuiltTrack, Vec2 } from "./types";

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

/**
 * True when the centerline ribbon crosses itself (figure-8 / overpass without bridge).
 * Adjacent edges and loop closure neighbors are ignored.
 */
export function centerlineSelfIntersects(
  points: Vec2[],
  opts: { minIndexGap?: number } = {},
): boolean {
  const n = points.length;
  if (n < 6) return false;
  const minGap = opts.minIndexGap ?? 3;
  for (let i = 0; i < n - 1; i++) {
    const a1 = points[i]!;
    const a2 = points[i + 1]!;
    for (let j = i + minGap; j < n - 1; j++) {
      // Skip edges that share the loop seam with edge 0
      if (i === 0 && j >= n - 1 - minGap) continue;
      const b1 = points[j]!;
      const b2 = points[j + 1]!;
      if (segmentsCross(a1, a2, b1, b2)) return true;
    }
  }
  // Closing edge (last → first) vs earlier edges
  const c1 = points[n - 1]!;
  const c2 = points[0]!;
  for (let j = minGap; j < n - 1 - minGap; j++) {
    if (segmentsCross(c1, c2, points[j]!, points[j + 1]!)) return true;
  }
  return false;
}

export function trackSelfIntersects(track: BuiltTrack): boolean {
  return centerlineSelfIntersects(track.centerline);
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

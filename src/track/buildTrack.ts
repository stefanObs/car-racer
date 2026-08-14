import type { BuiltTrack, LevelDefinition, TrackSegment, Vec2 } from "./types";

function pushPoint(points: Vec2[], x: number, z: number): void {
  const last = points[points.length - 1];
  if (last && Math.hypot(last.x - x, last.z - z) < 0.05) return;
  points.push({ x, z });
}

/** Build a closed centerline from level segments (x/z plane). */
export function buildTrackFromLevel(level: LevelDefinition): BuiltTrack {
  const points: Vec2[] = [{ x: 0, z: 0 }];
  let x = 0;
  let z = 0;
  let heading = 0;
  const wallKindAccum: Array<"tire" | "concrete"> = ["concrete"];
  const unevenMasks: BuiltTrack["unevenMasks"] = [];
  let distCursor = 0;

  const appendStraight = (len: number, wall: "tire" | "concrete", intensity?: number): void => {
    const startDist = distCursor;
    const steps = Math.max(2, Math.ceil(len / 4));
    for (let i = 1; i <= steps; i++) {
      const step = len / steps;
      x += Math.cos(heading) * step;
      z += Math.sin(heading) * step;
      pushPoint(points, x, z);
      wallKindAccum.push(wall);
      distCursor += step;
    }
    if (intensity !== undefined) {
      unevenMasks.push({ startDist, endDist: distCursor, intensity });
    }
  };

  const appendCurve = (seg: TrackSegment): void => {
    const radius = seg.radius ?? 18;
    const angleDeg = seg.angleDeg ?? 90;
    const turnSign = seg.type === "curve_r" ? 1 : -1;
    const cX = x - Math.sin(heading) * radius * turnSign;
    const cZ = z + Math.cos(heading) * radius * turnSign;
    const startAng = Math.atan2(z - cZ, x - cX);
    const deltaAng = turnSign * ((angleDeg * Math.PI) / 180);
    const steps = Math.max(6, Math.ceil((Math.abs(angleDeg) / 90) * 10));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = startAng + deltaAng * t;
      pushPoint(points, cX + Math.cos(a) * radius, cZ + Math.sin(a) * radius);
      wallKindAccum.push("tire");
    }
    const last = points[points.length - 1]!;
    x = last.x;
    z = last.z;
    heading += deltaAng;
    distCursor += Math.abs(deltaAng) * radius;
  };

  const applySegment = (seg: TrackSegment): void => {
    if (seg.type === "straight" || seg.type === "choke") {
      appendStraight(seg.length ?? 20, "concrete");
      return;
    }
    if (seg.type === "uneven_field") {
      appendStraight(seg.length ?? 20, "concrete", seg.intensity ?? 0.5);
      return;
    }
    if (seg.type === "curve_r" || seg.type === "curve_l") {
      appendCurve(seg);
      return;
    }
    if (seg.type === "s_curve") {
      applySegment({ type: "curve_r", radius: 14, angleDeg: 45, width: seg.width });
      applySegment({ type: "curve_l", radius: 14, angleDeg: 45, width: seg.width });
    }
  };

  for (const seg of level.track.segments) applySegment(seg);

  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (Math.hypot(first.x - last.x, first.z - last.z) > 1) {
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      pushPoint(points, last.x + (first.x - last.x) * t, last.z + (first.z - last.z) * t);
      wallKindAccum.push("concrete");
    }
  }

  const cumulativeDistances: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
    cumulativeDistances.push(total);
  }

  while (wallKindAccum.length < points.length) wallKindAccum.push("concrete");
  wallKindAccum.length = points.length;

  return {
    centerline: points,
    cumulativeDistances,
    totalLength: Math.max(total, 1),
    asphaltHalfWidth: level.track.asphaltWidth / 2,
    grassWidth: level.track.grassWidth,
    wallKind: wallKindAccum,
    unevenMasks,
    spawnHeading: (level.spawn.headingDeg * Math.PI) / 180,
  };
}

export function sampleCenterline(
  track: BuiltTrack,
  distance: number,
): { position: Vec2; tangent: Vec2; wall: "tire" | "concrete"; index: number } {
  const d = ((distance % track.totalLength) + track.totalLength) % track.totalLength;
  const dists = track.cumulativeDistances;
  let i = 1;
  while (i < dists.length && dists[i]! < d) i++;
  const i1 = Math.min(i, track.centerline.length - 1);
  const i0 = Math.max(0, i1 - 1);
  const d0 = dists[i0]!;
  const d1 = dists[i1]!;
  const span = Math.max(1e-6, d1 - d0);
  const t = (d - d0) / span;
  const a = track.centerline[i0]!;
  const b = track.centerline[i1]!;
  const position = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  let tx = b.x - a.x;
  let tz = b.z - a.z;
  const len = Math.hypot(tx, tz) || 1;
  tx /= len;
  tz /= len;
  return { position, tangent: { x: tx, z: tz }, wall: track.wallKind[i0] ?? "concrete", index: i0 };
}

export function nearestOnTrack(
  track: BuiltTrack,
  point: Vec2,
  opts?: { preferAlong?: number; alongWeight?: number },
): { distanceAlong: number; lateral: number; tangent: Vec2; wall: "tire" | "concrete" } {
  let bestScore = Infinity;
  let bestAlong = 0;
  let bestLateral = 0;
  let bestTangent = { x: 1, z: 0 };
  let bestWall: "tire" | "concrete" = "concrete";
  const prefer = opts?.preferAlong;
  const alongW = opts?.alongWeight ?? 0.35;

  for (let i = 0; i < track.centerline.length - 1; i++) {
    const a = track.centerline[i]!;
    const b = track.centerline[i + 1]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const lenSq = abx * abx + abz * abz || 1e-6;
    let t = ((point.x - a.x) * abx + (point.z - a.z) * abz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const dx = point.x - px;
    const dz = point.z - pz;
    const dist = Math.hypot(dx, dz);
    const segLen = Math.sqrt(lenSq);
    const along = track.cumulativeDistances[i]! + segLen * t;
    let score = dist;
    if (prefer !== undefined) {
      const gap = Math.abs(along - prefer);
      score += alongW * Math.min(gap, track.totalLength - gap);
    }
    if (score < bestScore) {
      bestScore = score;
      bestAlong = along;
      const len = segLen || 1;
      const tx = abx / len;
      const tz = abz / len;
      bestTangent = { x: tx, z: tz };
      bestLateral = dx * -tz + dz * tx;
      bestWall = track.wallKind[i] ?? "concrete";
    }
  }

  return { distanceAlong: bestAlong, lateral: bestLateral, tangent: bestTangent, wall: bestWall };
}

export function unevenIntensityAt(track: BuiltTrack, distanceAlong: number): number {
  const d = ((distanceAlong % track.totalLength) + track.totalLength) % track.totalLength;
  let max = 0;
  for (const mask of track.unevenMasks) {
    if (d >= mask.startDist && d <= mask.endDist) max = Math.max(max, mask.intensity);
  }
  return max;
}

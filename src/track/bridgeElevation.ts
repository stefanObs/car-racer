import type { BuiltTrack } from "./types";

/** Min deck-to-deck Y gap for a legal plan-view crossing (CONCEPT §4.4.1). */
export const BRIDGE_CLEARANCE_M = 2.5;

/**
 * Peak driveable deck height (m).
 * Must sit **above** the Tripo bridge volume (road ≈3.5–4.15, rails/arch ≈5.0)
 * so the whole car rides the comic asphalt strip instead of clipping through mesh.
 */
export const BRIDGE_DECK_Y_M = 5.45;

/** Tripo road-surface median after bake (structure stays below the drive ribbon). */
export const BRIDGE_MESH_ROAD_Y_M = 3.87;

/** Along-track half-length of the flat deck on top of the overpass (m). */
export const BRIDGE_DECK_HALF_M = 8;

/**
 * Along-track length of each approach ramp (m).
 * Longer than the Tripo mesh ramps so the climb stays soft and the over/under
 * decks are height-separated before the ribbons get close in plan view
 * (avoids bogus median barriers at the crossing). Cars rise onto the mesh;
 * the procedural ribbon stays flat so they read as on the Tripo deck.
 */
export const BRIDGE_RAMP_M = 42;

/**
 * Racing ∞ (lemniscate of Gerono) in XZ with one elevated crossing pass.
 * Elevation is distance-based around the plan-view origin crossing so the climb
 * matches a long Tripo overpass (not a sharp angular wedge).
 */
export function figureEightBridgeCenterline(opts?: {
  /** Half-span scale (m). Default yields ~900 m lap. */
  a?: number;
  samples?: number;
  deckY?: number;
  deckHalfM?: number;
  rampM?: number;
}): Array<{ x: number; z: number; y: number }> {
  const a = opts?.a ?? 115;
  const samples = opts?.samples ?? 280;
  const deckY = opts?.deckY ?? BRIDGE_DECK_Y_M;
  const deckHalf = opts?.deckHalfM ?? BRIDGE_DECK_HALF_M;
  const rampM = opts?.rampM ?? BRIDGE_RAMP_M;

  const xz: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    // Gerono: crosses at origin for t = π/2 (elevated) and t = 3π/2 (ground).
    xz.push({
      x: a * Math.cos(t),
      z: a * Math.sin(t) * Math.cos(t),
    });
  }

  // Cumulative length along the elevated pass only (first half of loop, through π/2).
  const elevAlong = cumulativeAlong(xz);
  const crossIdx = Math.round(samples * 0.25); // t = π/2
  const crossAlong = elevAlong[crossIdx]!;

  return xz.map((p, i) => {
    const t = (i / samples) * Math.PI * 2;
    // Only elevate the first crossing (π/2). Return pass at 3π/2 stays on the ground.
    const onElevatedPass = t < Math.PI;
    const y = onElevatedPass
      ? softDeckElevation(elevAlong[i]! - crossAlong, deckY, deckHalf, rampM)
      : 0;
    return { x: p.x, z: p.z, y };
  });
}

function cumulativeAlong(pts: Array<{ x: number; z: number }>): number[] {
  const out = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
    out.push(total);
  }
  return out;
}

/** Smoothstep ease — continuous first derivative at the joints (no driving “edge”). */
function smoothstep(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

/**
 * Elevation vs signed distance from deck center along the elevated pass.
 * Flat deck in the middle; smoothstep ramps on both sides.
 */
export function softDeckElevation(
  signedDistFromCenter: number,
  deckY: number,
  deckHalfM: number,
  rampM: number,
): number {
  const d = Math.abs(signedDistFromCenter);
  if (d <= deckHalfM) return deckY;
  if (d >= deckHalfM + rampM) return 0;
  const u = 1 - (d - deckHalfM) / rampM;
  return deckY * smoothstep(u);
}

export function elevationAt(track: BuiltTrack, distanceAlong: number): number {
  const elev = track.elevation;
  if (!elev?.length) return 0;
  const d = ((distanceAlong % track.totalLength) + track.totalLength) % track.totalLength;
  const dists = track.cumulativeDistances;
  let i = 1;
  while (i < dists.length && dists[i]! < d) i++;
  const i1 = Math.min(i, elev.length - 1);
  const i0 = Math.max(0, i1 - 1);
  const d0 = dists[i0]!;
  const d1 = dists[i1]!;
  const t = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
  return elev[i0]! + (elev[i1]! - elev[i0]!) * t;
}

/**
 * Nose pitch (rad) so grounded cars follow the bridge ramp / deck slope.
 * Positive = nose up when climbing (matches RaceRenderer airborne pitch sign).
 */
export function surfacePitchAt(track: BuiltTrack, distanceAlong: number, lookM = 2.5): number {
  if (!track.elevation?.length) return 0;
  const half = Math.max(0.5, lookM);
  const y0 = elevationAt(track, distanceAlong - half);
  const y1 = elevationAt(track, distanceAlong + half);
  return Math.atan2(y1 - y0, half * 2);
}

/** True when two along-samples are different decks at a bridge crossing. */
export function isBridgeHeightSeparated(track: BuiltTrack, alongA: number, alongB: number): boolean {
  return Math.abs(elevationAt(track, alongA) - elevationAt(track, alongB)) >= BRIDGE_CLEARANCE_M;
}

/** World pose for the Tripo bridge: centered on the plan-view crossing (origin). */
export function bridgeCrossingPose(
  track: BuiltTrack,
): { x: number; y: number; z: number; yaw: number } {
  // Prefer the elevated sample closest to the origin (true over/under).
  let bestAlong = 0;
  let bestScore = Infinity;
  for (let d = 0; d < track.totalLength; d += 0.5) {
    // sample via elevation array + centerline
    const i = Math.min(
      track.centerline.length - 1,
      Math.max(0, track.cumulativeDistances.findIndex((cd) => cd >= d)),
    );
    const p = track.centerline[i]!;
    const y = track.elevation[i] ?? 0;
    if (y < BRIDGE_DECK_Y_M * 0.85) continue;
    const r = Math.hypot(p.x, p.z);
    const score = r - y * 0.01;
    if (score < bestScore) {
      bestScore = score;
      bestAlong = d;
    }
  }
  // Fallback: origin-facing elevated sample
  if (!Number.isFinite(bestScore) || bestScore > 80) {
    bestAlong = track.totalLength * 0.25;
  }
  const dists = track.cumulativeDistances;
  let i = 1;
  while (i < dists.length && dists[i]! < bestAlong) i++;
  const i1 = Math.min(i, track.centerline.length - 1);
  const i0 = Math.max(0, i1 - 1);
  const a = track.centerline[i0]!;
  const b = track.centerline[i1]!;
  const tx = b.x - a.x;
  const tz = b.z - a.z;
  const len = Math.hypot(tx, tz) || 1;
  return {
    x: 0,
    y: 0,
    z: 0,
    yaw: Math.atan2(tx / len, tz / len),
  };
}

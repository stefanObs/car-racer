import { collisionRadiusFor } from "../data/carModels";
import { nearestOnTrack, sampleCenterline } from "./buildTrack";
import type { BuiltTrack } from "./types";

/** Extra gap beyond two wall ribbons + car so medians stay blocked. */
export const RIBBON_MEDIAN_MARGIN_M = 4;

/** Along-track distance below which samples are the same stretch (not a parallel hop). */
export const RIBBON_PINCH_MIN_ALONG_GAP_M = 40;

/**
 * Procedural scenery kinds still allowed until Tripo replacements ship (Phase D).
 * Everything else must map to `isTripoSceneryKind`.
 */
export const ALLOWED_NON_TRIPO_SCENERY = ["water", "dune", "lamp", "stack"] as const;

export type AllowedNonTripoScenery = (typeof ALLOWED_NON_TRIPO_SCENERY)[number];

export function isAllowedNonTripoScenery(kind: string): kind is AllowedNonTripoScenery {
  return (ALLOWED_NON_TRIPO_SCENERY as readonly string[]).includes(kind);
}

export type RibbonPinch = {
  alongA: number;
  alongB: number;
  centerDist: number;
  /** centerDist − 2×wallLimit; negative = overlapping grass/wall zones. */
  edgeGap: number;
  midX: number;
  midZ: number;
  /** True when the midpoint is still inside the nearest ribbon's wallLimit. */
  midpointDriveable: boolean;
};

export function wallLimitFor(track: BuiltTrack): number {
  return track.asphaltHalfWidth + track.grassWidth;
}

/** Minimum centerline spacing so two non-adjacent samples cannot be hopped. */
export function minRibbonSeparation(track: BuiltTrack, carRadius = collisionRadiusFor("blitz")): number {
  return 2 * wallLimitFor(track) + 2 * carRadius + RIBBON_MEDIAN_MARGIN_M;
}

function alongDelta(track: BuiltTrack, a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, track.totalLength - d);
}

/**
 * Find places where two far-along centerline samples sit closer than the
 * separation budget — players can switch segments without a median barrier.
 */
export function findRibbonPinches(
  track: BuiltTrack,
  opts: { sampleStep?: number; carRadius?: number; clusterAlong?: number } = {},
): RibbonPinch[] {
  const step = opts.sampleStep ?? 2;
  const carR = opts.carRadius ?? collisionRadiusFor("blitz");
  const cluster = opts.clusterAlong ?? 8;
  const wallLimit = wallLimitFor(track);
  const minSep = minRibbonSeparation(track, carR);
  const samples: Array<{ d: number; x: number; z: number }> = [];
  for (let d = 0; d < track.totalLength; d += step) {
    const s = sampleCenterline(track, d);
    samples.push({ d, x: s.position.x, z: s.position.z });
  }

  const raw: RibbonPinch[] = [];
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i]!;
    for (let j = i + 1; j < samples.length; j++) {
      const b = samples[j]!;
      if (alongDelta(track, a.d, b.d) < RIBBON_PINCH_MIN_ALONG_GAP_M) continue;
      const centerDist = Math.hypot(a.x - b.x, a.z - b.z);
      if (centerDist >= minSep) continue;
      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      const near = nearestOnTrack(track, { x: midX, z: midZ });
      raw.push({
        alongA: a.d,
        alongB: b.d,
        centerDist,
        edgeGap: centerDist - 2 * wallLimit,
        midX,
        midZ,
        midpointDriveable: Math.abs(near.lateral) <= wallLimit,
      });
    }
  }

  raw.sort((x, y) => x.centerDist - y.centerDist);
  const clustered: RibbonPinch[] = [];
  for (const p of raw) {
    if (
      clustered.some(
        (c) =>
          alongDelta(track, c.alongA, p.alongA) < cluster &&
          alongDelta(track, c.alongB, p.alongB) < cluster,
      )
    ) {
      continue;
    }
    clustered.push(p);
  }
  return clustered;
}

/** True when no ribbon samples violate the ideal separation budget. */
export function ribbonSeparationOk(track: BuiltTrack, carRadius?: number): boolean {
  return findRibbonPinches(track, { carRadius }).length === 0;
}

/** Driveable midpoints — players can hop segments unless a median barrier blocks. */
export function driveableRibbonPinches(track: BuiltTrack, carRadius?: number): RibbonPinch[] {
  return findRibbonPinches(track, { carRadius }).filter((p) => p.midpointDriveable);
}

/**
 * True when physics wallLimit alone blocks every pinch midpoint
 * (no free hop corridor). Prefer this over full separationOk for twisted cups.
 */
export function ribbonHopBlockedByWallLimit(track: BuiltTrack, carRadius?: number): boolean {
  return driveableRibbonPinches(track, carRadius).length === 0;
}

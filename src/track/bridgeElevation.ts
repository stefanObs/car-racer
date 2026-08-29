import type { BuiltTrack } from "./types";

/** Min deck-to-deck Y gap for a legal plan-view crossing (CONCEPT §4.4.1). */
export const BRIDGE_CLEARANCE_M = 2.5;

/** Peak deck height for the Tripo bridge overpass (arcade underpass clearance). */
export const BRIDGE_DECK_Y_M = 3.4;

/**
 * Racing ∞ (lemniscate of Gerono) in XZ with one elevated crossing pass.
 * Crossing at the origin: first pass rides the deck, return pass stays on the ground.
 */
export function figureEightBridgeCenterline(opts?: {
  /** Half-span scale (m). Default yields ~900 m lap. */
  a?: number;
  samples?: number;
  deckY?: number;
  /** Angular half-width of flat deck around the elevated crossing (rad). */
  plateauRad?: number;
  /** Angular ramp length each side of the plateau (rad). */
  rampRad?: number;
}): Array<{ x: number; z: number; y: number }> {
  const a = opts?.a ?? 115;
  const samples = opts?.samples ?? 220;
  const deckY = opts?.deckY ?? BRIDGE_DECK_Y_M;
  const plateau = opts?.plateauRad ?? 0.12;
  const ramp = opts?.rampRad ?? 0.38;
  const pts: Array<{ x: number; z: number; y: number }> = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    // Gerono: x = a cos t, z = a sin t cos t — self-crosses at origin (t = π/2, 3π/2).
    const x = a * Math.cos(t);
    const z = a * Math.sin(t) * Math.cos(t);
    pts.push({ x, z, y: elevNearCrossing(t, Math.PI / 2, deckY, plateau, ramp) });
  }
  return pts;
}

function elevNearCrossing(
  t: number,
  crossT: number,
  deckY: number,
  plateau: number,
  ramp: number,
): number {
  let d = Math.abs(t - crossT);
  d = Math.min(d, Math.PI * 2 - d);
  if (d <= plateau) return deckY;
  if (d <= plateau + ramp) {
    const u = (d - plateau) / ramp;
    return deckY * (1 - u) * (1 - u); // ease-out onto/off the deck
  }
  return 0;
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

/** True when two along-samples are different decks at a bridge crossing. */
export function isBridgeHeightSeparated(track: BuiltTrack, alongA: number, alongB: number): boolean {
  return Math.abs(elevationAt(track, alongA) - elevationAt(track, alongB)) >= BRIDGE_CLEARANCE_M;
}

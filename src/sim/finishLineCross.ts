/** Detect crossing the start/finish seam along the closed loop. */
export type FinishLineCross = "forward" | "backward" | null;

/**
 * Forward: end of lap → start (progress wrap).
 * Backward: start → end (wrong-way wrap) — must undo a lap.
 */
export function finishLineCross(
  prevAlong: number,
  along: number,
  totalLength: number,
  speed: number,
): FinishLineCross {
  if (speed <= 2 || totalLength <= 0) return null;
  const hi = totalLength * 0.75;
  const lo = totalLength * 0.25;
  if (prevAlong > hi && along < lo) return "forward";
  if (prevAlong < lo && along > hi) return "backward";
  return null;
}

/** Current lap for HUD/billboards — clamp only the finish overrun; negatives stay visible. */
export function displayLap(lap: number, totalLaps: number): number {
  const total = Math.max(1, totalLaps);
  if (lap > total) return total;
  return lap;
}

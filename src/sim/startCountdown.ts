/** Race start hold: 3 → 2 → 1 → GO, one second each (total 4 s). */
export const START_COUNTDOWN_SEC = 4;

export type CountdownPhase = "3" | "2" | "1" | "GO";

/** Label for the remaining hold time, or `null` once racing has begun. */
export function countdownPhase(remainingSec: number): CountdownPhase | null {
  if (remainingSec <= 0) return null;
  if (remainingSec > 3) return "3";
  if (remainingSec > 2) return "2";
  if (remainingSec > 1) return "1";
  return "GO";
}

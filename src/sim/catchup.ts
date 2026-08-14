/**
 * Trailing cars get a clearer Nachzieh-Boost (CONCEPT §4.7).
 * Stronger than the old mild curve so mid/back pack can keep duels alive,
 * but still no rubber-band magnet — clean leaders pull away.
 */
export function catchUpMultipliers(place: number, fieldSize: number): {
  accel: number;
  topSpeed: number;
} {
  if (fieldSize <= 1) return { accel: 1, topSpeed: 1 };
  const behind = Math.max(0, place - 1); // 0 for leader
  const t = behind / (fieldSize - 1);
  return {
    accel: 1 + t * 0.3,
    topSpeed: 1 + t * 0.12,
  };
}

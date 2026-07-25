/** Trailing cars get a mild boost; clean leaders still pull away. */
export function catchUpMultipliers(place: number, fieldSize: number): {
  accel: number;
  topSpeed: number;
} {
  if (fieldSize <= 1) return { accel: 1, topSpeed: 1 };
  const behind = place - 1; // 0 for leader
  const t = behind / (fieldSize - 1);
  return {
    accel: 1 + t * 0.18,
    topSpeed: 1 + t * 0.06,
  };
}

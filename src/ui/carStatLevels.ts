import type { VehicleStats } from "../data/cars";

/** Display stats for garage popup — concept §4.3 pillars + Nitro. */
export type StatLevelKey =
  | "accel"
  | "topSpeed"
  | "grip"
  | "handling"
  | "suspension"
  | "armor"
  | "mass"
  | "nitro";

export type StatLevelRow = {
  key: StatLevelKey;
  label: string;
  /** Integer 1–100 for the level bar. */
  level: number;
};

const STAT_ORDER: Array<{ key: StatLevelKey; label: string }> = [
  { key: "accel", label: "Beschleunigung" },
  { key: "topSpeed", label: "Tempo" },
  { key: "grip", label: "Grip" },
  { key: "handling", label: "Handling" },
  { key: "suspension", label: "Federung" },
  { key: "armor", label: "Panzerung" },
  { key: "mass", label: "Gewicht" },
  { key: "nitro", label: "Nitro" },
];

/** Core vehicle stats are clamped ~0.35–2.2 in mergeStats. */
const CORE_MIN = 0.35;
const CORE_MAX = 2.2;

/** Nitro bonus is additive (~0–0.7 typical). */
const NITRO_MIN = 0;
const NITRO_MAX = 0.7;

/**
 * Map a raw multiplier into a kid-readable 1–100 level.
 * 1.0 ≈ mid-50s for core stats.
 */
export function toStatLevel(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  const t = (value - min) / (max - min);
  return Math.max(1, Math.min(100, Math.round(t * 99 + 1)));
}

export function carStatLevels(
  stats: VehicleStats & { nitroBonus?: number },
): StatLevelRow[] {
  const nitro = stats.nitroBonus ?? 0;
  const values: Record<StatLevelKey, number> = {
    accel: toStatLevel(stats.accel, CORE_MIN, CORE_MAX),
    topSpeed: toStatLevel(stats.topSpeed, CORE_MIN, CORE_MAX),
    grip: toStatLevel(stats.grip, CORE_MIN, CORE_MAX),
    handling: toStatLevel(stats.handling, CORE_MIN, CORE_MAX),
    suspension: toStatLevel(stats.suspension, CORE_MIN, CORE_MAX),
    armor: toStatLevel(stats.armor, CORE_MIN, CORE_MAX),
    mass: toStatLevel(stats.mass, CORE_MIN, CORE_MAX),
    nitro: toStatLevel(nitro, NITRO_MIN, NITRO_MAX),
  };
  return STAT_ORDER.map(({ key, label }) => ({ key, label, level: values[key] }));
}

/** CSS modifier for bar fill color (comic readable). */
export function levelTone(level: number): "low" | "mid" | "high" {
  if (level >= 70) return "high";
  if (level >= 40) return "mid";
  return "low";
}

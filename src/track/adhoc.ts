import type { LevelDefinition, TrackSegment } from "./types";

export type AdhocLength = "short" | "medium" | "long";

export interface AdhocParams {
  seed: string;
  length?: AdhocLength;
  curviness?: number;
  unevenRatio?: number;
  grassWidth?: number;
  theme?: string;
  laps?: number;
}

const THEMES = ["harbor", "canyon", "city", "scrapyard", "mountain", "beach", "factory"] as const;
const SEED_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Normalize to 4 shareable chars (e.g. A7F2). */
export function normalizeSeed(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length === 0) return "A7F2";
  return cleaned.padEnd(4, "0").slice(0, 4);
}

export function randomSeed(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += SEED_CHARS[Math.floor(rand() * SEED_CHARS.length)]!;
  }
  return out;
}

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (const ch of normalizeSeed(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed || 1;
  }
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
}

function cornerPlan(rng: Rng, curviness: number): number[] {
  // Angles that sum to 360° so the stitch closes cleanly.
  if (curviness < 0.35) return [90, 90, 90, 90];
  if (curviness > 0.7) {
    const parts = rng.chance(0.5) ? [60, 60, 60, 60, 60, 60] : [45, 45, 90, 45, 45, 90];
    return parts;
  }
  return rng.chance(0.4) ? [90, 60, 120, 90] : [90, 90, 90, 90];
}

function lengthScale(length: AdhocLength): { straight: [number, number]; laps: number } {
  if (length === "short") return { straight: [22, 38], laps: 2 };
  if (length === "long") return { straight: [36, 58], laps: 3 };
  return { straight: [28, 48], laps: 3 };
}

/** Build a closed, rule-legal ad-hoc level from a seed + light params. */
export function generateAdhocLevel(params: AdhocParams): LevelDefinition {
  const seed = normalizeSeed(params.seed);
  const rng = new Rng(hashSeed(seed));
  const length = params.length ?? (rng.pick(["short", "medium", "long"] as const));
  const curviness = params.curviness ?? rng.range(0.35, 0.75);
  const unevenRatio = params.unevenRatio ?? rng.range(0.1, 0.35);
  const grassWidth = params.grassWidth ?? rng.range(2.5, 4.2);
  const theme = params.theme ?? rng.pick(THEMES);
  const scale = lengthScale(length);
  const laps = params.laps ?? scale.laps;

  const corners = cornerPlan(rng, curviness);
  // Ensure sum ≈ 360
  const sum = corners.reduce((a, b) => a + b, 0);
  if (sum !== 360 && corners.length > 0) {
    corners[corners.length - 1]! += 360 - sum;
  }

  const segments: TrackSegment[] = [];
  const width = 12;

  for (let i = 0; i < corners.length; i++) {
    const straightLen = rng.range(scale.straight[0], scale.straight[1]);
    if (rng.chance(unevenRatio)) {
      segments.push({
        type: "uneven_field",
        length: straightLen * 0.85,
        width,
        intensity: rng.range(0.35, 0.7),
      });
    } else if (rng.chance(0.18)) {
      segments.push({ type: "choke", length: straightLen * 0.7, width: 9 });
    } else {
      segments.push({ type: "straight", length: straightLen, width });
    }

    const angleDeg = corners[i]!;
    const radius = rng.range(14, 22) * (curviness > 0.65 ? 0.92 : 1);
    if (rng.chance(0.22) && angleDeg === 90) {
      segments.push({ type: "s_curve", width });
    } else {
      const type = rng.chance(0.5) ? "curve_r" : "curve_l";
      segments.push({ type, radius, angleDeg, width });
    }
  }

  const purseBase = [320, 230, 180, 140, 110, 90];

  return {
    id: `adhoc_${seed}`,
    kind: "adhoc",
    displayName: `Ad-hoc #${seed}`,
    description: `Zufallsstrecke ${seed} · ${theme} · ${length}`,
    theme,
    laps,
    recommendedClass: "sport",
    gripMultiplier: 1,
    track: {
      closedLoop: true,
      asphaltWidth: width,
      grassWidth,
      segments,
      walls: { rule: "tire_in_corners_concrete_on_straights" },
    },
    obstacles: [],
    spawn: {
      grid: [
        [-10, -3],
        [-10, 3],
        [-16, -3],
        [-16, 3],
        [-22, -3],
        [-22, 3],
      ],
      headingDeg: 0,
    },
    rewards: {
      currency: "CHF",
      placePurse: purseBase,
      starsOnTop3: false,
    },
  };
}

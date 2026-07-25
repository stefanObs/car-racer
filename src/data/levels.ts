import type { LevelDefinition } from "../track/types";

function baseSegments(scale: number, uneven = false): LevelDefinition["track"]["segments"] {
  const segs: LevelDefinition["track"]["segments"] = [
    { type: "straight", length: 45 * scale, width: 12 },
    { type: "curve_r", radius: 18 * scale, angleDeg: 90, width: 12 },
    { type: "straight", length: 30 * scale, width: 12 },
    { type: "curve_r", radius: 16 * scale, angleDeg: 90, width: 12 },
    { type: "straight", length: 40 * scale, width: 12 },
    { type: "curve_r", radius: 18 * scale, angleDeg: 90, width: 12 },
    { type: "straight", length: 28 * scale, width: 12 },
    { type: "curve_r", radius: 16 * scale, angleDeg: 90, width: 12 },
  ];
  if (uneven) {
    segs.splice(2, 0, { type: "uneven_field", length: 22 * scale, width: 12, intensity: 0.55 });
  }
  return segs;
}

function makeCup(
  index: number,
  id: string,
  displayName: string,
  description: string,
  theme: string,
  opts: { scale?: number; uneven?: boolean; grass?: number; laps?: number; purse?: number[] },
): LevelDefinition {
  return {
    id,
    kind: "cup",
    displayName,
    description,
    theme,
    classCup: "sport",
    cupIndex: index,
    laps: opts.laps ?? 3,
    recommendedClass: "sport",
    gripMultiplier: 1,
    track: {
      closedLoop: true,
      asphaltWidth: 12,
      grassWidth: opts.grass ?? 3,
      segments: baseSegments(opts.scale ?? 1, opts.uneven),
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
      // Tuned for 7–15 min sessions: 2× 4th ≈ starter part; 1st buys a solid early part.
      placePurse: opts.purse ?? [420, 300, 240, 180, 140, 110],
      starsOnTop3: true,
    },
  };
}

export const CUP_LEVELS: LevelDefinition[] = [
  makeCup(1, "blitz_cup_01_hafenstart", "Hafenstart", "Einführung — Linie halten, Gras meiden.", "harbor", {
    scale: 1,
    laps: 2,
  }),
  makeCup(2, "blitz_cup_02_kuestenline", "Küstenlinie", "Etwas engere Kurven am Wasser.", "beach", {
    scale: 1.05,
    grass: 4,
    laps: 2,
  }),
  makeCup(3, "blitz_cup_03_stadtring", "Stadtring", "Baustellen-Feeling, erste Unebenheiten.", "city", {
    scale: 1.1,
    uneven: true,
    laps: 3,
  }),
  makeCup(4, "blitz_cup_04_buckelpiste", "Buckelpiste", "Federung zahlt sich aus.", "factory", {
    scale: 1.05,
    uneven: true,
    grass: 3.5,
    purse: [480, 340, 260, 200, 150, 120],
  }),
  makeCup(5, "blitz_cup_05_cupfinale", "Cup-Finale", "Längere Runde — sauber fahren und davonziehen.", "canyon", {
    scale: 1.2,
    uneven: true,
    laps: 3,
    purse: [600, 420, 300, 220, 160, 130],
  }),
];

export function levelById(id: string): LevelDefinition | undefined {
  return CUP_LEVELS.find((l) => l.id === id);
}

export function freeLevels(unlockedIds: string[]): LevelDefinition[] {
  return CUP_LEVELS.filter((l) => unlockedIds.includes(l.id)).map((l) => ({
    ...l,
    kind: "free",
    rewards: { ...l.rewards, starsOnTop3: false, placePurse: l.rewards.placePurse.map((v) => Math.round(v * 0.8)) },
  }));
}

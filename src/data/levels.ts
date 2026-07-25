import type { LevelDefinition, TrackSegment } from "../track/types";

/** Harbor — wide port oval, long straights for containers as backdrop. */
function harborSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 55, width: 13 },
    { type: "curve_r", radius: 20, angleDeg: 90, width: 13 },
    { type: "straight", length: 38, width: 13 },
    { type: "curve_r", radius: 18, angleDeg: 90, width: 12 },
    { type: "straight", length: 50, width: 13 },
    { type: "curve_r", radius: 20, angleDeg: 90, width: 13 },
    { type: "straight", length: 32, width: 12 },
    { type: "curve_r", radius: 17, angleDeg: 90, width: 12 },
  ];
}

/** Coast — flowing S-curves and hairpins along the water. */
function beachSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 36, width: 11 },
    { type: "s_curve", length: 40, width: 11 },
    { type: "straight", length: 22, width: 11 },
    { type: "curve_l", radius: 14, angleDeg: 110, width: 10 },
    { type: "straight", length: 28, width: 11 },
    { type: "curve_r", radius: 15, angleDeg: 100, width: 10 },
    { type: "straight", length: 24, width: 11 },
    { type: "curve_l", radius: 16, angleDeg: 80, width: 11 },
    { type: "straight", length: 20, width: 11 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 10 },
  ];
}

/** City ring — tight blocks, choke, cobble uneven. */
function citySegments(): TrackSegment[] {
  return [
    { type: "straight", length: 28, width: 11 },
    { type: "curve_r", radius: 12, angleDeg: 90, width: 10 },
    { type: "choke", length: 18, width: 8 },
    { type: "uneven_field", length: 20, width: 11, intensity: 0.45 },
    { type: "curve_r", radius: 13, angleDeg: 90, width: 10 },
    { type: "straight", length: 24, width: 11 },
    { type: "curve_l", radius: 11, angleDeg: 70, width: 10 },
    { type: "straight", length: 16, width: 10 },
    { type: "curve_r", radius: 12, angleDeg: 100, width: 10 },
    { type: "straight", length: 22, width: 11 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 11 },
  ];
}

/** Buckelpiste / factory — plateaus of uneven field. */
function factorySegments(): TrackSegment[] {
  return [
    { type: "straight", length: 30, width: 12 },
    { type: "uneven_field", length: 26, width: 12, intensity: 0.65 },
    { type: "curve_r", radius: 16, angleDeg: 85, width: 11 },
    { type: "straight", length: 18, width: 12 },
    { type: "uneven_field", length: 24, width: 12, intensity: 0.7 },
    { type: "curve_l", radius: 15, angleDeg: 95, width: 11 },
    { type: "choke", length: 16, width: 9 },
    { type: "uneven_field", length: 20, width: 11, intensity: 0.55 },
    { type: "curve_r", radius: 17, angleDeg: 90, width: 12 },
    { type: "straight", length: 26, width: 12 },
    { type: "curve_r", radius: 15, angleDeg: 90, width: 11 },
  ];
}

/** Cup finale / canyon — long, sharp hairpins, dramatic chokes. */
function canyonSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 48, width: 12 },
    { type: "curve_r", radius: 11, angleDeg: 130, width: 10 },
    { type: "straight", length: 34, width: 12 },
    { type: "choke", length: 22, width: 8 },
    { type: "curve_l", radius: 12, angleDeg: 120, width: 10 },
    { type: "uneven_field", length: 28, width: 11, intensity: 0.5 },
    { type: "straight", length: 40, width: 12 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 11 },
    { type: "s_curve", length: 36, width: 11 },
    { type: "curve_l", radius: 13, angleDeg: 100, width: 10 },
    { type: "straight", length: 30, width: 12 },
    { type: "curve_r", radius: 16, angleDeg: 90, width: 12 },
  ];
}

const LAYOUTS: Record<string, () => TrackSegment[]> = {
  harbor: harborSegments,
  beach: beachSegments,
  city: citySegments,
  factory: factorySegments,
  canyon: canyonSegments,
};

function makeCup(
  index: number,
  id: string,
  displayName: string,
  description: string,
  theme: keyof typeof LAYOUTS,
  opts: {
    grass?: number;
    asphaltWidth?: number;
    laps?: number;
    purse?: number[];
    obstacles?: LevelDefinition["obstacles"];
  },
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
      asphaltWidth: opts.asphaltWidth ?? 12,
      grassWidth: opts.grass ?? 3,
      segments: LAYOUTS[theme]!(),
      walls: { rule: "tire_in_corners_concrete_on_straights" },
    },
    obstacles: opts.obstacles ?? [],
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
      placePurse: opts.purse ?? [420, 300, 240, 180, 140, 110],
      starsOnTop3: true,
    },
  };
}

export const CUP_LEVELS: LevelDefinition[] = [
  makeCup(1, "blitz_cup_01_hafenstart", "Hafenstart", "Einführung — Linie halten, Gras meiden.", "harbor", {
    laps: 2,
    asphaltWidth: 13,
    grass: 3,
  }),
  makeCup(2, "blitz_cup_02_kuestenline", "Küstenlinie", "S-Kurven und Haarspitzen am Wasser.", "beach", {
    grass: 5,
    asphaltWidth: 11,
    laps: 2,
  }),
  makeCup(3, "blitz_cup_03_stadtring", "Stadtring", "Engstellen und Buckelpflaster.", "city", {
    grass: 2.5,
    asphaltWidth: 11,
    laps: 3,
    obstacles: [
      { type: "concrete_barrier", position: [14, 2], radius: 1.2 },
      { type: "concrete_barrier", position: [14, -2], radius: 1.2 },
    ],
  }),
  makeCup(4, "blitz_cup_04_buckelpiste", "Buckelpiste", "Federung zahlt sich aus — Wellenplatte.", "factory", {
    grass: 3.5,
    asphaltWidth: 12,
    purse: [480, 340, 260, 200, 150, 120],
    obstacles: [
      { type: "tire_stack", position: [20, 0], radius: 1.5 },
      { type: "tire_stack", position: [55, 3], radius: 1.5 },
    ],
  }),
  makeCup(5, "blitz_cup_05_cupfinale", "Cup-Finale", "Lange Canyon-Runde mit Haarspitzen.", "canyon", {
    grass: 3,
    asphaltWidth: 12,
    laps: 3,
    purse: [600, 420, 300, 220, 160, 130],
    obstacles: [{ type: "uneven", position: [30, 0], radius: 8, intensity: 0.5 }],
  }),
];

export function levelById(id: string): LevelDefinition | undefined {
  return CUP_LEVELS.find((l) => l.id === id);
}

export function freeLevels(unlockedIds: string[]): LevelDefinition[] {
  return CUP_LEVELS.filter((l) => unlockedIds.includes(l.id)).map((l) => ({
    ...l,
    kind: "free",
    rewards: {
      ...l.rewards,
      starsOnTop3: false,
      placePurse: l.rewards.placePurse.map((v) => Math.round(v * 0.8)),
    },
  }));
}

/** For tests: segment-type fingerprint of a cup layout. */
export function layoutFingerprint(level: LevelDefinition): string {
  return level.track.segments.map((s) => `${s.type}:${s.length ?? s.angleDeg ?? 0}`).join("|");
}

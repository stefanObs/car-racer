import type { LevelDefinition, TrackSegment } from "../track/types";
import { buildTrackFromLevel } from "../track/buildTrack";
import { pointOnTrack } from "../track/validateTrack";

/**
 * All cup layouts use consistent turn direction (curve_r only) so the loop
 * cannot self-intersect. No figure-8 without an explicit bridge (CONCEPT §4.4).
 */

/** Harbor — wide port oval, long straights. */
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

/** Coast — wide oval with soft radius changes (one turn direction, no cross). */
function beachSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 48, width: 11 },
    { type: "curve_r", radius: 22, angleDeg: 90, width: 11 },
    { type: "straight", length: 34, width: 11 },
    { type: "curve_r", radius: 16, angleDeg: 90, width: 10 },
    { type: "straight", length: 44, width: 11 },
    { type: "curve_r", radius: 20, angleDeg: 90, width: 11 },
    { type: "straight", length: 30, width: 11 },
    { type: "curve_r", radius: 15, angleDeg: 90, width: 10 },
  ];
}

/** City ring — rectangle with choke + cobble field on the ribbon. */
function citySegments(): TrackSegment[] {
  return [
    { type: "straight", length: 32, width: 11 },
    { type: "curve_r", radius: 13, angleDeg: 90, width: 10 },
    { type: "choke", length: 20, width: 8 },
    { type: "uneven_field", length: 22, width: 11, intensity: 0.45 },
    { type: "curve_r", radius: 13, angleDeg: 90, width: 10 },
    { type: "straight", length: 28, width: 11 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 11 },
    { type: "straight", length: 24, width: 11 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 11 },
  ];
}

/** Buckelpiste — uneven plates on a clear oval corridor. */
function factorySegments(): TrackSegment[] {
  return [
    { type: "straight", length: 34, width: 12 },
    { type: "uneven_field", length: 28, width: 12, intensity: 0.65 },
    { type: "curve_r", radius: 17, angleDeg: 90, width: 11 },
    { type: "straight", length: 22, width: 12 },
    { type: "uneven_field", length: 26, width: 12, intensity: 0.7 },
    { type: "curve_r", radius: 16, angleDeg: 90, width: 11 },
    { type: "choke", length: 18, width: 9 },
    { type: "uneven_field", length: 20, width: 11, intensity: 0.55 },
    { type: "curve_r", radius: 17, angleDeg: 90, width: 12 },
    { type: "straight", length: 28, width: 12 },
    { type: "curve_r", radius: 15, angleDeg: 90, width: 11 },
  ];
}

/** Cup finale — long canyon oval, hairpin radii, one turn direction. */
function canyonSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 52, width: 12 },
    { type: "curve_r", radius: 12, angleDeg: 120, width: 10 },
    { type: "straight", length: 36, width: 12 },
    { type: "choke", length: 20, width: 8 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 10 },
    { type: "uneven_field", length: 30, width: 11, intensity: 0.5 },
    { type: "straight", length: 44, width: 12 },
    { type: "curve_r", radius: 13, angleDeg: 110, width: 10 },
    { type: "straight", length: 32, width: 12 },
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
    /** Place solid blockers clearly at the verge; racing line stays open. */
    vergeBlockers?: Array<{ type: "tire_stack" | "concrete_barrier"; along: number; side: 1 | -1 }>;
  },
): LevelDefinition {
  const level: LevelDefinition = {
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
      placePurse: opts.purse ?? [420, 300, 240, 180, 140, 110],
      starsOnTop3: true,
    },
  };

  if (opts.vergeBlockers?.length) {
    const track = buildTrackFromLevel(level);
    const edge = track.asphaltHalfWidth - 1.35;
    level.obstacles = opts.vergeBlockers.map((b) => {
      const p = pointOnTrack(track, b.along, b.side * edge);
      return {
        type: b.type,
        position: [p.x, p.z] as [number, number],
        radius: b.type === "tire_stack" ? 1.35 : 1.15,
      };
    });
  }

  return level;
}

export const CUP_LEVELS: LevelDefinition[] = [
  makeCup(1, "blitz_cup_01_hafenstart", "Hafenstart", "Einführung — klare Ovalbahn, Gras meiden.", "harbor", {
    laps: 2,
    asphaltWidth: 13,
    grass: 3,
  }),
  makeCup(2, "blitz_cup_02_kuestenline", "Küstenlinie", "Fließendes Oval am Wasser — eine klare Fahrspur.", "beach", {
    grass: 5,
    asphaltWidth: 11,
    laps: 2,
  }),
  makeCup(3, "blitz_cup_03_stadtring", "Stadtring", "Engstellen und Buckelpflaster — Mitte frei, Sperren am Rand.", "city", {
    grass: 2.5,
    asphaltWidth: 11,
    laps: 3,
    vergeBlockers: [
      { type: "concrete_barrier", along: 18, side: 1 },
      { type: "concrete_barrier", along: 42, side: -1 },
    ],
  }),
  makeCup(4, "blitz_cup_04_buckelpiste", "Buckelpiste", "Federung zählt — Wellen auf der Bahn, Reifenstapel am Rand.", "factory", {
    grass: 3.5,
    asphaltWidth: 12,
    purse: [480, 340, 260, 200, 150, 120],
    vergeBlockers: [
      { type: "tire_stack", along: 24, side: 1 },
      { type: "tire_stack", along: 70, side: -1 },
    ],
  }),
  makeCup(5, "blitz_cup_05_cupfinale", "Cup-Finale", "Lange Canyon-Runde — Haarspitzen, eine Spur, keine Kreuzung.", "canyon", {
    grass: 3,
    asphaltWidth: 12,
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

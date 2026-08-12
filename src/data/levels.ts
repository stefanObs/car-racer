import type { LevelDefinition, TrackSegment } from "../track/types";
import { buildTrackFromLevel } from "../track/buildTrack";
import { pointOnTrack } from "../track/validateTrack";

/**
 * Cup layouts — unique silhouettes per race (one primary turn direction so
 * the loop cannot self-intersect; no figure-8 without a bridge — CONCEPT §4.4).
 * Cup 1 Hafenstart stays; cups 2–5 follow track-proposals (Parabolbogen…).
 */

/** Hafenstart — wide port stadium (intro). Unchanged. */
function harborSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 62, width: 13 },
    { type: "curve_r", radius: 22, angleDeg: 90, width: 13 },
    { type: "straight", length: 28, width: 13 },
    { type: "curve_r", radius: 22, angleDeg: 90, width: 12 },
    { type: "straight", length: 62, width: 13 },
    { type: "curve_r", radius: 22, angleDeg: 90, width: 13 },
    { type: "straight", length: 28, width: 12 },
    { type: "curve_r", radius: 22, angleDeg: 90, width: 12 },
  ];
}

/** Parabolbogen — long S/F straight, huge high-speed arc, hairpin, short choke. */
function parabolbogenSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 88, width: 12 },
    { type: "curve_r", radius: 48, angleDeg: 200, width: 11 },
    { type: "straight", length: 16, width: 12 },
    { type: "curve_r", radius: 11, angleDeg: 160, width: 9 },
    { type: "straight", length: 22, width: 11 },
    { type: "choke", length: 14, width: 8 },
  ];
}

/**
 * Schikanenring — compact technical ring with dual-line Schikane (risk/reward via
 * verge blockers + inner oil/uneven on a wide ribbon; see makeCup hazards).
 */
function schikanenringSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 34, width: 13 },
    { type: "curve_r", radius: 13, angleDeg: 90, width: 11 },
    { type: "straight", length: 20, width: 12 },
    { type: "choke", length: 16, width: 8 },
    { type: "curve_r", radius: 12, angleDeg: 90, width: 10 },
    { type: "straight", length: 28, width: 13 },
    { type: "curve_r", radius: 11, angleDeg: 90, width: 10 },
    { type: "choke", length: 18, width: 7.5 },
    { type: "uneven_field", length: 14, width: 12, intensity: 0.45 },
    { type: "curve_r", radius: 13, angleDeg: 90, width: 11 },
  ];
}

/** Omegatal — closed non-crossing loop: tight hairpin, wide omega lobe, waterfall uneven. */
function omegatalSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 42, width: 12 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 9 },
    { type: "straight", length: 22, width: 11 },
    { type: "curve_r", radius: 32, angleDeg: 90, width: 11 },
    { type: "straight", length: 18, width: 11 },
    { type: "curve_r", radius: 14, angleDeg: 90, width: 10 },
    { type: "uneven_field", length: 36, width: 11, intensity: 0.7 },
    { type: "curve_r", radius: 16, angleDeg: 90, width: 10 },
  ];
}

/** Kuppenfinale — boss: long legs, many Kuppen, choke, mixed uneven (triangle-ish). */
function kuppenfinaleSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 72, width: 12 },
    { type: "uneven_field", length: 28, width: 12, intensity: 0.7 },
    { type: "curve_r", radius: 12, angleDeg: 120, width: 9 },
    { type: "straight", length: 40, width: 12 },
    { type: "uneven_field", length: 24, width: 11, intensity: 0.75 },
    { type: "choke", length: 16, width: 8 },
    { type: "curve_r", radius: 12, angleDeg: 120, width: 9 },
    { type: "straight", length: 55, width: 12 },
    { type: "uneven_field", length: 20, width: 12, intensity: 0.65 },
    { type: "curve_r", radius: 13, angleDeg: 120, width: 10 },
  ];
}

const LAYOUTS: Record<string, () => TrackSegment[]> = {
  harbor: harborSegments,
  beach: parabolbogenSegments,
  city: schikanenringSegments,
  canyon: omegatalSegments,
  factory: kuppenfinaleSegments,
};

type VergeBlocker = { type: "tire_stack" | "concrete_barrier"; along: number; side: 1 | -1 };
type RibbonHazard = { type: "ramp" | "uneven" | "oil"; along: number; side?: number; radius?: number; intensity?: number };

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
    vergeBlockers?: VergeBlocker[];
    ribbonHazards?: RibbonHazard[];
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

  const track = buildTrackFromLevel(level);
  const edge = track.asphaltHalfWidth - 1.35;

  if (opts.vergeBlockers?.length) {
    for (const b of opts.vergeBlockers) {
      const p = pointOnTrack(track, b.along, b.side * edge);
      level.obstacles.push({
        type: b.type,
        position: [p.x, p.z],
        radius: b.type === "tire_stack" ? 1.35 : 1.15,
      });
    }
  }

  if (opts.ribbonHazards?.length) {
    for (const h of opts.ribbonHazards) {
      const lateral = (h.side ?? 0) * (track.asphaltHalfWidth * 0.25);
      const p = pointOnTrack(track, h.along, lateral);
      level.obstacles.push({
        type: h.type,
        position: [p.x, p.z],
        radius: h.radius ?? (h.type === "ramp" ? 4.5 : h.type === "oil" ? 2.2 : 5),
        intensity: h.intensity ?? (h.type === "ramp" ? 0.9 : 0.55),
      });
    }
  }

  return level;
}

export const CUP_LEVELS: LevelDefinition[] = [
  makeCup(1, "blitz_cup_01_hafenstart", "Hafenstart", "Einführung — weites Hafen-Oval, Gras meiden.", "harbor", {
    laps: 2,
    asphaltWidth: 13,
    grass: 3,
  }),
  makeCup(
    2,
    "blitz_cup_02_kuestenline",
    "Parabolbogen",
    "Lange Gerade, riesiger Tempo-Bogen, enge Haarnadel — spät bremsen.",
    "beach",
    {
      grass: 5,
      asphaltWidth: 12,
      laps: 2,
      ribbonHazards: [{ type: "uneven", along: 70, intensity: 0.4, radius: 5 }],
    },
  ),
  makeCup(
    3,
    "blitz_cup_03_stadtring",
    "Schikanenring",
    "Risk/Reward-Schikane: sichere Linie oder Hot Line mit Hindernissen.",
    "city",
    {
      grass: 2.5,
      asphaltWidth: 13,
      laps: 3,
      vergeBlockers: [
        { type: "concrete_barrier", along: 48, side: 1 },
        { type: "concrete_barrier", along: 52, side: -1 },
        { type: "tire_stack", along: 56, side: 1 },
        { type: "concrete_barrier", along: 120, side: 1 },
        { type: "concrete_barrier", along: 126, side: -1 },
        { type: "tire_stack", along: 132, side: -1 },
      ],
      ribbonHazards: [
        { type: "oil", along: 54, side: -1, radius: 2.2 },
        { type: "uneven", along: 58, side: -1, intensity: 0.55, radius: 4 },
        { type: "oil", along: 128, side: -1, radius: 2.1 },
        { type: "uneven", along: 134, side: -1, intensity: 0.5, radius: 4 },
      ],
    },
  ),
  makeCup(
    4,
    "blitz_cup_04_buckelpiste",
    "Omegatal",
    "Omega-Doppelkurve, blinde Kuppe, Wasserfall-Abfahrt — Federung zählt.",
    "canyon",
    {
      grass: 3,
      asphaltWidth: 12,
      purse: [480, 340, 260, 200, 150, 120],
      vergeBlockers: [
        { type: "tire_stack", along: 30, side: 1 },
        { type: "tire_stack", along: 95, side: -1 },
      ],
      ribbonHazards: [
        { type: "uneven", along: 150, intensity: 0.75, radius: 6 },
        { type: "ramp", along: 165, intensity: 0.95, radius: 5 },
        { type: "uneven", along: 180, intensity: 0.65, radius: 5 },
      ],
    },
  ),
  makeCup(
    5,
    "blitz_cup_05_cupfinale",
    "Kuppenfinale",
    "Cup-Boss — lange Schenkel, viele Kuppen, Schanze und knifflige Ecken.",
    "factory",
    {
      grass: 3.5,
      asphaltWidth: 12,
      laps: 3,
      purse: [600, 420, 300, 220, 160, 130],
      vergeBlockers: [
        { type: "tire_stack", along: 40, side: 1 },
        { type: "concrete_barrier", along: 160, side: -1 },
      ],
      ribbonHazards: [
        { type: "ramp", along: 55, intensity: 1, radius: 5.5 },
        { type: "uneven", along: 100, intensity: 0.7, radius: 6 },
        { type: "ramp", along: 200, intensity: 0.9, radius: 5 },
        { type: "oil", along: 250, radius: 2.3 },
        { type: "uneven", along: 280, intensity: 0.65, radius: 5 },
      ],
    },
  ),
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

import type { LevelDefinition, TrackSegment } from "../track/types";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../track/buildTrack";
import { planMedianBarriers } from "../track/medianBarriers";
import { pointOnTrack } from "../track/validateTrack";

/** Yaw so local +Z aligns with track tangent (tx, tz). */
export function yawFromTangent(tx: number, tz: number): number {
  return Math.atan2(tx, tz);
}
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

/** Parabolbogen — long S/F straight, huge high-speed arc, technical return (S + hairpin). */
function parabolbogenSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 92, width: 12 },
    { type: "curve_r", radius: 50, angleDeg: 205, width: 11 },
    { type: "straight", length: 14, width: 11 },
    { type: "s_curve", width: 10 },
    { type: "curve_l", radius: 12, angleDeg: 95, width: 9 },
    { type: "curve_r", radius: 11, angleDeg: 85, width: 9 },
    { type: "straight", length: 18, width: 11 },
    { type: "choke", length: 12, width: 8 },
  ];
}

/**
 * Schikanenring — technical ring with dual-line Schikane (risk/reward via
 * inner oil/uneven hot line; solids stay in grass / median — see makeCup).
 * Wider corners so parallel legs stay farther apart.
 */
function schikanenringSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 60, width: 13 },
    { type: "s_curve", width: 11 },
    { type: "straight", length: 42, width: 12 },
    { type: "curve_r", radius: 32, angleDeg: 90, width: 11 },
    { type: "straight", length: 55, width: 12 },
    { type: "s_curve", width: 10 },
    { type: "straight", length: 40, width: 12 },
    { type: "curve_r", radius: 32, angleDeg: 90, width: 11 },
    { type: "straight", length: 45, width: 12 },
    { type: "curve_r", radius: 30, angleDeg: 90, width: 11 },
    { type: "straight", length: 34, width: 12 },
    { type: "curve_r", radius: 30, angleDeg: 90, width: 11 },
  ];
}

/** Omegatal — hairpin, omega lobe (L+R), waterfall uneven; opened so legs do not hop. */
function omegatalSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 72, width: 12 },
    { type: "curve_r", radius: 24, angleDeg: 125, width: 9 },
    { type: "straight", length: 50, width: 11 },
    { type: "uneven_field", length: 18, width: 11, intensity: 0.55 },
    { type: "curve_l", radius: 50, angleDeg: 75, width: 11 },
    { type: "straight", length: 40, width: 11 },
    { type: "curve_r", radius: 30, angleDeg: 70, width: 10 },
    { type: "uneven_field", length: 30, width: 11, intensity: 0.75 },
    { type: "curve_r", radius: 26, angleDeg: 90, width: 10 },
  ];
}

/** Kuppenfinale — boss: Kuppen + choke on a wider stadium so ribbons do not overlap. */
function kuppenfinaleSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 80, width: 12 },
    { type: "uneven_field", length: 24, width: 12, intensity: 0.7 },
    { type: "curve_r", radius: 30, angleDeg: 90, width: 10 },
    { type: "straight", length: 40, width: 12 },
    { type: "uneven_field", length: 20, width: 11, intensity: 0.75 },
    { type: "choke", length: 14, width: 8 },
    { type: "curve_r", radius: 28, angleDeg: 90, width: 10 },
    { type: "straight", length: 65, width: 12 },
    { type: "uneven_field", length: 18, width: 12, intensity: 0.65 },
    { type: "curve_r", radius: 30, angleDeg: 90, width: 10 },
    { type: "straight", length: 40, width: 12 },
    { type: "curve_r", radius: 28, angleDeg: 90, width: 10 },
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
    laps: opts.laps ?? 5,
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

  if (opts.vergeBlockers?.length) {
    for (const b of opts.vergeBlockers) {
      const p = placeSolidInGrass(track, b.along, b.side);
      const tan = sampleCenterline(track, b.along).tangent;
      level.obstacles.push({
        type: b.type,
        position: [p.x, p.z],
        radius: b.type === "tire_stack" ? 1.35 : 1.15,
        heading: yawFromTangent(tan.x, tan.z),
      });
    }
  }

  if (opts.ribbonHazards?.length) {
    for (const h of opts.ribbonHazards) {
      // Passable hazards may sit on asphalt; bias toward the named side (hot line).
      const lateral = (h.side ?? 0) * (track.asphaltHalfWidth * 0.35);
      const p = pointOnTrack(track, h.along, lateral);
      const tan = sampleCenterline(track, h.along).tangent;
      level.obstacles.push({
        type: h.type,
        position: [p.x, p.z],
        radius: h.radius ?? (h.type === "ramp" ? 4.5 : h.type === "oil" ? 2.2 : 5),
        intensity: h.intensity ?? (h.type === "ramp" ? 0.9 : 0.55),
        heading: yawFromTangent(tan.x, tan.z),
      });
    }
  }

  for (const m of planMedianBarriers(track)) {
    level.obstacles.push({
      type: m.type,
      position: [m.x, m.z],
      radius: m.type === "tire_stack" ? 1.45 : 1.25,
      heading: m.heading,
      role: "median",
    });
  }

  return level;
}

/** Push solids into grass until nearest-track lateral clears asphalt (tight loops). */
function placeSolidInGrass(
  track: ReturnType<typeof buildTrackFromLevel>,
  along: number,
  side: 1 | -1,
): { x: number; z: number } {
  const minClear = track.asphaltHalfWidth + 0.55;
  let dist = track.asphaltHalfWidth + Math.min(1.4, Math.max(0.9, track.grassWidth * 0.5));
  let p = pointOnTrack(track, along, side * dist);
  for (let i = 0; i < 48; i++) {
    const near = nearestOnTrack(track, p);
    if (Math.abs(near.lateral) >= minClear) return p;
    dist += 2.2;
    p = pointOnTrack(track, along, side * dist);
  }
  return p;
}

export const CUP_LEVELS: LevelDefinition[] = [
  makeCup(1, "blitz_cup_01_hafenstart", "Hafenstart", "Einführung — weites Hafen-Oval, Gras meiden.", "harbor", {
    laps: 5,
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
      laps: 5,
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
      grass: 3,
      asphaltWidth: 13,
      laps: 5,
      // Grass-side markers only — asphalt stays clear for the safe line.
      vergeBlockers: [
        { type: "tire_stack", along: 55, side: 1 },
        { type: "tire_stack", along: 62, side: -1 },
        { type: "concrete_barrier", along: 160, side: 1 },
        { type: "tire_stack", along: 170, side: -1 },
      ],
      // Hot line: passable oil/uneven biased inward (side -1).
      ribbonHazards: [
        { type: "oil", along: 58, side: -1, radius: 2.2 },
        { type: "uneven", along: 65, side: -1, intensity: 0.55, radius: 4 },
        { type: "oil", along: 165, side: -1, radius: 2.1 },
        { type: "uneven", along: 175, side: -1, intensity: 0.5, radius: 4 },
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
      grass: 3.5,
      asphaltWidth: 12,
      purse: [480, 340, 260, 200, 150, 120],
      vergeBlockers: [
        { type: "tire_stack", along: 28, side: 1 },
        { type: "tire_stack", along: 100, side: -1 },
      ],
      ribbonHazards: [
        { type: "uneven", along: 70, intensity: 0.55, radius: 5 },
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
      laps: 5,
      purse: [600, 420, 300, 220, 160, 130],
      vergeBlockers: [
        { type: "tire_stack", along: 40, side: 1 },
        { type: "concrete_barrier", along: 160, side: -1 },
        { type: "tire_stack", along: 220, side: 1 },
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

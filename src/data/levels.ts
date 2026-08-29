import type { LevelClearanceGauge, LevelDefinition, LevelPanorama, LevelSceneryPlacement, TrackSegment } from "../track/types";
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
 * XL scale (~2.5× lap length): wider radii + median barriers block ribbon hops.
 * Long tempo legs use gentle curve_r “bananas” or extra s_curves so they stay
 * interesting without creating hop corridors.
 */

/** Hafenstart — stadium oval with gentle bananas on the long sides. ~840 m. */
function harborSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 90, width: 13 },
    { type: "curve_r", radius: 180, angleDeg: 12, width: 13 },
    { type: "straight", length: 90, width: 13 },
    { type: "curve_r", radius: 30, angleDeg: 78, width: 13 },
    { type: "straight", length: 45, width: 13 },
    { type: "curve_r", radius: 150, angleDeg: 12, width: 13 },
    { type: "straight", length: 45, width: 13 },
    { type: "curve_r", radius: 30, angleDeg: 78, width: 12 },
    { type: "straight", length: 90, width: 13 },
    { type: "curve_r", radius: 180, angleDeg: 12, width: 13 },
    { type: "straight", length: 90, width: 13 },
    { type: "curve_r", radius: 30, angleDeg: 78, width: 13 },
    { type: "straight", length: 45, width: 12 },
    { type: "curve_r", radius: 150, angleDeg: 12, width: 12 },
    { type: "straight", length: 45, width: 12 },
    { type: "curve_r", radius: 30, angleDeg: 78, width: 12 },
  ];
}

/**
 * Parabolbogen — mirrored paperclip (equal radii) so the loop closes with
 * continuous heading at the start/finish; bananas on both longs. ~1160 m.
 */
function parabolbogenSegments(): TrackSegment[] {
  const longLeg: TrackSegment[] = [
    { type: "straight", length: 120, width: 12 },
    { type: "curve_r", radius: 220, angleDeg: 8, width: 12 },
    { type: "straight", length: 100, width: 12 },
    { type: "uneven_field", length: 40, width: 12, intensity: 0.4 },
    { type: "straight", length: 80, width: 12 },
  ];
  return [
    ...longLeg,
    { type: "curve_r", radius: 70, angleDeg: 172, width: 11 },
    ...longLeg,
    { type: "curve_r", radius: 70, angleDeg: 172, width: 10 },
  ];
}

/**
 * Schikanenring — closed rectangle (equal opposite sides) with s_curves on
 * every leg so the ZIEL seam has no heading kink. ~1360 m.
 */
function schikanenringSegments(): TrackSegment[] {
  const L = 340;
  const S = 260;
  const r = 42;
  const long = (width: number): TrackSegment[] => [
    { type: "straight", length: L * 0.42, width },
    { type: "s_curve", width: width - 1 },
    { type: "straight", length: L * 0.42, width },
  ];
  const short = (width: number): TrackSegment[] => [
    { type: "straight", length: S * 0.42, width },
    { type: "s_curve", width: width - 1 },
    { type: "straight", length: S * 0.42, width },
  ];
  return [
    ...long(13),
    { type: "curve_r", radius: r, angleDeg: 90, width: 11 },
    ...short(12),
    { type: "curve_r", radius: r, angleDeg: 90, width: 11 },
    ...long(13),
    { type: "curve_r", radius: r, angleDeg: 90, width: 11 },
    ...short(12),
    { type: "curve_r", radius: r, angleDeg: 90, width: 11 },
  ];
}

/**
 * Omegatal — omega lobe on the approach long, then a rectangle that closes
 * (tuned L2/S). Net turn 360°, seam gap under 1 m. ~1400 m.
 */
function omegatalSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 70, width: 12 },
    { type: "curve_r", radius: 160, angleDeg: 12, width: 12 },
    { type: "straight", length: 50, width: 12 },
    { type: "curve_r", radius: 36, angleDeg: 55, width: 9 },
    { type: "straight", length: 40, width: 11 },
    { type: "uneven_field", length: 50, width: 11, intensity: 0.55 },
    { type: "curve_l", radius: 54, angleDeg: 110, width: 11 },
    { type: "straight", length: 45, width: 11 },
    { type: "uneven_field", length: 70, width: 11, intensity: 0.75 },
    { type: "curve_r", radius: 36, angleDeg: 55, width: 10 },
    { type: "straight", length: 40, width: 11 },
    { type: "curve_r", radius: 35, angleDeg: 78, width: 10 },
    { type: "straight", length: 80, width: 11 },
    { type: "curve_r", radius: 35, angleDeg: 90, width: 10 },
    { type: "straight", length: 170, width: 12 },
    { type: "curve_r", radius: 140, angleDeg: 12, width: 12 },
    { type: "straight", length: 262, width: 12 },
    { type: "curve_r", radius: 35, angleDeg: 78, width: 10 },
    { type: "straight", length: 80, width: 11 },
    { type: "curve_r", radius: 35, angleDeg: 90, width: 10 },
  ];
}

/**
 * Kuppenfinale — mirrored stadium (identical opposite legs) so Kuppen / Schikanen
 * stay on-track without a start/finish U-turn. ~1240 m.
 */
function kuppenfinaleSegments(): TrackSegment[] {
  const leg: TrackSegment[] = [
    { type: "straight", length: 110, width: 12 },
    { type: "curve_r", radius: 180, angleDeg: 10, width: 12 },
    { type: "straight", length: 90, width: 12 },
    { type: "uneven_field", length: 60, width: 12, intensity: 0.7 },
    { type: "straight", length: 50, width: 12 },
    { type: "curve_r", radius: 39, angleDeg: 80, width: 10 },
    { type: "straight", length: 55, width: 12 },
    { type: "s_curve", width: 11 },
    { type: "choke", length: 36, width: 8 },
    { type: "straight", length: 55, width: 12 },
    { type: "curve_r", radius: 36, angleDeg: 90, width: 10 },
  ];
  // Second half mirrors geometry; slightly softer uneven intensity for variety.
  const legB: TrackSegment[] = [
    { type: "straight", length: 110, width: 12 },
    { type: "curve_r", radius: 180, angleDeg: 10, width: 12 },
    { type: "straight", length: 90, width: 12 },
    { type: "uneven_field", length: 60, width: 12, intensity: 0.65 },
    { type: "straight", length: 50, width: 12 },
    { type: "curve_r", radius: 39, angleDeg: 80, width: 10 },
    { type: "straight", length: 55, width: 12 },
    { type: "s_curve", width: 11 },
    { type: "choke", length: 36, width: 8 },
    { type: "straight", length: 55, width: 12 },
    { type: "curve_r", radius: 36, angleDeg: 90, width: 10 },
  ];
  return [...leg, ...legB];
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
    panorama?: LevelPanorama;
    sceneryPlacements?: LevelSceneryPlacement[];
    clearanceGauges?: LevelClearanceGauge[];
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
    ...(opts.panorama ? { panorama: opts.panorama } : {}),
    ...(opts.sceneryPlacements?.length ? { sceneryPlacements: opts.sceneryPlacements } : {}),
    ...(opts.clearanceGauges?.length ? { clearanceGauges: opts.clearanceGauges } : {}),
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
  makeCup(1, "blitz_cup_01_hafenstart", "Hafenstart", "Einführung — Hafen-Oval (~840 m) mit leichten Bögen, Gras meiden.", "harbor", {
    laps: 5,
    asphaltWidth: 13,
    grass: 3,
    panorama: { offsetY: 16, heightScale: 1.5 },
    clearanceGauges: [{ x: 178, y: 0, z: 23, yaw: 0 }],
  }),
  makeCup(
    2,
    "blitz_cup_02_kuestenline",
    "Parabolbogen",
    "XL-Tempo (~1,2 km): Papierclip mit Parabolbögen — Start/Ziel auf der Rennlinie.",
    "beach",
    {
      grass: 5,
      asphaltWidth: 12,
      laps: 5,
      ribbonHazards: [{ type: "uneven", along: 280, intensity: 0.4, radius: 5 }],
    },
  ),
  makeCup(
    3,
    "blitz_cup_03_stadtring",
    "Schikanenring",
    "Technischer Ring (~1,4 km): viele Schikanen — sichere Linie oder Hot Line.",
    "city",
    {
      grass: 3,
      asphaltWidth: 13,
      laps: 5,
      vergeBlockers: [
        { type: "tire_stack", along: 120, side: 1 },
        { type: "tire_stack", along: 140, side: -1 },
        { type: "concrete_barrier", along: 800, side: 1 },
        { type: "tire_stack", along: 820, side: -1 },
      ],
      ribbonHazards: [
        { type: "oil", along: 125, side: -1, radius: 2.2 },
        { type: "uneven", along: 135, side: -1, intensity: 0.55, radius: 4 },
        { type: "oil", along: 810, side: -1, radius: 2.1 },
        { type: "uneven", along: 820, side: -1, intensity: 0.5, radius: 4 },
      ],
    },
  ),
  makeCup(
    4,
    "blitz_cup_04_buckelpiste",
    "Omegatal",
    "Berg-Omega (~1,4 km): Omega-Lappen, Wasserfall — Federung zählt; Start/Ziel im Flow.",
    "canyon",
    {
      grass: 3.5,
      asphaltWidth: 12,
      purse: [480, 340, 260, 200, 150, 120],
      vergeBlockers: [
        { type: "tire_stack", along: 90, side: 1 },
        { type: "tire_stack", along: 400, side: -1 },
      ],
      ribbonHazards: [
        { type: "uneven", along: 220, intensity: 0.55, radius: 5 },
        { type: "uneven", along: 380, intensity: 0.75, radius: 6 },
        { type: "ramp", along: 400, intensity: 0.95, radius: 5 },
        { type: "uneven", along: 420, intensity: 0.65, radius: 5 },
      ],
    },
  ),
  makeCup(
    5,
    "blitz_cup_05_cupfinale",
    "Kuppenfinale",
    "Cup-Boss (~1,2 km): Bögen und Schikanen zwischen Kuppen — Start/Ziel ohne Kehre.",
    "factory",
    {
      grass: 3.5,
      asphaltWidth: 12,
      laps: 5,
      purse: [600, 420, 300, 220, 160, 130],
      vergeBlockers: [
        { type: "tire_stack", along: 140, side: 1 },
        { type: "concrete_barrier", along: 500, side: -1 },
        { type: "tire_stack", along: 760, side: 1 },
      ],
      ribbonHazards: [
        { type: "ramp", along: 280, intensity: 1, radius: 5.5 },
        { type: "uneven", along: 520, intensity: 0.7, radius: 6 },
        { type: "ramp", along: 640, intensity: 0.9, radius: 5 },
        { type: "oil", along: 780, radius: 2.3 },
        { type: "uneven", along: 800, intensity: 0.65, radius: 5 },
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

/** All cup layouts, unlocked, for solo unranked practice (CONCEPT §8.5). */
export function asTrainingLevel(level: LevelDefinition): LevelDefinition {
  return {
    ...level,
    kind: "training",
    rewards: {
      ...level.rewards,
      starsOnTop3: false,
      placePurse: level.rewards.placePurse.map(() => 0),
    },
  };
}

export function trainingLevels(): LevelDefinition[] {
  return CUP_LEVELS.map(asTrainingLevel);
}

export function isTrainingLevel(level: { kind: string }): boolean {
  return level.kind === "training";
}

/** For tests: segment-type fingerprint of a cup layout. */
export function layoutFingerprint(level: LevelDefinition): string {
  return level.track.segments.map((s) => `${s.type}:${s.length ?? s.angleDeg ?? 0}`).join("|");
}

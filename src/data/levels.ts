import type { LevelClearanceGauge, LevelDefinition, LevelPanorama, LevelSceneryPlacement, TrackSegment } from "../track/types";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../track/buildTrack";
import { figureEightBridgeCenterline } from "../track/bridgeElevation";
import { planMedianBarriers } from "../track/medianBarriers";
import { pointOnTrack } from "../track/validateTrack";

/** Yaw so local +Z aligns with track tangent (tx, tz). */
export function yawFromTangent(tx: number, tz: number): number {
  return Math.atan2(tx, tz);
}
/**
 * Cup layouts from `assets/tripo-concepts/track-proposals/xl-cup-tracks-plan.png`
 * (XL silhouettes, closed loops with continuous start/finish heading).
 */

/** 1 Hafenstart (easy) — stadium oval with gentle bananas. ~840 m. */
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
 * 2 Parabolbogen (medium) — elongated paperclip: long tempo legs + wide arcs
 * (proposal: huge Parabolbogen / tight return). Mirrored for seam close. ~1160 m.
 */
function parabolbogenSegments(): TrackSegment[] {
  const longLeg: TrackSegment[] = [
    { type: "straight", length: 120, width: 12 },
    { type: "curve_r", radius: 220, angleDeg: 8, width: 12 },
    { type: "straight", length: 100, width: 12 },
    { type: "uneven_field", length: 40, width: 12, intensity: 0.35 },
    { type: "straight", length: 80, width: 12 },
  ];
  return [
    ...longLeg,
    { type: "curve_r", radius: 78, angleDeg: 172, width: 11 },
    ...longLeg,
    { type: "curve_r", radius: 78, angleDeg: 172, width: 10 },
  ];
}

/**
 * 3 Schikanenring (harder) — rectangular ring with double s_curves per leg
 * (proposal: winding city + inner oil risk line). ~1140 m.
 */
function schikanenringSegments(): TrackSegment[] {
  const long = (width: number): TrackSegment[] => [
    { type: "straight", length: 90, width },
    { type: "s_curve", width: width - 1 },
    { type: "straight", length: 70, width },
    { type: "s_curve", width: width - 2 },
    { type: "straight", length: 70, width: width - 1 },
  ];
  const short = (width: number): TrackSegment[] => [
    { type: "straight", length: 75, width },
    { type: "s_curve", width: width - 1 },
    { type: "straight", length: 75, width },
  ];
  const r = 40;
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
 * 4 Omegatal (hard) — Ω lobe (R/L/R) + waterfall uneven + return
 * (proposal: canyon omega with mid-straight ramp). ~1440 m.
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
    { type: "straight", length: 100, width: 11 },
    { type: "curve_r", radius: 35, angleDeg: 90, width: 10 },
    { type: "straight", length: 150, width: 12 },
    { type: "s_curve", width: 11 },
    { type: "straight", length: 40, width: 12 },
    { type: "curve_r", radius: 140, angleDeg: 12, width: 12 },
    { type: "straight", length: 220, width: 12 },
    { type: "curve_r", radius: 35, angleDeg: 78, width: 10 },
    { type: "straight", length: 100, width: 11 },
    { type: "curve_r", radius: 35, angleDeg: 90, width: 10 },
  ];
}

/**
 * 5 Kuppenfinale (boss) — XL stadium packed with Kuppen / Schikanen / Engstellen
 * (proposal: long complex with bumps + jumps). ~1165 m.
 */
function kuppenfinaleSegments(): TrackSegment[] {
  const half = (soft: boolean): TrackSegment[] => [
    { type: "straight", length: 100, width: 12 },
    { type: "curve_r", radius: 200, angleDeg: 10, width: 12 },
    { type: "straight", length: 70, width: 12 },
    { type: "uneven_field", length: 55, width: 12, intensity: soft ? 0.55 : 0.75 },
    { type: "straight", length: 40, width: 12 },
    { type: "curve_r", radius: 36, angleDeg: 80, width: 10 },
    { type: "straight", length: 45, width: 12 },
    { type: "s_curve", width: 11 },
    { type: "uneven_field", length: 40, width: 11, intensity: soft ? 0.5 : 0.7 },
    { type: "choke", length: 32, width: 8 },
    { type: "straight", length: 40, width: 12 },
    { type: "curve_r", radius: 34, angleDeg: 90, width: 10 },
  ];
  return [...half(false), ...half(true)];
}

/**
 * 6 Brückenkreuz (3D) — ∞ with elevated deck over underpass (CONCEPT §4.4.1).
 * Geometry is authored Gerono + elevation; segments are fingerprint stubs.
 */
function overpassSegments(): TrackSegment[] {
  return [
    { type: "straight", length: 120, width: 11 },
    { type: "curve_r", radius: 80, angleDeg: 200, width: 11 },
    { type: "straight", length: 48, width: 11 },
    { type: "curve_r", radius: 80, angleDeg: 200, width: 11 },
    { type: "straight", length: 48, width: 11 },
  ];
}

const LAYOUTS: Record<string, () => TrackSegment[]> = {
  harbor: harborSegments,
  beach: parabolbogenSegments,
  city: schikanenringSegments,
  canyon: omegatalSegments,
  factory: kuppenfinaleSegments,
  overpass: overpassSegments,
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
    authoredCenterline?: Array<{ x: number; z: number; y?: number }>;
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
    ...(opts.panorama ? { panorama: opts.panorama } : {}),
    ...(opts.sceneryPlacements?.length ? { sceneryPlacements: opts.sceneryPlacements } : {}),
    ...(opts.clearanceGauges?.length ? { clearanceGauges: opts.clearanceGauges } : {}),
    track: {
      closedLoop: true,
      asphaltWidth: opts.asphaltWidth ?? 12,
      grassWidth: opts.grass ?? 3,
      segments: LAYOUTS[theme]!(),
      walls: { rule: "tire_in_corners_concrete_on_straights" },
      ...(opts.authoredCenterline?.length ? { authoredCenterline: opts.authoredCenterline } : {}),
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

  // Spawn on authored polyline: place grid near start, facing travel.
  if (opts.authoredCenterline?.length) {
    const start = sampleCenterline(track, 8);
    const hx = start.tangent.x;
    const hz = start.tangent.z;
    const lx = -hz;
    const lz = hx;
    level.spawn.headingDeg = (Math.atan2(hz, hx) * 180) / Math.PI;
    level.spawn.grid = [0, 1, 2, 3, 4, 5].map((i) => {
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      const back = -8 - row * 6;
      return [
        start.position.x + hx * back + lx * col * 3,
        start.position.z + hz * back + lz * col * 3,
      ] as [number, number];
    });
  }

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
    laps: 3,
    asphaltWidth: 13,
    grass: 3,
    panorama: { offsetY: 16, heightScale: 1.5 },
    clearanceGauges: [{ x: 178, y: 0, z: 23, yaw: 0 }],
  }),
  makeCup(
    2,
    "blitz_cup_02_kuestenline",
    "Parabolbogen",
    "Tempo (~1,2 km): lange Gerade, riesiger Parabolbogen, enge Rückkehr — Strand-XL.",
    "beach",
    {
      grass: 5,
      asphaltWidth: 12,
      laps: 3,
      ribbonHazards: [{ type: "uneven", along: 280, intensity: 0.4, radius: 5 }],
    },
  ),
  makeCup(
    3,
    "blitz_cup_03_stadtring",
    "Schikanenring",
    "Technischer Ring (~1,1 km): Doppel-Schikanen — sichere Linie oder Hot Line (Öl).",
    "city",
    {
      grass: 3,
      asphaltWidth: 13,
      laps: 3,
      vergeBlockers: [
        { type: "tire_stack", along: 100, side: 1 },
        { type: "tire_stack", along: 160, side: -1 },
        { type: "concrete_barrier", along: 680, side: 1 },
        { type: "tire_stack", along: 740, side: -1 },
      ],
      ribbonHazards: [
        { type: "oil", along: 110, side: -1, radius: 2.2 },
        { type: "uneven", along: 150, side: -1, intensity: 0.55, radius: 4 },
        { type: "oil", along: 700, side: -1, radius: 2.1 },
        { type: "uneven", along: 730, side: -1, intensity: 0.5, radius: 4 },
      ],
    },
  ),
  makeCup(
    4,
    "blitz_cup_04_buckelpiste",
    "Omegatal",
    "Berg-Omega (~1,4 km): Omega-Doppelkurve, Wasserfall, Schanze auf der Mittelgerade.",
    "canyon",
    {
      grass: 3.5,
      asphaltWidth: 12,
      laps: 3,
      purse: [480, 340, 260, 200, 150, 120],
      vergeBlockers: [
        { type: "tire_stack", along: 90, side: 1 },
        { type: "tire_stack", along: 400, side: -1 },
      ],
      ribbonHazards: [
        { type: "uneven", along: 220, intensity: 0.55, radius: 5 },
        { type: "uneven", along: 380, intensity: 0.8, radius: 6 },
        { type: "ramp", along: 420, intensity: 0.95, radius: 5 },
        { type: "uneven", along: 460, intensity: 0.65, radius: 5 },
      ],
    },
  ),
  makeCup(
    5,
    "blitz_cup_05_cupfinale",
    "Kuppenfinale",
    "Cup-Boss (~1,2 km): viele Kuppen, Schikanen, Engstellen und Schanzen.",
    "factory",
    {
      grass: 3.5,
      asphaltWidth: 12,
      laps: 3,
      purse: [600, 420, 300, 220, 160, 130],
      vergeBlockers: [
        { type: "tire_stack", along: 120, side: 1 },
        { type: "concrete_barrier", along: 480, side: -1 },
        { type: "tire_stack", along: 780, side: 1 },
      ],
      ribbonHazards: [
        { type: "ramp", along: 200, intensity: 1, radius: 5.5 },
        { type: "uneven", along: 280, intensity: 0.75, radius: 6 },
        { type: "ramp", along: 650, intensity: 0.9, radius: 5 },
        { type: "oil", along: 820, radius: 2.3 },
        { type: "uneven", along: 900, intensity: 0.65, radius: 5 },
      ],
    },
  ),
  makeBridgeCup(),
];

/** Cup 6 — figure-8 overpass with Tripo bridge (CONCEPT §4.4.1). */
function makeBridgeCup(): LevelDefinition {
  const authored = figureEightBridgeCenterline({ a: 115, samples: 240 });
  const draft = makeCup(
    6,
    "blitz_cup_06_brueckenkreuz",
    "Brückenkreuz",
    "3D-Überführung (~0,9 km): ∞-Layout — oben über die Brücke, unten durch die Unterführung.",
    "overpass",
    {
      grass: 3,
      asphaltWidth: 11,
      laps: 3,
      purse: [520, 360, 280, 200, 150, 120],
      authoredCenterline: authored,
      panorama: { offsetY: 14, heightScale: 1.45 },
    },
  );
  const track = buildTrackFromLevel(draft);
  draft.sceneryPlacements = [bridgePlacementAtCrossing(track)];
  return draft;
}

function bridgePlacementAtCrossing(
  track: ReturnType<typeof buildTrackFromLevel>,
): LevelSceneryPlacement {
  let bestAlong = 0;
  let bestY = -1;
  for (let d = 0; d < track.totalLength; d += 0.5) {
    const s = sampleCenterline(track, d);
    const r = Math.hypot(s.position.x, s.position.z);
    if (s.y >= bestY && r < 12) {
      bestY = s.y;
      bestAlong = d;
    }
  }
  const s = sampleCenterline(track, bestAlong);
  return {
    kind: "bridge",
    x: s.position.x,
    y: 0,
    z: s.position.z,
    yaw: yawFromTangent(s.tangent.x, s.tangent.z),
  };
}

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

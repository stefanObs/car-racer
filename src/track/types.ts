export type Vec2 = { x: number; z: number };

export type SegmentType = "straight" | "curve_l" | "curve_r" | "s_curve" | "uneven_field" | "choke";

export interface TrackSegment {
  type: SegmentType;
  length?: number;
  width?: number;
  radius?: number;
  angleDeg?: number;
  intensity?: number;
}

/** Authored F8 Strecken-Editor prop (track-kit GLB). */
export type LevelSceneryPlacement = {
  kind: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
};

/** Durchfahrt gauge baked from F8 — dev clearance check, not rendered in race. */
export type LevelClearanceGauge = {
  x: number;
  y: number;
  z: number;
  yaw: number;
};

/** Baked horizon cylinder offset from F8 panorama sliders. */
export type LevelPanorama = {
  offsetY: number;
  heightScale: number;
};

export interface LevelDefinition {
  id: string;
  kind: "cup" | "free" | "training" | "adhoc";
  displayName: string;
  description: string;
  theme: string;
  classCup?: string;
  cupIndex?: number;
  laps: number;
  recommendedClass: string;
  gripMultiplier: number;
  /** F8 patch: live horizon ring Y offset + vertical scale (harbor skyline). */
  panorama?: LevelPanorama;
  /** F8 patch: extra Tripo kit props at authored world poses. */
  sceneryPlacements?: LevelSceneryPlacement[];
  /** F8 patch: Durchfahrt boxes — validated in tests, not drawn at race time. */
  clearanceGauges?: LevelClearanceGauge[];
  track: {
    closedLoop: boolean;
    asphaltWidth: number;
    grassWidth: number;
    segments: TrackSegment[];
    walls: { rule: string };
    /** Dev-only infinite-feel asphalt pad (no grass/wall). */
    debugPad?: boolean;
    /**
     * Hand-authored XZ(+Y) polyline (CONCEPT §4.4.1). When set, replaces segment stitch
     * for geometry; segments remain for fingerprints / docs.
     */
    authoredCenterline?: Array<{ x: number; z: number; y?: number }>;
  };
  obstacles: Array<{
    type: string;
    position: [number, number];
    radius?: number;
    intensity?: number;
    /** Radians: track tangent yaw so props face along the ribbon. */
    heading?: number;
    /** Section wall between close ribbons — may sit near asphalt edge. */
    role?: "median";
  }>;
  spawn: { grid: [number, number][]; headingDeg: number };
  rewards: {
    currency: "CHF";
    placePurse: number[];
    starsOnTop3: boolean;
  };
}

export interface BuiltTrack {
  centerline: Vec2[];
  cumulativeDistances: number[];
  totalLength: number;
  asphaltHalfWidth: number;
  grassWidth: number;
  /** Per centerline sample: 'tire' | 'concrete' for outer walls */
  wallKind: Array<"tire" | "concrete">;
  /** Per centerline sample: surface height (m). Flat tracks omit / all zeros. */
  elevation: number[];
  unevenMasks: Array<{ startDist: number; endDist: number; intensity: number }>;
  spawnHeading: number;
  /** Dev raster pad — always asphalt, no walls. */
  debugPad?: boolean;
}

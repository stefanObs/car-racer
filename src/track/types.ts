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

export interface LevelDefinition {
  id: string;
  kind: "cup" | "free" | "adhoc";
  displayName: string;
  description: string;
  theme: string;
  classCup?: string;
  cupIndex?: number;
  laps: number;
  recommendedClass: string;
  gripMultiplier: number;
  track: {
    closedLoop: boolean;
    asphaltWidth: number;
    grassWidth: number;
    segments: TrackSegment[];
    walls: { rule: string };
    /** Dev-only infinite-feel asphalt pad (no grass/wall). */
    debugPad?: boolean;
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
  unevenMasks: Array<{ startDist: number; endDist: number; intensity: number }>;
  spawnHeading: number;
  /** Dev raster pad — always asphalt, no walls. */
  debugPad?: boolean;
}

/** Instanced Asphalt-Comic track kit (Tripo bake → public/models/track). */

/** Required kit — boot fails if these GLBs are missing. */
export const REQUIRED_TRACK_PROP_IDS = [
  "tire-wall",
  "concrete-wall",
  "fence",
  "crane",
] as const;

/** Harbor extras — loaded when present; otherwise primitive fallback. */
export const OPTIONAL_TRACK_PROP_IDS = ["container", "tank"] as const;

export const TRACK_PROP_IDS = [...REQUIRED_TRACK_PROP_IDS, ...OPTIONAL_TRACK_PROP_IDS] as const;

export type TrackPropId = (typeof TRACK_PROP_IDS)[number];

export type TrackPropSpec = {
  id: TrackPropId;
  url: string;
  /** Extra yaw after bake (bake orients face +Z, tile +X). */
  yaw: number;
  /** Uniform extra scale. Bake already sits at y=0 in meters. */
  scale: number;
  /**
   * Fallback along-track module width (m) when the GLB is not loaded
   * (unit tests). Runtime tiling uses the live mesh AABB.
   */
  tileAlong: number;
};

export const TRACK_PROPS: Record<TrackPropId, TrackPropSpec> = {
  "tire-wall": {
    id: "tire-wall",
    url: "/models/track/tire-wall.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 1.5,
  },
  "concrete-wall": {
    id: "concrete-wall",
    url: "/models/track/concrete-wall.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 3.3,
  },
  fence: {
    id: "fence",
    url: "/models/track/fence.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 1.62,
  },
  crane: {
    id: "crane",
    url: "/models/track/crane.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 8,
  },
  container: {
    id: "container",
    url: "/models/track/container.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 6.2,
  },
  tank: {
    id: "tank",
    url: "/models/track/tank.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 4.4,
  },
};

/** Jersey top ≈ 1.5 m — fence modules sit here. */
export const CONCRETE_WALL_HEIGHT = 1.5;

export const CONTAINER_TINTS = [0x339af0, 0xe03131, 0xf08c00, 0x37b24d] as const;

/** Instanced Asphalt-Comic track kit (Tripo bake → public/models/track). */

/** Required kit — boot fails if these GLBs are missing. */
export const REQUIRED_TRACK_PROP_IDS = [
  "tire-wall",
  "concrete-wall",
  "fence",
  "crane",
] as const;

/** Harbor extras — also required at boot (shipped Tripo kit). */
export const OPTIONAL_TRACK_PROP_IDS = ["container", "tank"] as const;

/**
 * Theme scenery for cups 2–5 (+ free/ad-hoc themes).
 * Shipped Tripo GLBs — boot awaits the full kit so races never use box fallbacks.
 */
export const THEME_TRACK_PROP_IDS = [
  "grandstand",
  "palm",
  "hut",
  "tower",
  "building",
  "cliff",
  "spire",
  "tree",
  "warehouse",
  "scrub",
] as const;

/**
 * On-track obstacles (Schanze, Rüttelstreifen, Öl, Reifenstapel, Betonsperre).
 * Distinct from tiled outer walls — compact props for `levelObstacles`.
 */
export const OBSTACLE_TRACK_PROP_IDS = [
  "ramp",
  "rumble",
  "oil",
  "tire-stack",
  "barrier",
] as const;

/** Elevated layout structures (overpass — CONCEPT §4.4.1). */
export const STRUCTURE_TRACK_PROP_IDS = ["bridge"] as const;

export const OPTIONAL_ALL_TRACK_PROP_IDS = [
  ...OPTIONAL_TRACK_PROP_IDS,
  ...THEME_TRACK_PROP_IDS,
  ...OBSTACLE_TRACK_PROP_IDS,
  ...STRUCTURE_TRACK_PROP_IDS,
] as const;

export const TRACK_PROP_IDS = [...REQUIRED_TRACK_PROP_IDS, ...OPTIONAL_ALL_TRACK_PROP_IDS] as const;

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
  grandstand: {
    id: "grandstand",
    url: "/models/track/grandstand.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 10,
  },
  palm: {
    id: "palm",
    url: "/models/track/palm.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 2.5,
  },
  hut: {
    id: "hut",
    url: "/models/track/hut.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 5,
  },
  tower: {
    id: "tower",
    url: "/models/track/tower.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 6,
  },
  building: {
    id: "building",
    url: "/models/track/building.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 7,
  },
  cliff: {
    id: "cliff",
    url: "/models/track/cliff.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 8,
  },
  spire: {
    id: "spire",
    url: "/models/track/spire.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 3,
  },
  tree: {
    id: "tree",
    url: "/models/track/tree.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 3,
  },
  warehouse: {
    id: "warehouse",
    url: "/models/track/warehouse.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 12,
  },
  scrub: {
    id: "scrub",
    url: "/models/track/scrub.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 2.5,
  },
  ramp: {
    id: "ramp",
    url: "/models/track/ramp.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 5,
  },
  rumble: {
    id: "rumble",
    url: "/models/track/rumble.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 6,
  },
  oil: {
    id: "oil",
    url: "/models/track/oil.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 4,
  },
  "tire-stack": {
    id: "tire-stack",
    url: "/models/track/tire-stack.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 1.4,
  },
  barrier: {
    id: "barrier",
    url: "/models/track/barrier.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 2.4,
  },
  bridge: {
    id: "bridge",
    url: "/models/track/bridge.glb",
    yaw: 0,
    scale: 1,
    tileAlong: 23,
  },
};

/** Obstacle type → Tripo kit id + bake reference radius for runtime scale. */
export const OBSTACLE_PROP_BY_TYPE = {
  // refRadius ≈ half primary span of the baked GLB so default level radii size correctly.
  ramp: { id: "ramp" as const, refRadius: 2.0 },
  uneven: { id: "rumble" as const, refRadius: 2.3 },
  oil: { id: "oil" as const, refRadius: 1.65 },
  tire_stack: { id: "tire-stack" as const, refRadius: 1 },
  concrete_barrier: { id: "barrier" as const, refRadius: 1.1 },
} as const;

/** Jersey top ≈ 1.5 m — fence modules sit here. */
export const CONCRETE_WALL_HEIGHT = 1.5;

export const CONTAINER_TINTS = [0x339af0, 0xe03131, 0xf08c00, 0x37b24d] as const;

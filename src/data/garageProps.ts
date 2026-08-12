/** Shipped garage workshop meshes (Tripo bake). Visual stock only — not a parts inventory. */

export const GARAGE_PROP_IDS = [
  "cabinet",
  "workbench",
  "tireStack",
  "shelf",
  "drums",
  "toolchest",
  "gas",
  "hoist",
] as const;
export type GaragePropId = (typeof GARAGE_PROP_IDS)[number];

export interface GarageMeshSpec {
  id: GaragePropId;
  url: string;
}

export const GARAGE_MESH: Record<GaragePropId, GarageMeshSpec> = {
  cabinet: { id: "cabinet", url: "/models/garage/cabinet.glb" },
  workbench: { id: "workbench", url: "/models/garage/workbench.glb" },
  tireStack: { id: "tireStack", url: "/models/garage/tire-stack.glb" },
  shelf: { id: "shelf", url: "/models/garage/shelf.glb" },
  drums: { id: "drums", url: "/models/garage/drums.glb" },
  toolchest: { id: "toolchest", url: "/models/garage/toolchest.glb" },
  gas: { id: "gas", url: "/models/garage/gas.glb" },
  hoist: { id: "hoist", url: "/models/garage/hoist.glb" },
};

export type GarageWall = "back" | "left" | "right";

export type GarageStockPlacement = {
  id: GaragePropId;
  name: string;
  position: { x: number; y: number; z: number };
  yaw: number;
  scale: number;
  /** Which wall the prop sits against (layout sheet). */
  wall: GarageWall;
};

/**
 * Tripo bake keeps prop front on local +X (`scripts/bake-garage-tripo.mjs`).
 * Yaw maps that front toward the pad / camera.
 */
export const GARAGE_WALL_YAW: Record<GarageWall, number> = {
  back: -Math.PI / 2, // +X → +Z (face camera / into bay)
  left: 0, // +X → +X (face pad)
  right: Math.PI, // +X → −X (face pad)
};

/**
 * Back-wall props must sit in this X band so they clear the left garage menu
 * and stay inside the default camera frustum (cam ≈ 3.4, 2.7, 9.2 → look 1.5).
 */
export const GARAGE_BACK_WALL_VISIBLE_X = { min: 0.5, max: 6.0 } as const;
/** In front of wall at z = −11 (stripe at −10.72). */
export const GARAGE_BACK_WALL_Z = { min: -10.3, max: -8.6 } as const;

/** Minimum center-to-center spacing so workshop props do not pile up. */
export const GARAGE_PROP_MIN_SEPARATION = 2.2;

/**
 * Workshop props around the pad — layout sheet:
 * assets/tripo-concepts/garage-bay-layout-proposal.png
 *
 * Back: cabinet · workbench · shelf
 * Left: tires · drums · toolchest · gas
 * Right: hoist · tires (+ spare drums)
 */
export const GARAGE_STOCK: GarageStockPlacement[] = [
  {
    id: "cabinet",
    name: "garageCabinet",
    position: { x: 0.7, y: 0, z: -9.55 },
    yaw: GARAGE_WALL_YAW.back,
    scale: 1.15,
    wall: "back",
  },
  {
    id: "workbench",
    name: "garageWorkbench",
    position: { x: 3.0, y: 0, z: -9.65 },
    yaw: GARAGE_WALL_YAW.back,
    scale: 1.45,
    wall: "back",
  },
  {
    id: "shelf",
    name: "garageShelf",
    position: { x: 5.3, y: 0, z: -9.45 },
    yaw: GARAGE_WALL_YAW.back,
    scale: 1.05,
    wall: "back",
  },
  {
    id: "tireStack",
    name: "garageTiresL",
    position: { x: -3.5, y: 0, z: -3.6 },
    yaw: GARAGE_WALL_YAW.left + 0.08,
    scale: 1.2,
    wall: "left",
  },
  {
    id: "drums",
    name: "garageDrumsL",
    position: { x: -3.55, y: 0, z: -0.4 },
    yaw: GARAGE_WALL_YAW.left - 0.06,
    scale: 1.0,
    wall: "left",
  },
  {
    id: "tireStack",
    name: "garageTiresR",
    position: { x: 6.85, y: 0, z: 3.5 },
    yaw: GARAGE_WALL_YAW.right - 0.1,
    scale: 1.08,
    wall: "right",
  },
  {
    id: "drums",
    name: "garageDrumsR",
    position: { x: 7.05, y: 0, z: 1.2 },
    yaw: GARAGE_WALL_YAW.right + 0.08,
    scale: 1.1,
    wall: "right",
  },
];

/** Hero props — Tripo GLB at runtime, comic primitives when preload has not run. */
export const GARAGE_HERO: GarageStockPlacement[] = [
  {
    id: "toolchest",
    name: "garageToolChest",
    position: { x: -3.45, y: 0, z: 2.7 },
    yaw: GARAGE_WALL_YAW.left + 0.05,
    scale: 0.95,
    wall: "left",
  },
  {
    id: "gas",
    name: "garageGasBottles",
    position: { x: -3.25, y: 0, z: 5.1 },
    yaw: GARAGE_WALL_YAW.left - 0.12,
    scale: 0.95,
    wall: "left",
  },
  {
    id: "hoist",
    name: "garageHoist",
    position: { x: 7.35, y: 0, z: -1.9 },
    yaw: GARAGE_WALL_YAW.right,
    scale: 0.95,
    wall: "right",
  },
];

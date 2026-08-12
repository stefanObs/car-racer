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

export type GarageStockPlacement = {
  id: GaragePropId;
  name: string;
  position: { x: number; y: number; z: number };
  yaw: number;
  scale: number;
  /** Against the back wall (z ≈ −11), in the camera-visible band. */
  wall?: "back";
};

/**
 * Back-wall props must sit in this X band so they clear the left garage menu
 * and stay inside the default camera frustum (cam ≈ 3.4, 2.7, 9.2 → look 1.5).
 */
export const GARAGE_BACK_WALL_VISIBLE_X = { min: 0.5, max: 6.0 } as const;
/** In front of wall at z = −11 (stripe at −10.72). */
export const GARAGE_BACK_WALL_Z = { min: -10.3, max: -8.6 } as const;

/**
 * Workshop props: back-wall row (layout sheet) + side dressing outside the pad.
 * Layout: assets/tripo-concepts/garage-bay-layout-proposal.png
 */
export const GARAGE_STOCK: GarageStockPlacement[] = [
  // Back wall — facing camera (+Z), X clears left UI / right clip
  {
    id: "cabinet",
    name: "garageCabinet",
    position: { x: 0.7, y: 0, z: -9.5 },
    yaw: 0.06,
    scale: 1.15,
    wall: "back",
  },
  {
    id: "workbench",
    name: "garageWorkbench",
    position: { x: 2.85, y: 0, z: -9.7 },
    yaw: 0,
    scale: 1.45,
    wall: "back",
  },
  {
    id: "shelf",
    name: "garageShelf",
    position: { x: 5.05, y: 0, z: -9.4 },
    yaw: -0.04,
    scale: 1.05,
    wall: "back",
  },
  // Side / front dressing (not behind the menu strip)
  { id: "tireStack", name: "garageTiresL", position: { x: -2.2, y: 0, z: 3.2 }, yaw: 0.55, scale: 1.2 },
  { id: "tireStack", name: "garageTiresR", position: { x: 6.2, y: 0, z: 2.8 }, yaw: -0.45, scale: 1.08 },
  { id: "drums", name: "garageDrumsR", position: { x: 6.0, y: 0, z: 4.4 }, yaw: -0.35, scale: 1.1 },
  { id: "drums", name: "garageDrumsL", position: { x: -3.2, y: 0, z: 2.4 }, yaw: 0.85, scale: 1.0 },
];

/** Hero props — Tripo GLB at runtime, comic primitives when preload has not run. */
export const GARAGE_HERO: GarageStockPlacement[] = [
  { id: "toolchest", name: "garageToolChest", position: { x: -2.0, y: 0, z: 4.6 }, yaw: 0.4, scale: 0.95 },
  { id: "gas", name: "garageGasBottles", position: { x: 6.4, y: 0, z: 1.4 }, yaw: -Math.PI / 2, scale: 0.95 },
  {
    id: "hoist",
    name: "garageHoist",
    position: { x: 5.85, y: 0, z: -8.9 },
    yaw: -0.15,
    scale: 0.95,
    wall: "back",
  },
];

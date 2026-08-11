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
};

/**
 * Tight ring outside pad r=4.5 (center 1.5,0), inside camera frustum (~3.4, 2.7, 9.2).
 * Layout sheet: assets/tripo-concepts/garage-bay-layout-proposal.png
 */
export const GARAGE_STOCK: GarageStockPlacement[] = [
  { id: "cabinet", name: "garageCabinet", position: { x: -4.0, y: 0, z: -2.8 }, yaw: 0.35, scale: 1.15 },
  { id: "workbench", name: "garageWorkbench", position: { x: 6.6, y: 0, z: -0.4 }, yaw: Math.PI, scale: 1.45 },
  { id: "shelf", name: "garageShelf", position: { x: 6.8, y: 0, z: -3.6 }, yaw: -Math.PI / 2, scale: 1.05 },
  { id: "tireStack", name: "garageTiresL", position: { x: -3.6, y: 0, z: 2.8 }, yaw: 0.55, scale: 1.2 },
  { id: "tireStack", name: "garageTiresR", position: { x: 6.4, y: 0, z: 2.6 }, yaw: -0.45, scale: 1.08 },
  { id: "drums", name: "garageDrumsR", position: { x: 6.2, y: 0, z: 4.2 }, yaw: -0.35, scale: 1.1 },
  { id: "drums", name: "garageDrumsL", position: { x: -4.2, y: 0, z: 0.2 }, yaw: 0.85, scale: 1.0 },
];

/** Hero props — Tripo GLB at runtime, comic primitives when preload has not run. */
export const GARAGE_HERO: GarageStockPlacement[] = [
  { id: "toolchest", name: "garageToolChest", position: { x: -3.8, y: 0, z: 4.4 }, yaw: 0.4, scale: 0.95 },
  { id: "gas", name: "garageGasBottles", position: { x: 7.0, y: 0, z: 1.2 }, yaw: -Math.PI / 2, scale: 0.95 },
  { id: "hoist", name: "garageHoist", position: { x: -3.2, y: 0, z: -4.6 }, yaw: 0.5, scale: 0.95 },
];

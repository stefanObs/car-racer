/** Shipped garage workshop props (Tripo bake). Visual stock only — not a parts inventory. */

export const GARAGE_PROP_IDS = ["cabinet", "workbench", "tireStack", "shelf", "drums"] as const;
export type GaragePropId = (typeof GARAGE_PROP_IDS)[number];

export interface GaragePropSpec {
  id: GaragePropId;
  url: string;
  /** Object3D name in the bay */
  objectName: string;
  /** World position — keep off the center turntable pad */
  position: { x: number; y: number; z: number };
  /** Yaw in radians. Mesh front is Tripo +X. */
  yaw: number;
  /** Uniform scale after bake (arcade read vs the oversized idle car). */
  scale: number;
}

export const GARAGE_PROPS: Record<GaragePropId, GaragePropSpec> = {
  cabinet: {
    id: "cabinet",
    url: "/models/garage/cabinet.glb",
    objectName: "garageCabinet",
    position: { x: -6.2, y: 0, z: -3.2 },
    yaw: 0,
    scale: 1.15,
  },
  workbench: {
    id: "workbench",
    url: "/models/garage/workbench.glb",
    objectName: "garageWorkbench",
    position: { x: 8.4, y: 0, z: -4.2 },
    yaw: Math.PI,
    scale: 1.7,
  },
  tireStack: {
    id: "tireStack",
    url: "/models/garage/tire-stack.glb",
    objectName: "garageTireStack",
    position: { x: -5.8, y: 0, z: 3.4 },
    yaw: 0.35,
    scale: 1.2,
  },
  shelf: {
    id: "shelf",
    url: "/models/garage/shelf.glb",
    objectName: "garageShelf",
    position: { x: 5.6, y: 0, z: -9.2 },
    yaw: -Math.PI / 2,
    scale: 1.2,
  },
  drums: {
    id: "drums",
    url: "/models/garage/drums.glb",
    objectName: "garageDrums",
    position: { x: 8.2, y: 0, z: 3.2 },
    yaw: -0.55,
    scale: 1.25,
  },
};

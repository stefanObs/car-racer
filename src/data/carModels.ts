import type { CarId, GearClass } from "./cars";

/** External visual model + arcade silhouette collision (independent of mesh). */
export type CarModelSpec = {
  id: CarId;
  gearClass: GearClass;
  /** Public URL under /models/cars/ */
  url: string;
  /** Uniform scale after load (tune per Blender export). */
  scale: number;
  /** Extra yaw so nose faces +Z in-game. */
  yaw: number;
  /** Y lift so wheels sit on the ground plane. */
  y: number;
  /**
   * Car–car contact half-distance (meters). Visual mesh may stick out —
   * CONCEPT/user OK: silhouette circle, not exact mesh collision.
   */
  collisionRadius: number;
};

export const CAR_MODELS: Record<CarId, CarModelSpec> = {
  blitz: {
    id: "blitz",
    gearClass: "sport",
    url: "/models/cars/blitz.glb",
    scale: 1,
    yaw: 0,
    y: 0,
    collisionRadius: 1.05,
  },
  bison: {
    id: "bison",
    gearClass: "pickup",
    url: "/models/cars/bison.glb",
    scale: 1,
    yaw: 0,
    y: 0,
    collisionRadius: 1.25,
  },
  kaeferkraft: {
    id: "kaeferkraft",
    gearClass: "buggy",
    url: "/models/cars/kaeferkraft.glb",
    scale: 1,
    yaw: 0,
    y: 0,
    collisionRadius: 1.1,
  },
  donnerbuechse: {
    id: "donnerbuechse",
    gearClass: "hotrod",
    url: "/models/cars/donnerbuechse.glb",
    scale: 1,
    yaw: 0,
    y: 0,
    collisionRadius: 1.15,
  },
  bunker: {
    id: "bunker",
    gearClass: "armor",
    url: "/models/cars/bunker.glb",
    scale: 1,
    yaw: 0,
    y: 0,
    collisionRadius: 1.35,
  },
};

export function collisionRadiusFor(carId: string | undefined): number {
  if (carId && carId in CAR_MODELS) return CAR_MODELS[carId as CarId].collisionRadius;
  return 1.1;
}

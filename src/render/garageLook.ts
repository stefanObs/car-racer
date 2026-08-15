import type { CarId } from "../data/cars";
import type { PartId } from "../data/parts";

/** Idle garage / hub showcase look — owned once for façade and presenter. */
export type GarageLook = {
  paint: string;
  sticker: string;
  modelId: CarId;
  equippedParts?: readonly PartId[];
};

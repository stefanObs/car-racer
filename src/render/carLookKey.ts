import { garageLookCacheKey } from "./carParts";

/** Cache key for a live race car look — parts/paint/sticker changes rebuild the mesh. */
export function carStateLookKey(car: {
  modelId?: string;
  paint: string;
  sticker: string;
  equippedParts?: readonly string[];
}): string {
  return garageLookCacheKey({
    modelId: car.modelId ?? "blitz",
    paint: car.paint,
    sticker: car.sticker || "none",
    equippedParts: car.equippedParts ?? [],
  });
}

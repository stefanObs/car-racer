import type { CarId } from "./cars";
import { PARTS, type PartId } from "./parts";

/**
 * Per-car shop/equip allowlist.
 * Gelände-Federung only ships a Tripo kit for Blitz — other classes drop the part
 * and rely on tire/stance changes from Große Räder instead.
 * Bessere Bremsen is dropped on Blitz, Bison, and Käferkraft (procedural calipers don't fit).
 */
export function carSupportsPart(carId: CarId, partId: PartId): boolean {
  if (partId === "offroad_suspension") return carId === "blitz";
  if (partId === "better_brakes") {
    return carId !== "blitz" && carId !== "bison" && carId !== "kaeferkraft";
  }
  return partId in PARTS;
}

export function partsForCar(carId: CarId): PartId[] {
  return (Object.keys(PARTS) as PartId[]).filter((id) => carSupportsPart(carId, id));
}

/** Drop unsupported parts from a kit (e.g. after catalog changes). */
export function sanitizeKitParts(
  carId: CarId,
  kit: { ownedParts: PartId[]; equippedParts: PartId[] },
): void {
  kit.ownedParts = kit.ownedParts.filter((id) => carSupportsPart(carId, id));
  kit.equippedParts = kit.equippedParts.filter(
    (id) => carSupportsPart(carId, id) && kit.ownedParts.includes(id),
  );
}

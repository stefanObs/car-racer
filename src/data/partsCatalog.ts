import type { CarId } from "./cars";
import { PARTS, type PartId } from "./parts";

/**
 * Per-car shop/equip allowlist.
 * Gelände-Federung: Blitz Tripo springs; Bison reuses that kit + dropped StockWheel_*.
 * Bessere Bremsen is dropped on Blitz, Bison, Käferkraft, and Bunker (procedural calipers don't fit).
 * Blitz Leichtbau stays in the shop for stats but has no hood-vent mesh (empty mounts).
 */
export function carSupportsPart(carId: CarId, partId: PartId): boolean {
  if (partId === "offroad_suspension") return carId === "blitz" || carId === "bison";
  if (partId === "better_brakes") {
    return carId === "donnerbuechse";
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

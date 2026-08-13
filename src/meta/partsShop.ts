import { PARTS, type PartId } from "../data/parts";
import { carSupportsPart } from "../data/partsCatalog";
import type { CarId } from "../data/cars";
import type { CarKit } from "./save";

/** Click a part: owned → toggle equip; shop → toggle bay/stats preview (no CHF). */
export function selectPartInGarage(
  kit: CarKit,
  partId: PartId,
  previewPart: PartId | null,
  carId?: CarId,
): { equippedParts: PartId[]; previewPart: PartId | null; dirty: boolean } {
  if (carId && !carSupportsPart(carId, partId)) {
    return { equippedParts: kit.equippedParts, previewPart: null, dirty: false };
  }
  if (kit.ownedParts.includes(partId)) {
    const equipped = kit.equippedParts.includes(partId)
      ? kit.equippedParts.filter((p) => p !== partId)
      : [...kit.equippedParts, partId];
    return { equippedParts: equipped, previewPart: null, dirty: true };
  }
  if (previewPart === partId) {
    return { equippedParts: kit.equippedParts, previewPart: null, dirty: false };
  }
  return { equippedParts: kit.equippedParts, previewPart: partId, dirty: false };
}

/** Spend CHF, own + equip. False if already owned, unsupported, or broke. */
export function buyPart(
  save: { chf: number },
  kit: CarKit,
  partId: PartId,
  carId?: CarId,
): boolean {
  if (carId && !carSupportsPart(carId, partId)) return false;
  if (kit.ownedParts.includes(partId)) return false;
  const price = PARTS[partId].priceChf;
  if (save.chf < price) return false;
  save.chf -= price;
  kit.ownedParts.push(partId);
  if (!kit.equippedParts.includes(partId)) kit.equippedParts.push(partId);
  return true;
}

/** Equipped list for bay + Eigenschaften while a shop part is previewed. */
export function showcaseParts(kit: CarKit, previewPart: PartId | null): PartId[] {
  if (!previewPart || kit.equippedParts.includes(previewPart)) return kit.equippedParts;
  return [...kit.equippedParts, previewPart];
}

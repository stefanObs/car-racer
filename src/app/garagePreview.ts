import type { CarId } from "../data/cars";
import type { PartId } from "../data/parts";
import type { StickerId } from "../meta/save";

/** Unowned / unequipped showcase until buy or another pick. */
export type GaragePreview = {
  car: CarId | null;
  paint: string | null;
  sticker: StickerId | null;
  part: PartId | null;
};

export function emptyGaragePreview(): GaragePreview {
  return { car: null, paint: null, sticker: null, part: null };
}

export function clearGaragePreview(preview: GaragePreview): void {
  preview.car = null;
  preview.paint = null;
  preview.sticker = null;
  preview.part = null;
}

export function garagePreviewActive(preview: GaragePreview): boolean {
  return Boolean(preview.car || preview.paint || preview.sticker || preview.part);
}

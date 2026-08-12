import { isGaragePaint, PAINT_PRICE_CHF, STICKER_PRICE_CHF } from "../data/cosmetics";
import type { CarKit, StickerId } from "./save";
import { sanitizeSticker } from "./stickerIds";

export {
  GARAGE_PAINTS,
  isGaragePaint,
  PAINT_PRICE_CHF,
  STICKER_PRICE_CHF,
  type GaragePaint,
} from "../data/cosmetics";

const FREE_STICKER: StickerId = "none";

export function ownsPaint(kit: CarKit, color: string): boolean {
  return kit.ownedPaints.includes(color);
}

export function ownsSticker(kit: CarKit, sticker: StickerId): boolean {
  return kit.ownedStickers.includes(sticker);
}

/** Click a paint: owned → equip; locked → toggle preview (no CHF yet). */
export function selectPaintInGarage(
  kit: CarKit,
  color: string,
  previewPaint: string | null,
): { paint: string; previewPaint: string | null } {
  if (ownsPaint(kit, color)) {
    return { paint: color, previewPaint: null };
  }
  if (previewPaint === color) {
    return { paint: kit.paint, previewPaint: null };
  }
  return { paint: kit.paint, previewPaint: color };
}

/** Click a sticker/nose: owned → equip; locked → toggle preview. */
export function selectStickerInGarage(
  kit: CarKit,
  stickerRaw: string,
  previewSticker: StickerId | null,
): { sticker: StickerId; previewSticker: StickerId | null } {
  const sticker = sanitizeSticker(stickerRaw);
  if (ownsSticker(kit, sticker)) {
    return { sticker, previewSticker: null };
  }
  if (previewSticker === sticker) {
    return { sticker: kit.sticker, previewSticker: null };
  }
  return { sticker: kit.sticker, previewSticker: sticker };
}

/** Spend CHF, own + equip paint. False if owned/unknown/broke. */
export function buyPaint(save: { chf: number }, kit: CarKit, color: string): boolean {
  if (!isGaragePaint(color) || ownsPaint(kit, color)) return false;
  if (save.chf < PAINT_PRICE_CHF) return false;
  save.chf -= PAINT_PRICE_CHF;
  kit.ownedPaints.push(color);
  kit.paint = color;
  return true;
}

/** Spend CHF, own + equip sticker. False if free/owned/broke. */
export function buySticker(save: { chf: number }, kit: CarKit, stickerRaw: string): boolean {
  const sticker = sanitizeSticker(stickerRaw);
  if (sticker === FREE_STICKER || ownsSticker(kit, sticker)) return false;
  if (save.chf < STICKER_PRICE_CHF) return false;
  save.chf -= STICKER_PRICE_CHF;
  kit.ownedStickers.push(sticker);
  kit.sticker = sticker;
  return true;
}

export function showcasePaint(kit: CarKit, previewPaint: string | null): string {
  return previewPaint ?? kit.paint;
}

export function showcaseSticker(kit: CarKit, previewSticker: StickerId | null): StickerId {
  return previewSticker ?? kit.sticker;
}

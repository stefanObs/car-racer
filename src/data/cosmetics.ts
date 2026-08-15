import { CAR_PAINT_BLACK } from "./paintColors";

/** Shop swatches — same order as garage UI. */
export const GARAGE_PAINTS = [
  "#e03131",
  "#339af0",
  "#f08c00",
  "#12b886",
  "#2f9e44",
  "#868e96",
  "#ffffff",
  CAR_PAINT_BLACK,
] as const;

export type GaragePaint = (typeof GARAGE_PAINTS)[number];

/** Cheap vs Teile so kids unlock looks after ~1 race (CONCEPT §6). */
export const PAINT_PRICE_CHF = 75;
export const STICKER_PRICE_CHF = 100;

export function isGaragePaint(color: string): color is GaragePaint {
  return (GARAGE_PAINTS as readonly string[]).includes(color);
}

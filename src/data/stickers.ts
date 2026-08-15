/** Garage sticker / nose ids — one union for save, shop, and render. */

export type StickerId = "none" | "flames" | "bolt" | "star";

export const STICKER_IDS: readonly StickerId[] = ["none", "flames", "bolt", "star"];

/** Drop retired ids (e.g. ironClad) so old saves stay valid. */
export function sanitizeSticker(raw: unknown): StickerId {
  if (raw === "lightning") return "bolt";
  if (typeof raw === "string" && (STICKER_IDS as readonly string[]).includes(raw)) {
    return raw as StickerId;
  }
  return "none";
}

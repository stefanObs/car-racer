import type { CarId } from "../data/cars";
import { CARS } from "../data/cars";
import { isGaragePaint } from "../data/cosmetics";
import type { PartId } from "../data/parts";
import { sanitizeKitParts } from "../data/partsCatalog";
import { sanitizeSticker, type StickerId } from "./stickerIds";

export type { StickerId } from "./stickerIds";
export { sanitizeSticker } from "./stickerIds";

/** Tuning + cosmetics for one owned car — not shared across cars. */
export type CarKit = {
  ownedParts: PartId[];
  equippedParts: PartId[];
  paint: string;
  sticker: StickerId;
  /** Purchased paints for this car (always includes class default). */
  ownedPaints: string[];
  /** Purchased stickers/noses (always includes none/Glatt). */
  ownedStickers: StickerId[];
};

export interface SaveData {
  version: 2;
  chf: number;
  ownedCars: CarId[];
  activeCar: CarId;
  /** Per-car kits; missing entries are created empty with default paint. */
  kits: Partial<Record<CarId, CarKit>>;
  unlockedLevels: string[];
  cupStars: Record<string, number>;
  cupIndexUnlocked: number;
}

/** Legacy v1 shape (global parts shared across cars). */
type SaveDataV1 = {
  version: 1;
  chf?: number;
  ownedCars?: CarId[];
  activeCar?: CarId;
  ownedParts?: PartId[];
  equippedParts?: PartId[];
  paint?: string;
  sticker?: string;
  unlockedLevels?: string[];
  cupStars?: Record<string, number>;
  cupIndexUnlocked?: number;
};

const KEY = "crash-circuit-save-v1";

/** Grant default + equipped cosmetics; fill lists for pre-shop saves. */
export function normalizeKitCosmetics(carId: CarId, kit: CarKit): CarKit {
  const defaultPaint = CARS[carId].defaultPaint;
  const paint = isGaragePaint(kit.paint) ? kit.paint : defaultPaint;
  const sticker = sanitizeSticker(kit.sticker);
  const ownedPaints = [...new Set([defaultPaint, paint, ...(kit.ownedPaints ?? [])])].filter(isGaragePaint);
  const ownedStickers = [...new Set(["none" as StickerId, sticker, ...(kit.ownedStickers ?? [])])];
  kit.paint = paint;
  kit.sticker = sticker;
  kit.ownedPaints = ownedPaints;
  kit.ownedStickers = ownedStickers;
  sanitizeKitParts(carId, kit);
  return kit;
}

export function emptyKit(carId: CarId): CarKit {
  return normalizeKitCosmetics(carId, {
    ownedParts: [],
    equippedParts: [],
    paint: CARS[carId].defaultPaint,
    sticker: "none",
    ownedPaints: [CARS[carId].defaultPaint],
    ownedStickers: ["none"],
  });
}

export function ensureKit(save: SaveData, carId: CarId): CarKit {
  const existing = save.kits[carId];
  if (existing) {
    save.kits[carId] = normalizeKitCosmetics(carId, existing);
    return save.kits[carId]!;
  }
  const kit = emptyKit(carId);
  save.kits[carId] = kit;
  return kit;
}

export function activeKit(save: SaveData): CarKit {
  return ensureKit(save, save.activeCar);
}

export function defaultSave(): SaveData {
  return {
    version: 2,
    chf: 0,
    ownedCars: ["blitz"],
    activeCar: "blitz",
    kits: {
      blitz: emptyKit("blitz"),
    },
    unlockedLevels: ["blitz_cup_01_hafenstart"],
    cupStars: {},
    cupIndexUnlocked: 1,
  };
}

/** Migrate v1 global parts into the then-active car only (RCA: shared inventory). */
export function migrateV1ToV2(raw: SaveDataV1): SaveData {
  const base = defaultSave();
  const active = raw.activeCar && raw.activeCar in CARS ? raw.activeCar : "blitz";
  const ownedCars = (raw.ownedCars ?? ["blitz"]).filter((id) => id in CARS) as CarId[];
  if (!ownedCars.includes(active)) ownedCars.push(active);

  const kits: Partial<Record<CarId, CarKit>> = {};
  for (const id of ownedCars) {
    kits[id] = emptyKit(id);
  }
  // Old global parts belonged to whichever car was active — do not clone to every car.
  kits[active] = normalizeKitCosmetics(active, {
    ownedParts: [...(raw.ownedParts ?? [])],
    equippedParts: [...(raw.equippedParts ?? [])],
    paint: raw.paint ?? CARS[active].defaultPaint,
    sticker: sanitizeSticker(raw.sticker),
    ownedPaints: [],
    ownedStickers: [],
  });

  return {
    version: 2,
    chf: raw.chf ?? 0,
    ownedCars,
    activeCar: active,
    kits,
    unlockedLevels: raw.unlockedLevels ?? base.unlockedLevels,
    cupStars: raw.cupStars ?? {},
    cupIndexUnlocked: raw.cupIndexUnlocked ?? 1,
  };
}

export function normalizeSave(parsed: SaveData | SaveDataV1): SaveData {
  if (!parsed || typeof parsed !== "object") return defaultSave();
  if ((parsed as SaveDataV1).version === 1) return migrateV1ToV2(parsed as SaveDataV1);
  const v2 = parsed as SaveData;
  if (v2.version !== 2) return defaultSave();
  const save: SaveData = {
    ...defaultSave(),
    ...v2,
    version: 2,
    kits: { ...(v2.kits ?? {}) },
  };
  for (const id of save.ownedCars) {
    ensureKit(save, id);
  }
  ensureKit(save, save.activeCar);
  for (const [id, kit] of Object.entries(save.kits)) {
    if (kit && id in CARS) {
      save.kits[id as CarId] = normalizeKitCosmetics(id as CarId, kit);
    }
  }
  return save;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return normalizeSave(JSON.parse(raw) as SaveData | SaveDataV1);
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function formatChf(amount: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(amount);
}

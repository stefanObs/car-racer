import type { CarId } from "../data/cars";
import type { PartId } from "../data/parts";

export type StickerId = "none" | "flames" | "bolt" | "star";

export interface SaveData {
  version: 1;
  chf: number;
  ownedCars: CarId[];
  activeCar: CarId;
  ownedParts: PartId[];
  equippedParts: PartId[];
  paint: string;
  sticker: StickerId;
  unlockedLevels: string[];
  cupStars: Record<string, number>;
  cupIndexUnlocked: number;
}

const KEY = "crash-circuit-save-v1";

export function defaultSave(): SaveData {
  return {
    version: 1,
    chf: 0,
    ownedCars: ["blitz"],
    activeCar: "blitz",
    ownedParts: [],
    equippedParts: [],
    paint: "#e03131",
    sticker: "none",
    unlockedLevels: ["blitz_cup_01_hafenstart"],
    cupStars: {},
    cupIndexUnlocked: 1,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== 1) return defaultSave();
    return { ...defaultSave(), ...parsed };
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

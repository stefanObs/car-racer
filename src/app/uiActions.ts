import type { CarId } from "../data/cars";
import { asTrainingLevel, freeLevels, levelById } from "../data/levels";
import type { PartId } from "../data/parts";
import { buyCar, selectCarInGarage } from "../meta/carShop";
import {
  buyPaint,
  buySticker,
  selectPaintInGarage,
  selectStickerInGarage,
} from "../meta/cosmeticsShop";
import { buyPart, selectPartInGarage } from "../meta/partsShop";
import { activeKit, ensureKit, type SaveData, type StickerId } from "../meta/save";
import { generateAdhocLevel, normalizeSeed, randomSeed, type AdhocLength } from "../track/adhoc";
import type { LevelDefinition } from "../track/types";
import { clearGaragePreview, type GaragePreview } from "./garagePreview";
import type { Screen } from "./screens";

export type MenuActionState = {
  screen: Screen;
  save: SaveData;
  preview: GaragePreview;
  adhocSeed: string;
  adhocLength: AdhocLength;
  lastAdhoc: LevelDefinition | null;
};

export type MenuActionResult = {
  /** Start this level (caller runs raceFlow). */
  startLevel?: LevelDefinition;
  bought?: boolean;
  persist?: boolean;
  /** Action consumed; skip remaining handlers. */
  handled: boolean;
};

const SCREENS: Screen[] = ["menu", "cup", "free", "training", "adhoc", "garage"];

export function resolveRaceLevel(
  save: SaveData,
  lastAdhoc: LevelDefinition | null,
  levelId: string,
): LevelDefinition | null {
  if (lastAdhoc && lastAdhoc.id === levelId) return lastAdhoc;
  return levelById(levelId) ?? freeLevels(save.unlockedLevels).find((l) => l.id === levelId) ?? null;
}

/** Mutates menu/garage state. Settings, mute, and leave-race stay in the app shell. */
export function applyMenuAction(
  state: MenuActionState,
  act: string | undefined,
  dataset: { car?: string; color?: string; sticker?: string; part?: string; level?: string; length?: string },
): MenuActionResult {
  if (!act) return { handled: false };

  if (SCREENS.includes(act as Screen)) {
    state.screen = act as Screen;
    return { handled: true };
  }

  if (act === "adhoc-roll") {
    state.adhocSeed = randomSeed();
    state.screen = "adhoc";
    return { handled: true };
  }
  if (act === "adhoc-length" && dataset.length) {
    state.adhocLength = dataset.length as AdhocLength;
    state.screen = "adhoc";
    return { handled: true };
  }
  if (act === "adhoc-start") {
    const level = generateAdhocLevel({ seed: state.adhocSeed, length: state.adhocLength });
    state.lastAdhoc = level;
    return { handled: true, startLevel: level };
  }
  if (act === "race" && dataset.level) {
    if (state.screen === "training") {
      const source = levelById(dataset.level);
      if (!source) return { handled: true };
      return { handled: true, startLevel: asTrainingLevel(source) };
    }
    const level = resolveRaceLevel(state.save, state.lastAdhoc, dataset.level);
    if (!level) return { handled: true };
    return { handled: true, startLevel: level };
  }

  if (act === "car" && dataset.car) {
    const id = dataset.car as CarId;
    const next = selectCarInGarage(state.save.ownedCars, state.save.activeCar, id);
    state.save.activeCar = next.activeCar;
    state.preview.car = next.previewCar;
    state.preview.paint = null;
    state.preview.sticker = null;
    state.preview.part = null;
    if (next.previewCar == null) ensureKit(state.save, next.activeCar);
    return { handled: true, persist: true };
  }
  if (act === "buy-car" && dataset.car) {
    if (buyCar(state.save, dataset.car as CarId)) {
      clearGaragePreview(state.preview);
      return { handled: true, bought: true, persist: true };
    }
    return { handled: true };
  }
  if (act === "paint" && dataset.color) {
    const kit = activeKit(state.save);
    const next = selectPaintInGarage(kit, dataset.color, state.preview.paint);
    kit.paint = next.paint;
    state.preview.paint = next.previewPaint;
    if (next.previewPaint == null) return { handled: true, persist: true };
    return { handled: true };
  }
  if (act === "buy-paint" && dataset.color) {
    const kit = activeKit(state.save);
    if (buyPaint(state.save, kit, dataset.color)) {
      state.preview.paint = null;
      return { handled: true, bought: true, persist: true };
    }
    return { handled: true };
  }
  if (act === "sticker" && dataset.sticker) {
    const kit = activeKit(state.save);
    const next = selectStickerInGarage(kit, dataset.sticker as StickerId, state.preview.sticker);
    kit.sticker = next.sticker;
    state.preview.sticker = next.previewSticker;
    if (next.previewSticker == null) return { handled: true, persist: true };
    return { handled: true };
  }
  if (act === "buy-sticker" && dataset.sticker) {
    const kit = activeKit(state.save);
    if (buySticker(state.save, kit, dataset.sticker)) {
      state.preview.sticker = null;
      return { handled: true, bought: true, persist: true };
    }
    return { handled: true };
  }
  if (act === "part" && dataset.part) {
    const kit = activeKit(state.save);
    const next = selectPartInGarage(kit, dataset.part as PartId, state.preview.part, state.save.activeCar);
    kit.equippedParts = next.equippedParts;
    state.preview.part = next.previewPart;
    if (next.dirty) return { handled: true, persist: true };
    return { handled: true };
  }
  if (act === "buy-part" && dataset.part) {
    const kit = activeKit(state.save);
    if (buyPart(state.save, kit, dataset.part as PartId, state.save.activeCar)) {
      state.preview.part = null;
      return { handled: true, bought: true, persist: true };
    }
    return { handled: true };
  }

  return { handled: false };
}

export function applyAdhocSeed(state: MenuActionState, raw: string): void {
  state.adhocSeed = normalizeSeed(raw);
}

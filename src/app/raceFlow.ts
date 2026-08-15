import type { CarId } from "../data/cars";
import { applyRaceRewards } from "../meta/raceRewards";
import { activeKit, writeSave, type SaveData } from "../meta/save";
import type { GameRenderer } from "../render/createGameRenderer";
import { ensureCarPartTemplates } from "../render/carParts";
import { preloadTrackModels } from "../render/loadTrackGltf";
import { RaceSession, type RaceResult } from "../sim/race";
import type { LevelDefinition } from "../track/types";

export function createRaceSession(save: SaveData, level: LevelDefinition): RaceSession {
  const kit = activeKit(save);
  return new RaceSession({
    level,
    playerCarId: save.activeCar,
    playerParts: kit.equippedParts,
    playerPaint: kit.paint,
    playerSticker: kit.sticker,
  });
}

export async function mountRace(renderer: GameRenderer, session: RaceSession): Promise<void> {
  if (!session.level.track.debugPad) await preloadTrackModels();
  renderer.clearCars();
  const modelIds = [...new Set(session.cars.map((c) => c.modelId))];
  for (const id of modelIds) void ensureCarPartTemplates(id as CarId);
  renderer.buildTrack(session);
}

export function settleRace(save: SaveData, session: RaceSession): RaceResult {
  const result = session.result();
  applyRaceRewards(save, result, session.level.id);
  writeSave(save);
  return result;
}

export function teardownRace(renderer: GameRenderer, stylePops: { clear(): void }): void {
  stylePops.clear();
  renderer.clearCars();
}

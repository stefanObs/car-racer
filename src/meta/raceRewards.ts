import { CUP_LEVELS, levelById } from "../data/levels";
import type { RaceResult } from "../sim/race";
import type { SaveData } from "./save";

function starsForPlace(place: number): number {
  if (place === 1) return 3;
  if (place === 2) return 2;
  if (place === 3) return 1;
  return 0;
}

/** Apply purse, cup stars, and next-cup unlock. Training (`ranked: false`) is a no-op. */
export function applyRaceRewards(save: SaveData, result: RaceResult, levelId: string): SaveData {
  if (!result.ranked) return save;

  save.chf += result.purseChf;
  if (result.starsEarned) {
    const prev = save.cupStars[levelId] ?? 0;
    save.cupStars[levelId] = Math.max(prev, starsForPlace(result.place));
  }

  const level = levelById(levelId);
  if (level?.cupIndex && result.place <= 3) {
    const next = level.cupIndex + 1;
    if (next > save.cupIndexUnlocked) save.cupIndexUnlocked = next;
    const nextLevel = CUP_LEVELS.find((l) => l.cupIndex === next);
    if (nextLevel && !save.unlockedLevels.includes(nextLevel.id)) {
      save.unlockedLevels.push(nextLevel.id);
    }
  }
  return save;
}

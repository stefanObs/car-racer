import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { applyRaceRewards } from "../src/meta/raceRewards";
import { defaultSave } from "../src/meta/save";
import type { RaceResult } from "../src/sim/race";

function result(over: Partial<RaceResult>): RaceResult {
  return {
    place: 1,
    purseChf: 200,
    styleBonus: 0,
    starsEarned: true,
    ranked: true,
    ...over,
  };
}

describe("applyRaceRewards", () => {
  const cup1 = CUP_LEVELS[0]!;
  const cup2 = CUP_LEVELS[1]!;

  it("pays CHF and awards 3/2/1 stars for podium places", () => {
    const save = defaultSave();
    applyRaceRewards(save, result({ place: 1, purseChf: 150 }), cup1.id);
    expect(save.chf).toBe(150);
    expect(save.cupStars[cup1.id]).toBe(3);

    applyRaceRewards(save, result({ place: 2, purseChf: 80, starsEarned: true }), cup2.id);
    expect(save.chf).toBe(230);
    expect(save.cupStars[cup2.id]).toBe(2);

    const third = defaultSave();
    applyRaceRewards(third, result({ place: 3, purseChf: 40 }), cup1.id);
    expect(third.cupStars[cup1.id]).toBe(1);
  });

  it("does not downgrade existing stars", () => {
    const save = defaultSave();
    save.cupStars[cup1.id] = 3;
    applyRaceRewards(save, result({ place: 2, purseChf: 10 }), cup1.id);
    expect(save.cupStars[cup1.id]).toBe(3);
  });

  it("unlocks the next cup on place 3 or better", () => {
    const save = defaultSave();
    expect(save.cupIndexUnlocked).toBe(1);
    applyRaceRewards(save, result({ place: 3, starsEarned: true }), cup1.id);
    expect(save.cupIndexUnlocked).toBe(2);
    expect(save.unlockedLevels).toContain(cup2.id);
  });

  it("does not lower a higher cup unlock", () => {
    const save = defaultSave();
    save.cupIndexUnlocked = 4;
    save.unlockedLevels.push(cup2.id);
    applyRaceRewards(save, result({ place: 1 }), cup1.id);
    expect(save.cupIndexUnlocked).toBe(4);
  });

  it("does not unlock on 4th place", () => {
    const save = defaultSave();
    applyRaceRewards(save, result({ place: 4, starsEarned: false, purseChf: 50 }), cup1.id);
    expect(save.cupIndexUnlocked).toBe(1);
    expect(save.unlockedLevels).not.toContain(cup2.id);
    expect(save.chf).toBe(50);
  });

  it("training ranked:false writes no CHF, stars, or unlocks", () => {
    const save = defaultSave();
    applyRaceRewards(
      save,
      result({ ranked: false, place: 0, purseChf: 0, starsEarned: false }),
      cup1.id,
    );
    expect(save).toEqual(defaultSave());
  });
});

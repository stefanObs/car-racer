import { describe, expect, it } from "vitest";
import {
  CUP_LEVELS,
  asTrainingLevel,
  isTrainingLevel,
  trainingLevels,
} from "../src/data/levels";
import { RaceSession } from "../src/sim/race";
import { createFinishCelebrate, finishOverlayHtml } from "../src/ui/finishCelebrate";
import { renderGarageHtml } from "../src/ui/garageHtml";
import { emptyKit } from "../src/meta/save";

function trainingRace(levelId = CUP_LEVELS[0]!.id): RaceSession {
  const source = CUP_LEVELS.find((l) => l.id === levelId)!;
  return new RaceSession({
    level: asTrainingLevel(source),
    playerCarId: "blitz",
    playerParts: [],
    playerPaint: "#e03131",
    playerSticker: "none",
  });
}

describe("training mode (CONCEPT §8.5)", () => {
  it("lists every cup track and does not lock any of them", () => {
    const catalog = trainingLevels();
    expect(catalog.map((l) => l.id)).toEqual(CUP_LEVELS.map((l) => l.id));
    expect(catalog.every(isTrainingLevel)).toBe(true);
    expect(CUP_LEVELS.every((l) => l.kind === "cup")).toBe(true);
  });

  it("pays no purse or stars", () => {
    const level = asTrainingLevel(CUP_LEVELS[CUP_LEVELS.length - 1]!);
    expect(level.rewards.starsOnTop3).toBe(false);
    expect(level.rewards.placePurse.every((v) => v === 0)).toBe(true);
  });

  it("spawns solo with a normal countdown", () => {
    const race = trainingRace();
    expect(race.cars).toHaveLength(1);
    expect(race.player().isPlayer).toBe(true);
    expect(race.isCountingDown()).toBe(true);
    expect(race.track.debugPad).toBeFalsy();
  });

  it("finishes without a place, CHF, or stars", () => {
    const race = trainingRace();
    race.forceFinishAs(1);
    const result = race.result();
    expect(result.ranked).toBe(false);
    expect(result.place).toBe(0);
    expect(result.purseChf).toBe(0);
    expect(result.starsEarned).toBe(false);
  });

  it("shows Ziel without podium ranking copy", () => {
    const html = finishOverlayHtml(createFinishCelebrate(1, 0, { ranked: false }));
    expect(html).toContain("Ziel!");
    expect(html).toContain("finish-fx--training");
    expect(html).not.toContain("SIEGER!");
    expect(html).not.toContain("Platz");
  });

  it("adds a Training CTA on the garage hub", () => {
    const html = renderGarageHtml({
      chf: 100,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
    });
    expect(html).toContain('data-act="training"');
    expect(html).toContain("Training");
  });
});

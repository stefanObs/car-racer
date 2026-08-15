import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { clampFinishPlace, parseChfAmount } from "../src/dev/cheats";
import { RaceSession } from "../src/sim/race";

describe("dev cheats", () => {
  it("parses CHF amounts for the F2 money field", () => {
    expect(parseChfAmount("1'250")).toBe(1250);
    expect(parseChfAmount("CHF 900")).toBe(900);
    expect(parseChfAmount("")).toBeNull();
    expect(parseChfAmount("abc")).toBeNull();
  });

  it("clamps finish places to the field size", () => {
    expect(clampFinishPlace(1, 6)).toBe(1);
    expect(clampFinishPlace(6, 6)).toBe(6);
    expect(clampFinishPlace(99, 6)).toBe(6);
    expect(clampFinishPlace(0, 6)).toBe(1);
  });

  it("force-finishes a race with the chosen player place", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    race.forceFinishAs(2);
    expect(race.done).toBe(true);
    expect(race.player().finishPlace).toBe(2);
    expect(race.result().place).toBe(2);
    expect(race.result().ranked).toBe(true);
    const places = race.cars.map((c) => c.finishPlace).sort((a, b) => a - b);
    expect(places).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

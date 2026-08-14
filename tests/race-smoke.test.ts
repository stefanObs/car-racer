import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { RaceSession } from "../src/sim/race";

describe("race smoke", () => {
  it("runs a short race simulation without finishing instantly", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    expect(race.cars).toHaveLength(6);
    // Stay on the opening straight (Hafenstart ~62 m) — no wall-grind KO.
    race.clearStartCountdown();
    for (let i = 0; i < 90; i++) {
      race.step(1 / 60, { throttle: 0.35, brake: 0, steer: 0, nitro: false });
    }
    expect(race.done).toBe(false);
    expect(race.player().progress).toBeGreaterThan(8);
    expect(race.player().hp).toBeGreaterThan(0);
  });
});

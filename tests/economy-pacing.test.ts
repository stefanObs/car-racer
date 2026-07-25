import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import {
  SESSION_MAX_MINUTES,
  SESSION_MIN_MINUTES,
  STARTER_RACES_FOR_PART,
  cheapestPartPriceChf,
  introFourthPlacePurseChf,
  secondCarIsLongerGoal,
  solidEarlyPartFromFirstWin,
  starterPartAffordableFromMidPack,
} from "../src/meta/economy";

describe("session economy pacing (7–15 min)", () => {
  it("documents the short session window", () => {
    expect(SESSION_MIN_MINUTES).toBe(7);
    expect(SESSION_MAX_MINUTES).toBe(15);
  });

  it("lets mid-pack finishers buy a starter part within two intro races", () => {
    expect(introFourthPlacePurseChf() * STARTER_RACES_FOR_PART).toBeGreaterThanOrEqual(
      cheapestPartPriceChf(),
    );
    expect(starterPartAffordableFromMidPack()).toBe(true);
  });

  it("lets a first-place intro finish buy at least one part", () => {
    expect(solidEarlyPartFromFirstWin()).toBe(true);
  });

  it("keeps the second car as a longer short-session goal", () => {
    expect(secondCarIsLongerGoal()).toBe(true);
  });

  it("uses short early cup races so more loops fit in 7–15 min", () => {
    expect(CUP_LEVELS[0]!.laps).toBe(2);
    expect(CUP_LEVELS[1]!.laps).toBe(2);
  });
});

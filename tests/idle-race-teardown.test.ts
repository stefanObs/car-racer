import { describe, expect, it, vi } from "vitest";
import { ensureIdleClearsRaceField } from "../src/render/idleRaceTeardown";

describe("ensureIdleClearsRaceField", () => {
  it("tears down leftover race cars when returning to idle", () => {
    const clearRaceCars = vi.fn();
    const hideRaceField = vi.fn();
    const restoreGarageEnvironment = vi.fn();

    const ran = ensureIdleClearsRaceField({
      raceCarCount: 4,
      raceFieldVisible: true,
      clearRaceCars,
      hideRaceField,
      restoreGarageEnvironment,
    });

    expect(ran).toBe(true);
    expect(clearRaceCars).toHaveBeenCalledOnce();
    expect(hideRaceField).toHaveBeenCalledOnce();
    expect(restoreGarageEnvironment).toHaveBeenCalledOnce();
  });

  it("tears down when cars remain even if track was already hidden", () => {
    const clearRaceCars = vi.fn();
    const hideRaceField = vi.fn();
    const restoreGarageEnvironment = vi.fn();

    expect(
      ensureIdleClearsRaceField({
        raceCarCount: 2,
        raceFieldVisible: false,
        clearRaceCars,
        hideRaceField,
        restoreGarageEnvironment,
      }),
    ).toBe(true);
    expect(clearRaceCars).toHaveBeenCalledOnce();
  });

  it("no-ops when idle is already clean", () => {
    const clearRaceCars = vi.fn();
    expect(
      ensureIdleClearsRaceField({
        raceCarCount: 0,
        raceFieldVisible: false,
        clearRaceCars,
        hideRaceField: vi.fn(),
        restoreGarageEnvironment: vi.fn(),
      }),
    ).toBe(false);
    expect(clearRaceCars).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { RaceSession } from "../src/sim/race";
import { countdownPhase, START_COUNTDOWN_SEC } from "../src/sim/startCountdown";

const idle = { throttle: 0, brake: 0, steer: 0, nitro: false, drift: false } as const;

function makeRace(): RaceSession {
  return new RaceSession({
    level: CUP_LEVELS[0]!,
    playerCarId: "blitz",
    playerParts: [],
    playerPaint: "#E03131",
    playerSticker: "none",
  });
}

describe("start countdown", () => {
  it("maps remaining time to 3 → 2 → 1 → GO over 4 seconds", () => {
    expect(START_COUNTDOWN_SEC).toBe(4);
    expect(countdownPhase(4)).toBe("3");
    expect(countdownPhase(3.01)).toBe("3");
    expect(countdownPhase(3)).toBe("2");
    expect(countdownPhase(2)).toBe("1");
    expect(countdownPhase(1)).toBe("GO");
    expect(countdownPhase(0.01)).toBe("GO");
    expect(countdownPhase(0)).toBe(null);
  });

  it("freezes cars until the 4 s hold ends", () => {
    const race = makeRace();
    const startProgress = race.player().progress;
    expect(race.isCountingDown()).toBe(true);
    expect(race.countdownLabel()).toBe("3");

    race.step(1, { ...idle, throttle: 1 });
    expect(race.countdownLabel()).toBe("2");
    expect(race.player().progress).toBe(startProgress);

    race.step(1, { ...idle, throttle: 1 });
    expect(race.countdownLabel()).toBe("1");

    race.step(1, { ...idle, throttle: 1 });
    expect(race.countdownLabel()).toBe("GO");
    expect(race.player().progress).toBe(startProgress);

    race.step(1, { ...idle, throttle: 1 });
    expect(race.isCountingDown()).toBe(false);
    expect(race.countdownLabel()).toBe(null);
    expect(race.player().progress).toBe(startProgress);

    race.step(0.5, { ...idle, throttle: 1 });
    expect(race.player().progress).toBeGreaterThan(startProgress);
  });

  it("emits countdown audio once per phase", () => {
    const race = makeRace();
    race.step(0.016, idle);
    expect(race.consumeAudioEvents()).toEqual([{ kind: "countdown", phase: "3" }]);

    race.step(1, idle);
    expect(race.consumeAudioEvents()).toEqual([{ kind: "countdown", phase: "2" }]);

    race.step(1, idle);
    expect(race.consumeAudioEvents()).toEqual([{ kind: "countdown", phase: "1" }]);

    race.step(1, idle);
    expect(race.consumeAudioEvents()).toEqual([{ kind: "countdown", phase: "GO" }]);

    race.step(1, idle);
    expect(race.consumeAudioEvents().some((e) => e.kind === "countdown")).toBe(false);
  });
});

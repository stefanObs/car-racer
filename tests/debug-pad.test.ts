import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { DEBUG_PAD_EXTENT_M, DEBUG_PAD_ID, debugPadLevel, isDebugPadLevel } from "../src/data/debugPad";
import { RaceSession } from "../src/sim/race";
import { stepCar } from "../src/sim/vehicle";
import { surfaceAt } from "../src/sim/zones";
import { buildTrackFromLevel } from "../src/track/buildTrack";

describe("debug raster pad (F4)", () => {
  it("is not a cup/free race", () => {
    expect(CUP_LEVELS.some((l) => l.id === DEBUG_PAD_ID)).toBe(false);
    expect(isDebugPadLevel(debugPadLevel())).toBe(true);
  });

  it("builds a square asphalt pad with no grass walls at the origin", () => {
    const track = buildTrackFromLevel(debugPadLevel());
    expect(track.debugPad).toBe(true);
    expect(track.grassWidth).toBe(0);
    const mid = surfaceAt(track, 0, 0, 0, 1);
    expect(mid.zone).toBe("asphalt");
    expect(mid.speedFactor).toBe(1);
    const far = surfaceAt(track, 180, 160, 0, 1);
    expect(far.zone).toBe("asphalt");
    expect(Math.abs(far.lateral)).toBe(0);
  });

  it("spawns solo with no countdown so handling can be tested immediately", () => {
    const race = new RaceSession({
      level: debugPadLevel(),
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    expect(race.cars).toHaveLength(1);
    expect(race.player().x).toBe(0);
    expect(race.player().z).toBe(0);
    expect(race.isCountingDown()).toBe(false);
    expect(race.player().distanceAlong).toBe(DEBUG_PAD_EXTENT_M);
  });

  it("steering on the pad yaws the car without hitting a wall", () => {
    const race = new RaceSession({
      level: debugPadLevel(),
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    const car = race.player();
    car.speed = 18;
    car.vx = 18;
    const heading0 = car.heading;
    let hit = false;
    for (let i = 0; i < 45; i++) {
      const r = stepCar(car, { throttle: 1, brake: 0, steer: 1, nitro: false }, race.track, 1 / 60, {
        accel: 1,
        topSpeed: 1,
      });
      if (r.hitWall) hit = true;
    }
    expect(hit).toBe(false);
    expect(car.heading).not.toBeCloseTo(heading0, 2);
    expect(Math.hypot(car.x, car.z)).toBeGreaterThan(2);
  });
});

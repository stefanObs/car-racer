import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { RaceSession } from "../src/sim/race";
import {
  isFacingWrongWay,
  shouldShowWrongWayWarning,
  tickWrongWayHold,
  WRONG_WAY_HOLD,
} from "../src/sim/wrongWay";
import { sampleCenterline } from "../src/track/buildTrack";

describe("wrong-way warning", () => {
  it("detects reverse travel against track tangent", () => {
    expect(
      isFacingWrongWay({
        vx: 10,
        vz: 0,
        speed: 10,
        tangentX: 1,
        tangentZ: 0,
      }),
    ).toBe(false);
    expect(
      isFacingWrongWay({
        vx: -10,
        vz: 0,
        speed: 10,
        tangentX: 1,
        tangentZ: 0,
      }),
    ).toBe(true);
  });

  it("ignores low speed so spawn facing does not flash", () => {
    expect(
      isFacingWrongWay({
        vx: -2,
        vz: 0,
        speed: 2,
        tangentX: 1,
        tangentZ: 0,
      }),
    ).toBe(false);
  });

  it("requires sustained wrong-way before showing the warning", () => {
    let hold = 0;
    hold = tickWrongWayHold(hold, true, 0.1);
    expect(shouldShowWrongWayWarning(hold)).toBe(false);
    hold = tickWrongWayHold(hold, true, WRONG_WAY_HOLD);
    expect(shouldShowWrongWayWarning(hold)).toBe(true);
    hold = tickWrongWayHold(hold, false, 0.5);
    expect(shouldShowWrongWayWarning(hold)).toBe(false);
  });

  it("RaceSession exposes wrong-way after driving backward on the loop", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    const p = race.player();
    const s = sampleCenterline(race.track, p.distanceAlong || 8);
    p.x = s.position.x;
    p.z = s.position.z;
    p.distanceAlong = 8;
    // Point and drive against tangent
    p.heading = Math.atan2(s.tangent.z, s.tangent.x) + Math.PI;
    p.speed = 16;
    p.vx = Math.cos(p.heading) * p.speed;
    p.vz = Math.sin(p.heading) * p.speed;

    for (let i = 0; i < 40; i++) {
      race.step(1 / 60, { throttle: 1, brake: 0, steer: 0, nitro: false });
    }
    expect(race.playerWrongWay()).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { finishLineCross } from "../src/sim/finishLineCross";
import { RaceSession } from "../src/sim/race";
import { sampleCenterline } from "../src/track/buildTrack";

function placeOnAlong(race: RaceSession, along: number, speed = 12): void {
  const player = race.player();
  const s = sampleCenterline(race.track, along);
  player.x = s.position.x;
  player.z = s.position.z;
  player.heading = Math.atan2(s.tangent.z, s.tangent.x);
  player.distanceAlong = along;
  player.speed = speed;
  player.vx = Math.cos(player.heading) * speed;
  player.vz = Math.sin(player.heading) * speed;
}

describe("finish line cross / wrong-way lap undo", () => {
  it("classifies forward and backward seam wraps", () => {
    expect(finishLineCross(90, 5, 100, 10)).toBe("forward");
    expect(finishLineCross(5, 90, 100, 10)).toBe("backward");
    expect(finishLineCross(50, 55, 100, 10)).toBeNull();
    expect(finishLineCross(90, 5, 100, 1)).toBeNull();
  });

  it("undoes a lap on wrong-way finish pass, then restores on forward pass", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    const player = race.player();
    const len = race.track.totalLength;
    player.lap = 1;
    race.clearStartCountdown();

    // Wrong-way across the line: near start → near end (inject wrap like audio tests)
    placeOnAlong(race, len * 0.92);
    race["prevProgress"].set(player.id, len * 0.08);
    race.step(1 / 60, { throttle: 0, brake: 0, steer: 0, nitro: false });
    expect(player.lap).toBe(0);

    // Forward across again without driving a full lap
    placeOnAlong(race, len * 0.05);
    race["prevProgress"].set(player.id, len * 0.92);
    race.step(1 / 60, { throttle: 0, brake: 0, steer: 0, nitro: false });
    expect(player.lap).toBe(1);
  });

  it("allows the lap counter to go negative on repeated wrong-way crosses", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    const player = race.player();
    const len = race.track.totalLength;
    player.lap = 1;
    race.clearStartCountdown();

    for (let i = 0; i < 3; i++) {
      placeOnAlong(race, len * 0.9);
      race["prevProgress"].set(player.id, len * 0.08);
      race.step(1 / 60, { throttle: 0, brake: 0, steer: 0, nitro: false });
    }
    expect(player.lap).toBe(-2);
  });
});

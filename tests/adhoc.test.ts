import { describe, expect, it } from "vitest";
import { RaceSession } from "../src/sim/race";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { generateAdhocLevel, hashSeed, normalizeSeed, randomSeed } from "../src/track/adhoc";

describe("adhoc tracks", () => {
  it("normalizes seeds to four shareable characters", () => {
    expect(normalizeSeed("a7f2")).toBe("A7F2");
    expect(normalizeSeed("xy")).toBe("XY00");
    expect(normalizeSeed("")).toBe("A7F2");
  });

  it("is deterministic for the same seed", () => {
    const a = generateAdhocLevel({ seed: "A7F2", length: "medium" });
    const b = generateAdhocLevel({ seed: "A7F2", length: "medium" });
    expect(a.track.segments).toEqual(b.track.segments);
    expect(a.theme).toBe(b.theme);
    expect(hashSeed("A7F2")).toBe(hashSeed("a7f2"));
  });

  it("builds a closed driveable loop with grass and walls", () => {
    const level = generateAdhocLevel({ seed: "K9P3", length: "short" });
    expect(level.kind).toBe("adhoc");
    expect(level.rewards.starsOnTop3).toBe(false);
    const track = buildTrackFromLevel(level);
    expect(track.centerline.length).toBeGreaterThan(20);
    expect(track.totalLength).toBeGreaterThan(80);
    expect(track.grassWidth).toBeGreaterThan(0);
    expect(track.wallKind.some((w) => w === "tire")).toBe(true);
    expect(track.wallKind.some((w) => w === "concrete")).toBe(true);
  });

  it("can start a short race session on an ad-hoc level", () => {
    const level = generateAdhocLevel({ seed: randomSeed(() => 0.42), length: "short" });
    const race = new RaceSession({
      level,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    for (let i = 0; i < 90; i++) {
      race.step(1 / 60, { throttle: 1, brake: 0, steer: 0, nitro: false });
    }
    expect(race.done).toBe(false);
    expect(race.player().progress).toBeGreaterThan(5);
  });
});

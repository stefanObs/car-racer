import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import { createCarState, stepCar } from "../src/sim/vehicle";
import { surfaceAt } from "../src/sim/zones";
import { buildTrackFromLevel, nearestOnTrack } from "../src/track/buildTrack";

function wallPointOutside(track: ReturnType<typeof buildTrackFromLevel>, side: 1 | -1, pastWall = 2) {
  const sample = track.centerline[5]!;
  const next = track.centerline[6]!;
  const tx = next.x - sample.x;
  const tz = next.z - sample.z;
  const len = Math.hypot(tx, tz) || 1;
  const nx = -tz / len;
  const nz = tx / len;
  const edge = track.asphaltHalfWidth + track.grassWidth + pastWall;
  return {
    x: sample.x + nx * edge * side,
    z: sample.z + nz * edge * side,
    heading: Math.atan2(tz, tx),
  };
}

describe("wall collision", () => {
  it("pushes the car back toward the track instead of through the wall", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const outside = wallPointOutside(track, 1, 3);
    const before = surfaceAt(track, outside.x, outside.z, 0, 1);
    expect(before.zone).toBe("wall");
    expect(Math.abs(before.lateral)).toBeGreaterThan(track.asphaltHalfWidth + track.grassWidth);

    const car = createCarState({
      id: "player",
      x: outside.x,
      z: outside.z,
      heading: outside.heading,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 0,
    });

    stepCar(car, { throttle: 0, brake: 0, steer: 0, nitro: false }, track, 1 / 60, {
      accel: 1,
      topSpeed: 1,
    });

    const after = surfaceAt(track, car.x, car.z, 0, 1);
    expect(Math.abs(after.lateral)).toBeLessThan(Math.abs(before.lateral));
  });

  it("clamps cars so they cannot stay beyond the grass/wall edge at speed", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const limit = track.asphaltHalfWidth + track.grassWidth;
    const outside = wallPointOutside(track, -1, 1);
    const near = nearestOnTrack(track, outside);
    // Aim hard outward (away from center)
    const outwardHeading = Math.atan2(
      -Math.sign(near.lateral) * near.tangent.x,
      Math.sign(near.lateral) * near.tangent.z,
    );

    const car = createCarState({
      id: "player",
      x: outside.x,
      z: outside.z,
      heading: outwardHeading,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 30,
    });

    for (let i = 0; i < 45; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, {
        accel: 1,
        topSpeed: 1,
      });
    }

    const after = nearestOnTrack(track, { x: car.x, z: car.z });
    expect(Math.abs(after.lateral)).toBeLessThanOrEqual(limit + 0.05);
  });
});

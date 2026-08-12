import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import { createCarState, stepCar, yawRateFor } from "../src/sim/vehicle";
import { buildTrackFromLevel } from "../src/track/buildTrack";

const blitzStats = {
  ...CARS.blitz.stats,
  nitroBonus: 0,
  ramBonus: 0,
  grassMitigation: 0,
  brakeBonus: 0,
};
const catchUp = { accel: 1, topSpeed: 1 };

function onTrackCar(speed: number, steer = 0) {
  const track = buildTrackFromLevel(CUP_LEVELS[0]!);
  const p = track.centerline[8]!;
  const n = track.centerline[9]!;
  const heading = Math.atan2(n.z - p.z, n.x - p.x);
  const car = createCarState({
    id: "player",
    x: p.x,
    z: p.z,
    heading,
    isPlayer: true,
    paint: "#e03131",
    sticker: "none",
    stats: blitzStats,
    speed,
  });
  return { track, car, steer };
}

describe("arcade racing feel", () => {
  it("turns tighter at low speed than at high speed (not tank-flip at top end)", () => {
    const slow = yawRateFor({
      steer: 1,
      speed: 6,
      handling: blitzStats.handling,
      mass: blitzStats.mass,
      gripFactor: 1,
      handlingMult: 1,
    });
    const fast = yawRateFor({
      steer: 1,
      speed: 28,
      handling: blitzStats.handling,
      mass: blitzStats.mass,
      gripFactor: 1,
      handlingMult: 1,
    });
    expect(slow).toBeGreaterThan(fast * 1.25);
    expect(fast).toBeGreaterThan(0.2);
  });

  it("coasts instead of dumping speed when throttle is released", () => {
    const { track, car } = onTrackCar(20);
    for (let i = 0; i < 30; i++) {
      stepCar(car, { throttle: 0, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp);
    }
    // ~0.5s coast — should keep most of the pace
    expect(car.speed).toBeGreaterThan(14);
  });

  it("builds pace quickly toward top speed under full throttle", () => {
    const { track, car } = onTrackCar(0);
    for (let i = 0; i < 60; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp);
    }
    expect(car.speed).toBeGreaterThan(22);
  });

  it("allows a slip angle under hard steer at speed (grip, not tank controls)", () => {
    const { track, car } = onTrackCar(24);
    for (let i = 0; i < 20; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 1, nitro: false }, track, 1 / 60, catchUp);
    }
    const moveAng = Math.atan2(car.vz, car.vx);
    let slip = Math.abs(moveAng - car.heading);
    while (slip > Math.PI) slip -= Math.PI * 2;
    slip = Math.abs(slip);
    expect(slip).toBeGreaterThan(0.25);
    expect(slip).toBeLessThan(1.6);
  });
});

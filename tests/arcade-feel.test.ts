import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import {
  createCarState,
  forwardSpeedAlongHeading,
  reverseTopFor,
  stepCar,
  wantsReverse,
  yawRateFor,
  BASE_TOP,
} from "../src/sim/vehicle";
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

  it("does not tank-pivot at standstill (front-steer needs forward speed)", () => {
    const stopped = yawRateFor({
      steer: 1,
      speed: 0,
      handling: blitzStats.handling,
      mass: blitzStats.mass,
      gripFactor: 1,
      handlingMult: 1,
    });
    expect(Math.abs(stopped)).toBeLessThan(0.05);

    const { track, car } = onTrackCar(0);
    const h0 = car.heading;
    for (let i = 0; i < 60; i++) {
      stepCar(car, { throttle: 0, brake: 0, steer: 1, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    expect(Math.abs(car.heading - h0)).toBeLessThan(0.08);
    expect(car.speed).toBeLessThan(0.2);
  });

  it("low crawl speed still arcs more than standstill", () => {
    const crawl = yawRateFor({
      steer: 1,
      speed: 4,
      handling: blitzStats.handling,
      mass: blitzStats.mass,
      gripFactor: 1,
      handlingMult: 1,
    });
    const stopped = yawRateFor({
      steer: 1,
      speed: 0,
      handling: blitzStats.handling,
      mass: blitzStats.mass,
      gripFactor: 1,
      handlingMult: 1,
    });
    expect(Math.abs(crawl)).toBeGreaterThan(Math.abs(stopped) + 0.35);
  });

  it("coasts instead of dumping speed when throttle is released", () => {
    const { track, car } = onTrackCar(20);
    for (let i = 0; i < 30; i++) {
      stepCar(car, { throttle: 0, brake: 0, steer: 0, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    // ~0.5s coast — should keep most of the pace
    expect(car.speed).toBeGreaterThan(14);
  });

  it("builds pace gradually under full throttle (not instant)", () => {
    const { track, car } = onTrackCar(0);
    const at = (frames: number) => {
      for (let i = 0; i < frames; i++) {
        stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false }, track, 1 / 60, catchUp);
      }
      return car.speed;
    };
    const t0_5 = at(30);
    const t1 = at(30);
    const t2 = at(60);
    expect(t0_5).toBeGreaterThan(4);
    expect(t0_5).toBeLessThan(14);
    expect(t1).toBeGreaterThan(t0_5 + 1.5);
    expect(t2).toBeGreaterThan(t1 + 1.5);
    expect(t2).toBeLessThan(BASE_TOP * blitzStats.topSpeed);
  });

  it("allows a controlled outside-drift slip under hard steer at speed", () => {
    const { track, car } = onTrackCar(24);
    for (let i = 0; i < 30; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, track, 1 / 60, catchUp);
    }
    const moveAng = Math.atan2(car.vz, car.vx);
    let slip = Math.abs(moveAng - car.heading);
    while (slip > Math.PI) slip -= Math.PI * 2;
    slip = Math.abs(slip);
    expect(slip).toBeGreaterThan(0.25);
    expect(slip).toBeLessThan(0.9);
  });

  it("hold brake from speed stops then drives reverse along -heading", () => {
    const { track, car } = onTrackCar(18);
    const hx = Math.cos(car.heading);
    const hz = Math.sin(car.heading);
    for (let i = 0; i < 180; i++) {
      stepCar(car, { throttle: 0, brake: 1, steer: 0, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    const fwd = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);
    expect(fwd).toBeLessThan(-2);
    expect(car.speed).toBeGreaterThan(2);
    // Mostly along -nose
    expect(car.vx * -hx + car.vz * -hz).toBeGreaterThan(car.speed * 0.85);
    const rTop = reverseTopFor(BASE_TOP * blitzStats.topSpeed);
    expect(car.speed).toBeLessThanOrEqual(rTop + 0.5);
  });

  it("throttle exits reverse and builds forward again", () => {
    const { track, car } = onTrackCar(0);
    for (let i = 0; i < 90; i++) {
      stepCar(car, { throttle: 0, brake: 1, steer: 0, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    expect(forwardSpeedAlongHeading(car.heading, car.vx, car.vz)).toBeLessThan(-1);
    for (let i = 0; i < 60; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    expect(forwardSpeedAlongHeading(car.heading, car.vx, car.vz)).toBeGreaterThan(4);
  });

  it("nitro does not shove while reversing on held brake", () => {
    const { track, car } = onTrackCar(0);
    car.nitro = 1;
    for (let i = 0; i < 60; i++) {
      stepCar(car, { throttle: 0, brake: 1, steer: 0, nitro: true, drift: false }, track, 1 / 60, catchUp);
    }
    const fwd = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);
    expect(fwd).toBeLessThan(0);
    expect(Math.abs(fwd)).toBeLessThan(reverseTopFor(BASE_TOP * blitzStats.topSpeed) + 1);
    // Nitro meter should not be drained hard by reverse (forward-only boost)
    expect(car.nitro).toBeGreaterThan(0.85);
  });

  it("wantsReverse only after near-stop with brake and no gas", () => {
    expect(wantsReverse({ brake: 1, throttle: 0, forward: 8, airborne: false })).toBe(false);
    expect(wantsReverse({ brake: 1, throttle: 0, forward: 0.2, airborne: false })).toBe(true);
    expect(wantsReverse({ brake: 1, throttle: 1, forward: 0, airborne: false })).toBe(false);
    expect(wantsReverse({ brake: 0, throttle: 0, forward: 0, airborne: false })).toBe(false);
  });

  it("brake wins over throttle when both are pressed (no simultaneous fight)", () => {
    const gas = onTrackCar(16);
    const both = onTrackCar(16);
    for (let i = 0; i < 45; i++) {
      stepCar(gas.car, { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false }, gas.track, 1 / 60, catchUp);
      stepCar(both.car, { throttle: 1, brake: 1, steer: 0, nitro: false, drift: false }, both.track, 1 / 60, catchUp);
    }
    expect(both.car.speed).toBeLessThan(gas.car.speed - 4);
    expect(both.car.speed).toBeLessThan(12);
  });

  it("inverts steer sense while reversing so backing feels natural", () => {
    const { track, car } = onTrackCar(0);
    for (let i = 0; i < 90; i++) {
      stepCar(car, { throttle: 0, brake: 1, steer: 0, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    expect(forwardSpeedAlongHeading(car.heading, car.vx, car.vz)).toBeLessThan(-2);
    const h0 = car.heading;
    for (let i = 0; i < 45; i++) {
      stepCar(car, { throttle: 0, brake: 1, steer: 1, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    const reverseDelta = car.heading - h0;
    const { track: t2, car: c2 } = onTrackCar(10);
    const h1 = c2.heading;
    for (let i = 0; i < 45; i++) {
      stepCar(c2, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: false }, t2, 1 / 60, catchUp);
    }
    const forwardDelta = c2.heading - h1;
    expect(Math.sign(reverseDelta)).toBe(-Math.sign(forwardDelta));
    expect(Math.abs(reverseDelta)).toBeGreaterThan(0.15);
  });
});

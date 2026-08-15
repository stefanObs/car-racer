import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import {
  createCarState,
  KO_RESPAWN_SECONDS,
  placeOnRacingLine,
  stepCar,
  type MergedVehicleStats,
} from "../src/sim/vehicle";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../src/track/buildTrack";
import { renderDamageHudHtml } from "../src/ui/damageHud";

const catchUp = { accel: 1, topSpeed: 1 };

function blitzStats(): MergedVehicleStats {
  return { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 };
}

function bunkerStats(): MergedVehicleStats {
  return { ...CARS.bunker.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 };
}

function onTrackCar(stats: MergedVehicleStats, speed = 0) {
  const track = buildTrackFromLevel(CUP_LEVELS[0]!);
  const p = track.centerline[8]!;
  const n = track.centerline[9]!;
  const heading = Math.atan2(n.z - p.z, n.x - p.x);
  const along = nearestOnTrack(track, { x: p.x, z: p.z }).distanceAlong;
  const car = createCarState({
    id: "player",
    x: p.x,
    z: p.z,
    heading,
    isPlayer: true,
    paint: "#e03131",
    sticker: "none",
    stats,
    speed,
    distanceAlong: along,
  });
  return { track, car };
}

function wallApproachCar(stats: MergedVehicleStats, speed: number) {
  const track = buildTrackFromLevel(CUP_LEVELS[0]!);
  const sample = track.centerline[5]!;
  const next = track.centerline[6]!;
  const tx = next.x - sample.x;
  const tz = next.z - sample.z;
  const len = Math.hypot(tx, tz) || 1;
  const nx = -tz / len;
  const nz = tx / len;
  const justInside = track.asphaltHalfWidth + track.grassWidth - 0.4;
  const x = sample.x + nx * justInside;
  const z = sample.z + nz * justInside;
  const near = nearestOnTrack(track, { x, z });
  const sign = Math.sign(near.lateral) || 1;
  const outwardX = sign * -near.tangent.z;
  const outwardZ = sign * near.tangent.x;
  const car = createCarState({
    id: "player",
    x,
    z,
    heading: Math.atan2(outwardZ, outwardX),
    isPlayer: true,
    paint: "#e03131",
    sticker: "none",
    stats,
    speed,
    distanceAlong: near.distanceAlong,
  });
  return { track, car };
}

describe("K.O. respawn (CONCEPT §4.5)", () => {
  it("keeps the car out for about 3 seconds then restores full HP", () => {
    const { track, car } = onTrackCar(blitzStats(), 12);
    car.hp = 0;
    stepCar(car, { throttle: 0, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp);
    expect(car.koTimer).toBeCloseTo(KO_RESPAWN_SECONDS, 5);

    for (let i = 0; i < 150; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp);
    }
    expect(car.koTimer).toBeGreaterThan(0);
    expect(car.hp).toBe(0);

    for (let i = 0; i < 40; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp);
    }
    expect(car.koTimer).toBe(0);
    expect(car.hp).toBe(1);
  });

  it("respawns on the racing line, not in the grass or wall", () => {
    const { track, car } = wallApproachCar(blitzStats(), 28);
    const crash = nearestOnTrack(track, { x: car.x, z: car.z });
    car.x += (Math.sign(crash.lateral) || 1) * -crash.tangent.z * 3;
    car.z += (Math.sign(crash.lateral) || 1) * crash.tangent.x * 3;
    expect(Math.abs(nearestOnTrack(track, { x: car.x, z: car.z }).lateral)).toBeGreaterThan(
      track.asphaltHalfWidth,
    );

    car.hp = 0;
    stepCar(car, { throttle: 0, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp);
    const parked = nearestOnTrack(track, { x: car.x, z: car.z });
    expect(Math.abs(parked.lateral)).toBeLessThan(1.2);

    const line = sampleCenterline(track, car.distanceAlong);
    expect(car.x).toBeCloseTo(line.position.x, 1);
    expect(car.z).toBeCloseTo(line.position.z, 1);
    expect(Math.cos(car.heading) * line.tangent.x + Math.sin(car.heading) * line.tangent.z).toBeGreaterThan(0.7);
  });

  it("a high-speed wall slam KOs stock Blitz; a slow tap does not", () => {
    const slam = wallApproachCar(blitzStats(), 28);
    for (let i = 0; i < 20 && slam.car.koTimer <= 0; i++) {
      stepCar(slam.car, { throttle: 1, brake: 0, steer: 0, nitro: false }, slam.track, 1 / 60, catchUp);
    }
    expect(slam.car.koTimer).toBeGreaterThan(0);
    expect(slam.car.hp).toBe(0);

    const tap = wallApproachCar(blitzStats(), 4);
    for (let i = 0; i < 20; i++) {
      stepCar(tap.car, { throttle: 0, brake: 0, steer: 0, nitro: false }, tap.track, 1 / 60, catchUp);
    }
    expect(tap.car.koTimer).toBe(0);
    expect(tap.car.hp).toBeGreaterThan(0);
  });

  it("Bunker survives the same high-speed wall slam that KOs Blitz", () => {
    const blitz = wallApproachCar(blitzStats(), 28);
    const bunker = wallApproachCar(bunkerStats(), 28);
    for (let i = 0; i < 20; i++) {
      if (blitz.car.koTimer <= 0) {
        stepCar(blitz.car, { throttle: 1, brake: 0, steer: 0, nitro: false }, blitz.track, 1 / 60, catchUp);
      }
      stepCar(bunker.car, { throttle: 1, brake: 0, steer: 0, nitro: false }, bunker.track, 1 / 60, catchUp);
    }
    expect(blitz.car.koTimer).toBeGreaterThan(0);
    expect(bunker.car.koTimer).toBe(0);
    expect(bunker.car.hp).toBeGreaterThan(0);
  });

  it("HUD shows a Comeback countdown while K.O.", () => {
    expect(renderDamageHudHtml(0, 2.2, 0)).toContain("Comeback 3");
    expect(renderDamageHudHtml(0, 0.2, 0)).toContain("Comeback 1");
    expect(renderDamageHudHtml(1, 0, 0)).toContain("Tip-top");
  });

  it("placeOnRacingLine sits on centerline facing the tangent", () => {
    const { track, car } = wallApproachCar(blitzStats(), 12);
    placeOnRacingLine(car, track);
    const near = nearestOnTrack(track, { x: car.x, z: car.z });
    expect(Math.abs(near.lateral)).toBeLessThan(0.35);
  });
});

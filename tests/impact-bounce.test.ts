import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import { applyWallBounce, createCarState, resolveObstacles, stepCar } from "../src/sim/vehicle";
import { buildTrackFromLevel, nearestOnTrack } from "../src/track/buildTrack";
import type { LevelDefinition } from "../src/track/types";

function wallGrindSetup(track: ReturnType<typeof buildTrackFromLevel>) {
  const sample = track.centerline[5]!;
  const next = track.centerline[6]!;
  const tx = next.x - sample.x;
  const tz = next.z - sample.z;
  const len = Math.hypot(tx, tz) || 1;
  const nx = -tz / len;
  const nz = tx / len;
  const edge = track.asphaltHalfWidth + track.grassWidth + 0.8;
  const x = sample.x + nx * edge;
  const z = sample.z + nz * edge;
  const near = nearestOnTrack(track, { x, z });
  const sign = Math.sign(near.lateral) || 1;
  const outwardX = sign * -near.tangent.z;
  const outwardZ = sign * near.tangent.x;
  const outwardHeading = Math.atan2(outwardZ, outwardX);
  return { x, z, outwardHeading, outwardX, outwardZ };
}

describe("wall bounce + fair impact damage", () => {
  it("does not KO Blitz from ~2s of wall grinding (impact cooldown + bounce)", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const { x, z, outwardHeading } = wallGrindSetup(track);
    const car = createCarState({
      id: "player",
      x,
      z,
      heading: outwardHeading,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 28,
    });

    for (let i = 0; i < 120; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, {
        accel: 1,
        topSpeed: 1,
      });
    }

    expect(car.koTimer).toBe(0);
    expect(car.hp).toBeGreaterThan(0.15);
  });

  it("bounces heading/speed away from the wall on impact", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const { x, z, outwardHeading, outwardX, outwardZ } = wallGrindSetup(track);
    const car = createCarState({
      id: "player",
      x,
      z,
      heading: outwardHeading,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 22,
    });

    const outBefore =
      Math.cos(car.heading) * outwardX + Math.sin(car.heading) * outwardZ;

    stepCar(car, { throttle: 0, brake: 0, steer: 0, nitro: false }, track, 1 / 60, {
      accel: 1,
      topSpeed: 1,
    });

    const outAfter = Math.cos(car.heading) * outwardX + Math.sin(car.heading) * outwardZ;
    expect(outBefore).toBeGreaterThan(0.2);
    expect(outAfter).toBeLessThan(0.1);
    expect(car.speed).toBeLessThan(22);
    expect(car.hp).toBeLessThan(1);
    const velOut = car.vx * outwardX + car.vz * outwardZ;
    expect(velOut).toBeLessThan(0);
  });

  it("tire walls bounce outbound like bumpers, not a scrape", () => {
    const car = createCarState({
      id: "player",
      x: 0,
      z: 0,
      heading: Math.PI / 2,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 20,
    });
    car.vx = 0;
    car.vz = 20;
    const inbound = 20;
    applyWallBounce(
      car,
      {
        zone: "wall",
        speedFactor: 0.35,
        gripFactor: 0.4,
        wallKind: "tire",
        bump: 0,
        lateral: 12,
        distanceAlong: 10,
        tangent: { x: 1, z: 0 },
      },
      2,
    );
    const velOut = car.vz;
    expect(velOut).toBeLessThan(0);
    expect(-velOut).toBeGreaterThan(inbound * 0.45);
  });
});

describe("on-track obstacle bounce", () => {
  it("takes light damage and separates from a tire stack instead of ghosting through", () => {
    const level = CUP_LEVELS.find((l) => l.id === "blitz_cup_04_buckelpiste")!;
    const obstacles = level.obstacles.filter((o) => o.type === "tire_stack");
    expect(obstacles.length).toBeGreaterThan(0);
    const o = obstacles[0]!;
    const [ox, oz] = o.position;
    const radius = o.radius ?? 1.5;

    const car = createCarState({
      id: "player",
      x: ox + 0.2,
      z: oz,
      heading: 0,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      modelId: "blitz",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 18,
    });

    const hit = resolveObstacles(car, obstacles as LevelDefinition["obstacles"]);
    expect(hit).toBe(true);
    expect(car.hp).toBeLessThan(1);
    expect(Math.hypot(car.x - ox, car.z - oz)).toBeGreaterThanOrEqual(radius + 0.9);
    expect(car.speed).toBeLessThan(18);
  });
});

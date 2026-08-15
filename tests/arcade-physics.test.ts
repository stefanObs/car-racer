import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import { CUP_LEVELS } from "../src/data/levels";
import {
  BASE_TOP,
  brakeForceFor,
  createCarState,
  gripPullRate,
  isAirborne,
  nitroForceFor,
  resolveContact,
  slipAngle,
  stepCar,
  stepJump,
  yawRateFor,
  type MergedVehicleStats,
} from "../src/sim/vehicle";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../src/track/buildTrack";

const catchUp = { accel: 1, topSpeed: 1 };

function merged(id: keyof typeof CARS, parts: Parameters<typeof mergeStats>[1] = []): MergedVehicleStats {
  return mergeStats(CARS[id].stats, parts);
}

function onTrackCar(stats: MergedVehicleStats, speed = 0, modelId = "blitz") {
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
    modelId,
    stats,
    speed,
  });
  return { track, car };
}

describe("arcade physics — Eigenschaften scaling", () => {
  it("Blitz accelerates harder than Bunker from a standstill", () => {
    const blitz = onTrackCar(merged("blitz"));
    const bunker = onTrackCar(merged("bunker"), 0, "bunker");
    for (let i = 0; i < 90; i++) {
      stepCar(blitz.car, { throttle: 1, brake: 0, steer: 0, nitro: false }, blitz.track, 1 / 60, catchUp);
      stepCar(bunker.car, { throttle: 1, brake: 0, steer: 0, nitro: false }, bunker.track, 1 / 60, catchUp);
    }
    expect(blitz.car.speed).toBeGreaterThan(bunker.car.speed * 1.2);
  });

  it("records driver steer on the car for front-wheel visuals", () => {
    const { car, track } = onTrackCar(merged("bison"), 8, "bison");
    stepCar(car, { throttle: 0.5, brake: 0, steer: -0.75, nitro: false }, track, 1 / 60, catchUp);
    expect(car.steer).toBeCloseTo(-0.75);
    stepCar(car, { throttle: 0.5, brake: 0, steer: 0.4, nitro: false }, track, 1 / 60, catchUp);
    expect(car.steer).toBeCloseTo(0.4);
  });

  it("brakes harder with better_brakes / higher Handling", () => {
    const stock = brakeForceFor(merged("blitz"));
    const tuned = brakeForceFor(merged("blitz", ["better_brakes"]));
    expect(tuned).toBeGreaterThan(stock * 1.25);

    const a = onTrackCar(merged("blitz"), 28);
    const b = onTrackCar(merged("blitz", ["better_brakes"]), 28);
    for (let i = 0; i < 18; i++) {
      stepCar(a.car, { throttle: 0, brake: 1, steer: 0, nitro: false }, a.track, 1 / 60, catchUp);
      stepCar(b.car, { throttle: 0, brake: 1, steer: 0, nitro: false }, b.track, 1 / 60, catchUp);
    }
    expect(b.car.speed).toBeLessThan(a.car.speed - 1.5);
    expect(a.car.speed).toBeGreaterThan(5);
  });

  it("low Grip slides more than high Grip under hard steer", () => {
    const hot = onTrackCar(merged("donnerbuechse"), 26, "donnerbuechse");
    const buggy = onTrackCar(merged("kaeferkraft"), 26, "kaeferkraft");
    hot.car.stats.handling = buggy.car.stats.handling;
    hot.car.stats.mass = buggy.car.stats.mass;
    for (let i = 0; i < 25; i++) {
      stepCar(hot.car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, hot.track, 1 / 60, catchUp);
      stepCar(buggy.car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, buggy.track, 1 / 60, catchUp);
    }
    expect(hot.car.drift).toBeGreaterThan(buggy.car.drift * 1.05);
    expect(gripPullRate({ grip: 1.25, gripFactor: 1, damageGrip: 1, steerLoad: 0.5, airborne: false })).toBeGreaterThan(
      gripPullRate({ grip: 0.7, gripFactor: 1, damageGrip: 1, steerLoad: 0.5, airborne: false }),
    );
  });

  it("higher Handling / lower mass tightens the turning circle", () => {
    const blitz = yawRateFor({
      steer: 1,
      speed: 14,
      handling: CARS.blitz.stats.handling,
      mass: CARS.blitz.stats.mass,
      gripFactor: 1,
      handlingMult: 1,
    });
    const bunker = yawRateFor({
      steer: 1,
      speed: 14,
      handling: CARS.bunker.stats.handling,
      mass: CARS.bunker.stats.mass,
      gripFactor: 1,
      handlingMult: 1,
    });
    expect(blitz).toBeGreaterThan(bunker * 1.25);
  });

  it("heavier cars push lighter cars farther on contact", () => {
    const light = createCarState({
      id: "light",
      x: 0,
      z: 0,
      heading: 0,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      modelId: "blitz",
      stats: merged("blitz"),
      speed: 20,
      vx: 20,
      vz: 0,
    });
    const heavy = createCarState({
      id: "heavy",
      x: 2.1,
      z: 0,
      heading: Math.PI,
      isPlayer: false,
      paint: "#868e96",
      sticker: "none",
      modelId: "bunker",
      stats: merged("bunker"),
      speed: 20,
      vx: -20,
      vz: 0,
    });
    const lightX0 = light.x;
    const heavyX0 = heavy.x;
    resolveContact(light, heavy);
    const lightPush = Math.abs(light.x - lightX0);
    const heavyPush = Math.abs(heavy.x - heavyX0);
    expect(lightPush).toBeGreaterThan(heavyPush);
    // Light car should reverse / lose more forward momentum into the heavy one
    expect(light.vx).toBeLessThan(heavy.vx);
  });

  it("Nitro adds a punchy kick and clear speed over throttle-only", () => {
    expect(nitroForceFor(0, 1)).toBeGreaterThan(110);
    expect(nitroForceFor(CARS.donnerbuechse.stats.nitroBonus ?? 0, 1)).toBeGreaterThan(nitroForceFor(0, 1) + 12);

    const stock = onTrackCar(merged("blitz"), 18);
    const nitro = onTrackCar(merged("blitz"), 18);
    // One-frame kick must already jump speed
    stepCar(nitro.car, { throttle: 1, brake: 0, steer: 0, nitro: true }, nitro.track, 1 / 60, catchUp);
    expect(nitro.car.speed).toBeGreaterThan(18 + 6);

    for (let i = 0; i < 50; i++) {
      stepCar(stock.car, { throttle: 1, brake: 0, steer: 0, nitro: false }, stock.track, 1 / 60, catchUp);
      stepCar(nitro.car, { throttle: 1, brake: 0, steer: 0, nitro: true }, nitro.track, 1 / 60, catchUp);
    }
    const stockTop = BASE_TOP * merged("blitz").topSpeed;
    expect(nitro.car.speed).toBeGreaterThan(stock.car.speed + 8);
    expect(nitro.car.speed).toBeGreaterThan(stockTop * 1.2);
    expect(nitro.car.nitro).toBeLessThan(0.85);
  });

  it("mild steer at speed does not auto-drift; hard full-speed corners do", () => {
    const mild = onTrackCar(merged("blitz"), 24);
    for (let i = 0; i < 30; i++) {
      stepCar(mild.car, { throttle: 1, brake: 0, steer: 0.35, nitro: false, drift: false }, mild.track, 1 / 60, catchUp);
    }
    expect(mild.car.drift).toBeLessThan(0.15);

    const hard = onTrackCar(merged("blitz"), 26);
    for (let i = 0; i < 35; i++) {
      stepCar(hard.car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: false }, hard.track, 1 / 60, catchUp);
    }
    expect(hard.car.drift).toBeGreaterThan(0.35);
  });

  it("Drift button + steer builds Kart outside-drift slip (nose leads, capped ~45°)", () => {
    const { track, car } = onTrackCar(merged("blitz"), 24);
    for (let i = 0; i < 40; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, track, 1 / 60, catchUp);
    }
    const slip = slipAngle(car.heading, car.vx, car.vz);
    expect(car.drift).toBeGreaterThan(0.45);
    // Outside drift: nose into the turn, velocity lags outside (steer+ → slip > 0)
    expect(slip).toBeGreaterThan(0.28);
    expect(slip).toBeLessThan(0.85);
  });

  it("soft steer while drifting seeks a smaller slip than hard steer", () => {
    const soft = onTrackCar(merged("blitz"), 24);
    const hard = onTrackCar(merged("blitz"), 24);
    for (let i = 0; i < 40; i++) {
      stepCar(soft.car, { throttle: 1, brake: 0, steer: 0.45, nitro: false, drift: true }, soft.track, 1 / 60, catchUp);
      stepCar(hard.car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, hard.track, 1 / 60, catchUp);
    }
    const softSlip = Math.abs(slipAngle(soft.car.heading, soft.car.vx, soft.car.vz));
    const hardSlip = Math.abs(slipAngle(hard.car.heading, hard.car.vx, hard.car.vz));
    expect(hardSlip).toBeGreaterThan(softSlip + 0.06);
  });

  it("low Grip drifts harder than high Grip; mini-boost can fire after a held drift", () => {
    const hot = onTrackCar(merged("donnerbuechse"), 24, "donnerbuechse");
    const buggy = onTrackCar(merged("kaeferkraft"), 24, "kaeferkraft");
    hot.car.stats.handling = buggy.car.stats.handling;
    hot.car.stats.mass = buggy.car.stats.mass;
    for (let i = 0; i < 35; i++) {
      stepCar(hot.car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, hot.track, 1 / 60, catchUp);
      stepCar(buggy.car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, buggy.track, 1 / 60, catchUp);
    }
    expect(hot.car.drift).toBeGreaterThan(buggy.car.drift + 0.05);

    const drifter = onTrackCar(merged("blitz"), 22);
    for (let i = 0; i < 32; i++) {
      stepCar(drifter.car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, drifter.track, 1 / 60, catchUp);
    }
    expect(drifter.car.driftTime).toBeGreaterThan(0.45);
    const heldSpeed = drifter.car.speed;
    // Release drift button → exit, optional mini-turbo
    for (let i = 0; i < 12; i++) {
      stepCar(drifter.car, { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false }, drifter.track, 1 / 60, catchUp);
    }
    expect(drifter.car.drift).toBeLessThan(0.25);
    // Mini-turbo fires once (driftTime cleared) and keeps most of the pace
    expect(drifter.car.driftTime).toBe(0);
    expect(drifter.car.speed).toBeGreaterThan(heldSpeed * 0.9);
  });

  it("keeps most pace when exiting a drift while still steering through the corner", () => {
    const { track, car } = onTrackCar(merged("blitz"), 24);
    for (let i = 0; i < 24; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 1, nitro: false, drift: true }, track, 1 / 60, catchUp);
    }
    expect(car.drift).toBeGreaterThan(0.45);
    const heldSpeed = car.speed;
    // Mid steer: exit the slide without re-triggering oversteer
    for (let i = 0; i < 12; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0.45, nitro: false, drift: false }, track, 1 / 60, catchUp);
    }
    expect(car.speed).toBeGreaterThan(heldSpeed * 0.9);
  });

  it("ramps launch the car airborne and landings return to the ground", () => {
    const car = createCarState({
      id: "jumper",
      x: 0,
      z: 0,
      heading: 0,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: merged("blitz"),
      speed: 22,
      vx: 22,
      vz: 0,
    });
    stepJump(car, 0.95, 1 / 60);
    expect(isAirborne(car)).toBe(true);
    expect(car.vy).toBeGreaterThan(8);
    const peakVy = car.vy;

    let peakY = 0;
    for (let i = 0; i < 240; i++) {
      stepJump(car, 0, 1 / 60);
      peakY = Math.max(peakY, car.y);
    }
    expect(peakY).toBeGreaterThan(2.2);
    expect(car.y).toBe(0);
    expect(car.vy).toBe(0);
    expect(isAirborne(car)).toBe(false);
    expect(peakVy).toBeGreaterThan(8);
  });

  it("driving onto a Schanze obstacle launches via stepCar", () => {
    const level = CUP_LEVELS.find((l) => l.obstacles.some((o) => o.type === "ramp"));
    expect(level).toBeTruthy();
    const ramp = level!.obstacles.find((o) => o.type === "ramp")!;
    const track = buildTrackFromLevel(level!);
    const [ox, oz] = ramp.position;
    const car = createCarState({
      id: "player",
      x: ox,
      z: oz,
      heading: 0,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: merged("blitz"),
      speed: 24,
      vx: 24,
      vz: 0,
    });
    stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp, level!.obstacles);
    expect(car.y).toBeGreaterThan(0.05);
    expect(car.vy).toBeGreaterThan(2);
  });

  it("does not spend the Schanze punch on the ramp fringe", () => {
    const car = createCarState({
      id: "jumper",
      x: 0,
      z: 0,
      heading: 0,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: merged("blitz"),
      speed: 24,
      vx: 24,
      vz: 0,
    });
    stepJump(car, 0.15, 1 / 60);
    expect(isAirborne(car)).toBe(false);
    expect(car.vy).toBe(0);
    stepJump(car, 0.85, 1 / 60);
    expect(isAirborne(car)).toBe(true);
    expect(car.vy).toBeGreaterThan(10);
  });

  it("driving the racing line over cup ramps still gets a comic hop", () => {
    const hops: number[] = [];
    for (const level of CUP_LEVELS) {
      const ramps = level.obstacles.filter((o) => o.type === "ramp");
      if (!ramps.length) continue;
      const track = buildTrackFromLevel(level);
      for (const ramp of ramps) {
        const near = nearestOnTrack(track, { x: ramp.position[0], z: ramp.position[1] });
        const approach = sampleCenterline(
          track,
          (near.distanceAlong - 18 + track.totalLength) % track.totalLength,
        );
        const heading = Math.atan2(approach.tangent.z, approach.tangent.x);
        const car = createCarState({
          id: "player",
          x: approach.position.x,
          z: approach.position.z,
          heading,
          isPlayer: true,
          paint: "#e03131",
          sticker: "none",
          stats: merged("blitz"),
          speed: 24,
        });
        car.vx = Math.cos(heading) * 24;
        car.vz = Math.sin(heading) * 24;
        let peakY = 0;
        let peakVy = 0;
        for (let i = 0; i < 240; i++) {
          stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, catchUp, level.obstacles);
          peakY = Math.max(peakY, car.y);
          peakVy = Math.max(peakVy, car.vy);
        }
        hops.push(peakY);
        expect(peakVy, `${level.id} ramp vy`).toBeGreaterThan(8);
        expect(peakY, `${level.id} ramp hop`).toBeGreaterThan(2.2);
      }
    }
    expect(hops.length).toBeGreaterThan(0);
  });
});

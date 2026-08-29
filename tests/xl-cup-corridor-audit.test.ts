/**
 * XL cup audit: center racing line stays clear of solid blockers; cars cannot
 * leave the ribbon or hop onto a parallel section.
 */
import { describe, expect, it } from "vitest";
import { collisionRadiusFor } from "../src/data/carModels";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../src/track/buildTrack";
import {
  CORRIDOR_ALONG_WINDOW_M,
  driveableRibbonPinches,
  findRibbonPinches,
  wallLimitFor,
} from "../src/track/layoutRules";
import { planMedianBarriers } from "../src/track/medianBarriers";
import { pointOnTrack } from "../src/track/validateTrack";
import { createCarState, stepCar } from "../src/sim/vehicle";

const CAR_R = collisionRadiusFor("blitz");
const CENTER_HALF = 0.32;

function centerStripBlocked(
  track: ReturnType<typeof buildTrackFromLevel>,
  level: (typeof CUP_LEVELS)[number],
): Array<{ along: number; type: string; role?: string }> {
  const blocked: Array<{ along: number; type: string; role?: string }> = [];
  const solids = level.obstacles.filter(
    (o) => o.type === "tire_stack" || o.type === "concrete_barrier",
  );

  for (let d = 0; d < track.totalLength; d += 6) {
    const center = pointOnTrack(track, d, 0);
    for (const o of solids) {
      const [ox, oz] = o.position;
      const obstR = o.radius ?? (o.type === "tire_stack" ? 1.45 : 1.25);
      const dist = Math.hypot(center.x - ox, center.z - oz);
      if (dist >= obstR + CAR_R + 0.25) continue;
      blocked.push({ along: d, type: o.type, role: o.role });
    }
  }
  return blocked;
}

function driveCenterLap(
  level: (typeof CUP_LEVELS)[number],
  opts: { maxSteps?: number } = {},
): { maxLateral: number; escaped: boolean } {
  const track = buildTrackFromLevel(level);
  const s0 = sampleCenterline(track, 0);
  const car = createCarState({
    id: "player",
    x: s0.position.x,
    z: s0.position.z,
    heading: Math.atan2(s0.tangent.z, s0.tangent.x),
    isPlayer: true,
    paint: "#e03131",
    sticker: "none",
    stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
    speed: 14,
    modelId: "blitz",
  });
  car.vx = s0.tangent.x * 14;
  car.vz = s0.tangent.z * 14;

  const limit = wallLimitFor(track);
  let maxLateral = 0;
  const maxSteps = opts.maxSteps ?? Math.ceil((track.totalLength / 7) * 60) + 2400;

  for (let step = 0; step < maxSteps; step++) {
    const len = track.totalLength;
    const along = ((car.progress % len) + len) % len;
    const look = sampleCenterline(track, along + 16);
    const toX = look.position.x - car.x;
    const toZ = look.position.z - car.z;
    const want = Math.atan2(toZ, toX);
    let err = want - car.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, err * 1.6));
    stepCar(car, { throttle: 1, brake: 0, steer, nitro: false, drift: false }, track, 1 / 60, {
      accel: 1,
      topSpeed: 1,
    }, level.obstacles);
    const near = nearestOnTrack(track, { x: car.x, z: car.z }, {
      preferAlong: car.distanceAlong,
      maxAlongGap: CORRIDOR_ALONG_WINDOW_M,
    });
    maxLateral = Math.max(maxLateral, Math.abs(near.lateral));
  }

  return { maxLateral, escaped: maxLateral > limit + 0.45 };
}

function bashOutward(
  level: (typeof CUP_LEVELS)[number],
  along: number,
  side: 1 | -1,
  seconds = 3,
): { maxLateral: number; escaped: boolean } {
  const track = buildTrackFromLevel(level);
  const s = sampleCenterline(track, along);
  const outward = { x: -s.tangent.z * side, z: s.tangent.x * side };
  const car = createCarState({
    id: "player",
    x: s.position.x,
    z: s.position.z,
    heading: Math.atan2(s.tangent.z + outward.z * 0.3, s.tangent.x + outward.x * 0.3),
    isPlayer: true,
    paint: "#e03131",
    sticker: "none",
    stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
    speed: 22,
    modelId: "blitz",
    distanceAlong: along,
  });
  car.vx = Math.cos(car.heading) * 22;
  car.vz = Math.sin(car.heading) * 22;

  const limit = wallLimitFor(track);
  let maxLateral = 0;
  const steer = side;
  for (let i = 0; i < seconds * 60; i++) {
    stepCar(
      car,
      { throttle: 1, brake: 0, steer, nitro: true, drift: false },
      track,
      1 / 60,
      { accel: 1, topSpeed: 1 },
      level.obstacles,
    );
    const near = nearestOnTrack(track, { x: car.x, z: car.z }, {
      preferAlong: car.distanceAlong,
      maxAlongGap: CORRIDOR_ALONG_WINDOW_M,
    });
    maxLateral = Math.max(maxLateral, Math.abs(near.lateral));
  }
  return { maxLateral, escaped: maxLateral > limit + 0.45 };
}

describe("XL cup corridor audit", () => {
  it("keeps the center racing strip free of solid blockers on every cup", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const blocked = centerStripBlocked(track, level);
      expect(blocked, `${level.id} center solids at ${blocked.map((b) => b.along).join(",")}`).toEqual([]);
      for (const o of level.obstacles.filter((x) => x.type === "tire_stack" || x.type === "concrete_barrier")) {
        const near = nearestOnTrack(track, { x: o.position[0]!, z: o.position[1]! });
        if (o.role === "median") {
          expect(Math.abs(near.lateral), `${level.id} median on center`).toBeGreaterThanOrEqual(
            track.asphaltHalfWidth * CENTER_HALF,
          );
          continue;
        }
        expect(Math.abs(near.lateral), `${level.id} verge solid`).toBeGreaterThanOrEqual(
          track.asphaltHalfWidth + 0.35,
        );
      }
    }
  });

  it("blocks every driveable ribbon hop with median barriers", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const pinches = driveableRibbonPinches(track);
      const medians = planMedianBarriers(track);
      for (const p of pinches) {
        const nearBarrier = medians.some((m) => Math.hypot(m.x - p.midX, m.z - p.midZ) < 14);
        expect(nearBarrier, `${level.id} pinch ${p.alongA}<->${p.alongB}`).toBe(true);
      }
    }
  });

  it("prevents a lateral hop onto a far-along ribbon on every cup", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const driveable = driveableRibbonPinches(track);
      const pinches = driveable.length ? driveable : findRibbonPinches(track).slice(0, 1);
      if (!pinches.length) continue;
      const pinch = pinches[0]!;
      const a = sampleCenterline(track, pinch.alongA).position;
      const b = sampleCenterline(track, pinch.alongB).position;
      const heading = Math.atan2(b.z - a.z, b.x - a.x);
      const car = createCarState({
        id: "player",
        x: a.x,
        z: a.z,
        heading,
        isPlayer: true,
        paint: "#e03131",
        sticker: "none",
        stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
        speed: 18,
        modelId: "blitz",
      });
      car.vx = Math.cos(heading) * 18;
      car.vz = Math.sin(heading) * 18;
      const startAlong = nearestOnTrack(track, { x: car.x, z: car.z }).distanceAlong;
      for (let t = 0; t < 90; t++) {
        stepCar(
          car,
          { throttle: 1, brake: 0, steer: 0, nitro: false },
          track,
          1 / 60,
          { accel: 1, topSpeed: 1 },
          level.obstacles,
        );
      }
      const endAlong = nearestOnTrack(track, { x: car.x, z: car.z }).distanceAlong;
      const nearTarget =
        Math.min(Math.abs(endAlong - pinch.alongB), track.totalLength - Math.abs(endAlong - pinch.alongB)) <
        30;
      const jumped =
        Math.min(Math.abs(endAlong - startAlong), track.totalLength - Math.abs(endAlong - startAlong)) > 35;
      expect(nearTarget && jumped, `${level.id} hopped ${startAlong}->${endAlong}`).toBe(false);
    }
  });

  it("center-line follow stays on the ribbon for a full simulated lap", () => {
    for (const level of CUP_LEVELS) {
      const { escaped } = driveCenterLap(level);
      expect(escaped, `${level.id} left ribbon`).toBe(false);
    }
  });

  it("nitro outward bash cannot leave asphalt+grass wall limit", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const limit = wallLimitFor(track);
      const probes = [track.totalLength * 0.12, track.totalLength * 0.45, track.totalLength * 0.78];
      for (const along of probes) {
        for (const side of [1, -1] as const) {
          const { maxLateral, escaped } = bashOutward(level, along, side);
          expect(maxLateral, `${level.id} along=${along} side=${side}`).toBeLessThanOrEqual(limit + 0.5);
          expect(escaped, `${level.id} escaped along=${along}`).toBe(false);
        }
      }
    }
  });
});

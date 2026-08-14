import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../src/track/buildTrack";
import { findRibbonPinches } from "../src/track/layoutRules";
import { createCarState, stepCar } from "../src/sim/vehicle";

describe("track corridor physics (Phase C)", () => {
  it("soft-clamps airborne cars that fly past the grass/wall edge", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const limit = track.asphaltHalfWidth + track.grassWidth;
    const s = sampleCenterline(track, 20);
    const outward = {
      x: s.position.x + -s.tangent.z * (limit + 8),
      z: s.position.z + s.tangent.x * (limit + 8),
    };
    const car = createCarState({
      id: "player",
      x: outward.x,
      z: outward.z,
      y: 2.5,
      vy: 1,
      heading: Math.atan2(s.tangent.z, s.tangent.x),
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 20,
      distanceAlong: 20,
    });
    car.vx = Math.cos(car.heading) * 12;
    car.vz = Math.sin(car.heading) * 12;
    const hpBefore = car.hp;

    for (let i = 0; i < 30; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, {
        accel: 1,
        topSpeed: 1,
      });
    }

    const after = nearestOnTrack(track, { x: car.x, z: car.z }, { preferAlong: 20 });
    expect(Math.abs(after.lateral)).toBeLessThanOrEqual(limit + 0.35);
    expect(car.hp).toBe(hpBefore);
  });

  it("preferAlong keeps nearest sample on the progress ribbon at a pinch midpoint", () => {
    const level = CUP_LEVELS.find((l) => l.id === "blitz_cup_03_stadtring")!;
    const track = buildTrackFromLevel(level);
    const pinches = findRibbonPinches(track);
    expect(pinches.length).toBeGreaterThan(0);
    const p = pinches[0]!;
    const plain = nearestOnTrack(track, { x: p.midX, z: p.midZ });
    const biased = nearestOnTrack(track, { x: p.midX, z: p.midZ }, { preferAlong: p.alongA });
    const gapPlain = Math.min(
      Math.abs(plain.distanceAlong - p.alongA),
      track.totalLength - Math.abs(plain.distanceAlong - p.alongA),
    );
    const gapBias = Math.min(
      Math.abs(biased.distanceAlong - p.alongA),
      track.totalLength - Math.abs(biased.distanceAlong - p.alongA),
    );
    expect(gapBias).toBeLessThanOrEqual(gapPlain);
    expect(gapBias).toBeLessThan(25);
  });

  it("progress-biased walls yank a car back across a synthetic parallel hop", () => {
    // Two long parallel legs 14 m apart, far apart along-track (not a loop seam).
    const pts = [
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 110, z: 7 },
      { x: 100, z: 14 },
      { x: 0, z: 14 },
      { x: -10, z: 7 },
    ];
    const dists = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      dists.push(dists[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
    }
    const loopClose = Math.hypot(pts[pts.length - 1]!.x - pts[0]!.x, pts[pts.length - 1]!.z - pts[0]!.z);
    const track = {
      centerline: pts,
      cumulativeDistances: dists,
      totalLength: dists[dists.length - 1]! + loopClose,
      asphaltHalfWidth: 6,
      grassWidth: 3,
      wallKind: pts.map(() => "concrete" as const),
      unevenMasks: [],
      spawnHeading: 0,
    };
    const car = createCarState({
      id: "player",
      x: 40,
      z: 0,
      heading: Math.PI / 2,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 16,
      distanceAlong: 40,
    });
    car.vx = 0;
    car.vz = 16;
    for (let t = 0; t < 90; t++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, {
        accel: 1,
        topSpeed: 1,
      }, []);
    }
    // Must remain associated with the bottom leg, not snap onto z=14.
    expect(car.distanceAlong).toBeLessThan(90);
    expect(Math.abs(car.z)).toBeLessThan(10);
  });
});

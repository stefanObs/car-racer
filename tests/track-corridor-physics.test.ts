import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../src/track/buildTrack";
import { findRibbonPinches, CORRIDOR_ALONG_WINDOW_M, RIBBON_PINCH_MIN_ALONG_GAP_M } from "../src/track/layoutRules";
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
    const biased = nearestOnTrack(track, { x: p.midX, z: p.midZ }, { preferAlong: p.alongA, maxAlongGap: CORRIDOR_ALONG_WINDOW_M });
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

  it("Omegatal airborne run at a wall cannot snap onto a far ribbon", () => {
    const level = CUP_LEVELS.find((l) => l.id.includes("buckelpiste"))!;
    const track = buildTrackFromLevel(level);
    let worst: { d: number; e: number; dist: number } | null = null;
    for (let d = 0; d < track.totalLength; d += 5) {
      const a = sampleCenterline(track, d);
      for (let e = d + 45; e < track.totalLength; e += 5) {
        const alongGap = Math.min(e - d, track.totalLength - (e - d));
        if (alongGap < RIBBON_PINCH_MIN_ALONG_GAP_M) continue;
        const b = sampleCenterline(track, e);
        const dist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        if (!worst || dist < worst.dist) worst = { d, e, dist };
      }
    }
    expect(worst).toBeTruthy();
    const a = sampleCenterline(track, worst!.d);
    const b = sampleCenterline(track, worst!.e);
    const heading = Math.atan2(b.position.z - a.position.z, b.position.x - a.position.x);
    const car = createCarState({
      id: "player",
      x: a.position.x,
      z: a.position.z,
      heading,
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 22,
      distanceAlong: worst!.d,
      y: 2.2,
      vy: 8,
    });
    car.vx = Math.cos(heading) * 22;
    car.vz = Math.sin(heading) * 22;
    for (let i = 0; i < 120; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, { accel: 1, topSpeed: 1 }, level.obstacles);
    }
    const end = nearestOnTrack(track, { x: car.x, z: car.z }, { preferAlong: car.distanceAlong, maxAlongGap: CORRIDOR_ALONG_WINDOW_M });
    const alongGap = Math.min(
      Math.abs(end.distanceAlong - worst!.d),
      track.totalLength - Math.abs(end.distanceAlong - worst!.d),
    );
    expect(alongGap, `snapped ${worst!.d}→${end.distanceAlong}`).toBeLessThan(35);
    const limit = track.asphaltHalfWidth + track.grassWidth;
    expect(Math.abs(end.lateral)).toBeLessThanOrEqual(limit + 0.6);
  });

  it("racing-line throttle on Hafenstart advances along (no corridor freeze)", () => {
    const level = CUP_LEVELS.find((l) => l.id === "blitz_cup_01_hafenstart")!;
    const track = buildTrackFromLevel(level);
    const s = sampleCenterline(track, 8);
    const car = createCarState({
      id: "player",
      x: s.position.x,
      z: s.position.z,
      heading: Math.atan2(s.tangent.z, s.tangent.x),
      isPlayer: true,
      paint: "#e03131",
      sticker: "none",
      stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
      speed: 16,
      distanceAlong: 8,
    });
    car.vx = s.tangent.x * 16;
    car.vz = s.tangent.z * 16;
    for (let i = 0; i < 90; i++) {
      stepCar(car, { throttle: 1, brake: 0, steer: 0, nitro: false }, track, 1 / 60, {
        accel: 1,
        topSpeed: 1,
      }, level.obstacles);
    }
    const gained = Math.min(
      Math.abs(car.distanceAlong - 8),
      track.totalLength - Math.abs(car.distanceAlong - 8),
    );
    expect(gained).toBeGreaterThan(20);
  });
});

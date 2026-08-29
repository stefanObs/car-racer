import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { CUP_LEVELS } from "../src/data/levels";
import { generateAdhocLevel } from "../src/track/adhoc";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../src/track/buildTrack";
import {
  ALLOWED_NON_TRIPO_SCENERY,
  driveableRibbonPinches,
  findRibbonPinches,
  isAllowedNonTripoScenery,
  minRibbonSeparation,
  ribbonHopBlockedByWallLimit,
  ribbonSeparationOk,
  wallLimitFor,
} from "../src/track/layoutRules";
import { planMedianBarriers } from "../src/track/medianBarriers";
import type { BuiltTrack, LevelDefinition, TrackSegment } from "../src/track/types";
import { isTripoSceneryKind, planSceneryAnchors } from "../src/render/themeScenery";
import { createCarState, stepCar } from "../src/sim/vehicle";

function ovalLevel(opts: { asphaltWidth: number; grassWidth: number; radius: number }): LevelDefinition {
  const segs: TrackSegment[] = [
    { type: "straight", length: 40, width: opts.asphaltWidth },
    { type: "curve_r", radius: opts.radius, angleDeg: 90, width: opts.asphaltWidth },
    { type: "straight", length: 40, width: opts.asphaltWidth },
    { type: "curve_r", radius: opts.radius, angleDeg: 90, width: opts.asphaltWidth },
    { type: "straight", length: 40, width: opts.asphaltWidth },
    { type: "curve_r", radius: opts.radius, angleDeg: 90, width: opts.asphaltWidth },
    { type: "straight", length: 40, width: opts.asphaltWidth },
    { type: "curve_r", radius: opts.radius, angleDeg: 90, width: opts.asphaltWidth },
  ];
  return {
    id: "synth_oval",
    kind: "adhoc",
    displayName: "Synth",
    description: "test",
    theme: "harbor",
    laps: 3,
    recommendedClass: "sport",
    gripMultiplier: 1,
    track: {
      closedLoop: true,
      asphaltWidth: opts.asphaltWidth,
      grassWidth: opts.grassWidth,
      segments: segs,
      walls: { rule: "tire_in_corners_concrete_on_straights" },
    },
    obstacles: [],
    spawn: { grid: [[0, 0]], headingDeg: 0 },
    rewards: { currency: "CHF", placePurse: [1], starsOnTop3: false },
  };
}

describe("track layoutRules (ribbon separation + scenery allowlist)", () => {
  it("computes min separation from asphalt+grass+car+margin", () => {
    const track = buildTrackFromLevel(ovalLevel({ asphaltWidth: 12, grassWidth: 3, radius: 28 }));
    const limit = wallLimitFor(track);
    expect(limit).toBe(9);
    expect(minRibbonSeparation(track, 1.1)).toBe(2 * 9 + 2 * 1.1 + 4);
  });

  it("passes a wide stadium oval and fails a hand-built parallel pinch", () => {
    const wide = buildTrackFromLevel(ovalLevel({ asphaltWidth: 12, grassWidth: 3, radius: 30 }));
    expect(ribbonSeparationOk(wide)).toBe(true);
    expect(findRibbonPinches(wide)).toEqual([]);

    const pts = [
      { x: 0, z: 0 },
      { x: 80, z: 0 },
      { x: 90, z: 7 },
      { x: 80, z: 14 },
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
    const pinched: BuiltTrack = {
      centerline: pts,
      cumulativeDistances: dists,
      totalLength: dists[dists.length - 1]! + loopClose,
      asphaltHalfWidth: 6,
      grassWidth: 3,
      wallKind: pts.map(() => "concrete" as const),
      unevenMasks: [],
      spawnHeading: 0,
    };

    const pinches = findRibbonPinches(pinched);
    expect(pinches.length).toBeGreaterThan(0);
    expect(ribbonSeparationOk(pinched)).toBe(false);
    expect(pinches.some((p) => p.midpointDriveable)).toBe(true);
    expect(planMedianBarriers(pinched).length).toBeGreaterThan(0);
  });

  it("keeps Hafenstart and Omegatal free of hop midpoints", () => {
    for (const id of ["blitz_cup_01_hafenstart", "blitz_cup_04_buckelpiste"]) {
      const level = CUP_LEVELS.find((l) => l.id === id)!;
      const track = buildTrackFromLevel(level);
      expect(ribbonHopBlockedByWallLimit(track), id).toBe(true);
      expect(driveableRibbonPinches(track), id).toEqual([]);
    }
  });

  it("blocks every cup ribbon hop with wallLimit and/or median section barriers", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const driveable = driveableRibbonPinches(track);
      const medians = level.obstacles.filter((o) => o.role === "median");
      if (driveable.length === 0) continue;
      expect(medians.length, `${level.id} needs median barriers`).toBeGreaterThan(0);
      for (const p of driveable) {
        const nearBarrier = medians.some(
          (m) => Math.hypot(m.position[0]! - p.midX, m.position[1]! - p.midZ) < 14,
        );
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

  it("allows only the documented non-Tripo scenery kinds on cups + ad-hoc", () => {
    expect(ALLOWED_NON_TRIPO_SCENERY).toEqual(["water"]);
    expect(isAllowedNonTripoScenery("lamp")).toBe(false);
    expect(isAllowedNonTripoScenery("water")).toBe(true);
    expect(isAllowedNonTripoScenery("crane")).toBe(false);

    const check = (track: BuiltTrack, theme: string, label: string) => {
      for (const a of planSceneryAnchors(track, theme)) {
        if (isTripoSceneryKind(a.kind)) continue;
        expect(isAllowedNonTripoScenery(a.kind), `${label} ${a.kind}`).toBe(true);
      }
    };

    for (const level of CUP_LEVELS) {
      check(buildTrackFromLevel(level), level.theme, level.id);
    }
    for (const theme of ["harbor", "beach", "city", "canyon", "factory"] as const) {
      const level = generateAdhocLevel({ seed: "A7F2", theme });
      check(buildTrackFromLevel(level), level.theme, `adhoc:${theme}`);
    }
  });
});

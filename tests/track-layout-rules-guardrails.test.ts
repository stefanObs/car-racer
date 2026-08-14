import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { generateAdhocLevel } from "../src/track/adhoc";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import {
  ALLOWED_NON_TRIPO_SCENERY,
  findRibbonPinches,
  isAllowedNonTripoScenery,
  minRibbonSeparation,
  ribbonSeparationOk,
  wallLimitFor,
} from "../src/track/layoutRules";
import type { BuiltTrack, LevelDefinition, TrackSegment } from "../src/track/types";
import { isTripoSceneryKind, planSceneryAnchors } from "../src/render/themeScenery";

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

    // Two long parallel legs 14 m apart — wallLimit 9 ⇒ overlapping grass, hop corridor.
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
  });

  it("keeps Hafenstart and Parabolbogen free of hop pinches", () => {
    for (const level of CUP_LEVELS.slice(0, 2)) {
      const track = buildTrackFromLevel(level);
      expect(ribbonSeparationOk(track), level.id).toBe(true);
    }
  });

  it("detects driveable midpoints on Schikanenring / Omegatal / Kuppenfinale (Phase B clears)", () => {
    const badIds = [
      "blitz_cup_03_stadtring",
      "blitz_cup_04_buckelpiste",
      "blitz_cup_05_cupfinale",
    ];
    for (const id of badIds) {
      const level = CUP_LEVELS.find((l) => l.id === id)!;
      const track = buildTrackFromLevel(level);
      const pinches = findRibbonPinches(track);
      expect(pinches.length, id).toBeGreaterThan(0);
      expect(
        pinches.some((p) => p.midpointDriveable),
        `${id} should have a driveable pinch midpoint`,
      ).toBe(true);
    }
  });

  it("allows only the documented non-Tripo scenery kinds on cups + ad-hoc", () => {
    expect(ALLOWED_NON_TRIPO_SCENERY).toEqual(["water", "dune", "lamp", "stack"]);
    expect(isAllowedNonTripoScenery("lamp")).toBe(true);
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

import { Box3 } from "three";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel, sampleCenterline } from "../src/track/buildTrack";
import {
  BRIDGE_CLEARANCE_M,
  BRIDGE_DECK_HALF_M,
  BRIDGE_DECK_Y_M,
  BRIDGE_RAMP_M,
  elevationAt,
  planBridgePiers,
  surfacePitchAt,
} from "../src/track/bridgeElevation";
import { buildSmoothTrack } from "../src/render/trackMesh";
import { createCarState, stepCar } from "../src/sim/vehicle";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";

/**
 * RCA / design locks for Brückenkreuz (CONCEPT §4.4.1):
 * Elevated comic asphalt IS the bridge; ground pass drives under; piers support.
 * No floating Tripo deck below the track.
 */
describe("bridge overpass underpass design (RCA)", () => {
  const level = CUP_LEVELS.find((l) => l.id === "blitz_cup_06_brueckenkreuz")!;

  it("does not place a floating Tripo bridge under the elevated ribbon", () => {
    expect(level.sceneryPlacements?.some((p) => p.kind === "bridge") ?? false).toBe(false);
  });

  it("ships the underpass design sheet", () => {
    expect(
      existsSync(resolve("assets/tripo-concepts/track-proposals/bridge-underpass-design.png")),
    ).toBe(true);
  });

  it("plans concrete piers under the elevated pass (drive-through center clear)", () => {
    const track = buildTrackFromLevel(level);
    const piers = planBridgePiers(track);
    expect(piers.length).toBeGreaterThanOrEqual(6);
    for (const p of piers) {
      expect(p.height).toBeGreaterThanOrEqual(BRIDGE_CLEARANCE_M);
      // Piers sit beside the asphalt, not in the driving lane.
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(track.asphaltHalfWidth);
    }
    const root = buildSmoothTrack(track);
    expect(root.getObjectByName("bridgePiers")).toBeTruthy();
  });

  it("keeps underpass clearance: deck high enough, ground pass at y≈0", () => {
    const track = buildTrackFromLevel(level);
    expect(BRIDGE_DECK_Y_M).toBeGreaterThanOrEqual(BRIDGE_CLEARANCE_M);
    expect(BRIDGE_DECK_Y_M).toBeLessThanOrEqual(3.8);
    expect(Math.max(...track.elevation)).toBeGreaterThanOrEqual(BRIDGE_DECK_Y_M - 0.05);

    let groundNearOrigin = false;
    let deckNearOrigin = false;
    for (let d = 0; d < track.totalLength; d += 1) {
      const s = sampleCenterline(track, d);
      if (Math.hypot(s.position.x, s.position.z) > 10) continue;
      if (s.y < 0.2) groundNearOrigin = true;
      if (s.y > BRIDGE_DECK_Y_M - 0.3) deckNearOrigin = true;
    }
    expect(groundNearOrigin).toBe(true);
    expect(deckNearOrigin).toBe(true);
  });

  it("lays elevated comic asphalt as the driveable deck", () => {
    const track = buildTrackFromLevel(level);
    const root = buildSmoothTrack(track);
    root.updateMatrixWorld(true);
    const mesh = root.getObjectByName("trackAsphalt");
    expect(mesh).toBeTruthy();
    const b = new Box3().setFromObject(mesh!);
    expect(b.max.y).toBeGreaterThan(BRIDGE_DECK_Y_M - 0.2);
    expect(b.max.y).toBeLessThan(BRIDGE_DECK_Y_M + 0.5);
    // Grass stays on the ground for an open underpass.
    const grass = root.getObjectByName("trackGrass");
    const gb = new Box3().setFromObject(grass!);
    expect(gb.max.y).toBeLessThan(1);
  });

  it("grounds cars on the elevated deck surfaceY", () => {
    const track = buildTrackFromLevel(level);
    let peakAlong = 0;
    let peakY = 0;
    for (let d = 0; d < track.totalLength; d += 0.5) {
      const y = sampleCenterline(track, d).y;
      if (y > peakY) {
        peakY = y;
        peakAlong = d;
      }
    }
    const s = sampleCenterline(track, peakAlong);
    const car = createCarState({
      id: "deck",
      isPlayer: true,
      x: s.position.x,
      z: s.position.z,
      y: s.y,
      surfaceY: s.y,
      heading: Math.atan2(s.tangent.z, s.tangent.x),
      speed: 20,
      distanceAlong: peakAlong,
      progress: peakAlong,
      paint: "#e03131",
      sticker: "none",
      stats: mergeStats(CARS.blitz.stats, []),
    });
    stepCar(
      car,
      { throttle: 0.4, brake: 0, steer: 0, nitro: false, drift: false },
      track,
      1 / 60,
      { accel: 1, topSpeed: 1 },
      [],
    );
    expect(car.surfaceY).toBeGreaterThan(BRIDGE_CLEARANCE_M);
    expect(Math.abs(car.y - car.surfaceY)).toBeLessThan(0.12);
  });

  it("uses a smoothstep climb onto the deck (no sharp kink)", () => {
    const track = buildTrackFromLevel(level);
    let peakD = 0;
    let peakY = 0;
    for (let d = 0; d < track.totalLength; d += 0.5) {
      const y = sampleCenterline(track, d).y;
      if (y > peakY) {
        peakY = y;
        peakD = d;
      }
    }
    expect(peakY).toBeGreaterThanOrEqual(BRIDGE_DECK_Y_M - 0.15);

    const mid = peakD - (BRIDGE_DECK_HALF_M + BRIDGE_RAMP_M * 0.5);
    const a = sampleCenterline(track, mid);
    const b = sampleCenterline(track, mid + 8);
    const slope = Math.abs(b.y - a.y) / 8;
    expect(slope).toBeLessThan(0.18);

    const y0 = sampleCenterline(track, peakD - 30).y;
    const y1 = sampleCenterline(track, peakD - 15).y;
    const y2 = sampleCenterline(track, peakD).y;
    expect(y1).toBeGreaterThan(y0);
    expect(y2).toBeGreaterThan(y1);
    expect(y2 - y1).toBeLessThanOrEqual(y1 - y0 + 0.05);
  });

  it("pitches grounded cars to follow the ramp", () => {
    const track = buildTrackFromLevel(level);
    let climbAlong = 0;
    for (let d = 0; d < track.totalLength; d += 0.5) {
      const y = elevationAt(track, d);
      if (y > 1.0 && y < BRIDGE_DECK_Y_M - 0.4) {
        climbAlong = d;
        break;
      }
    }
    expect(climbAlong).toBeGreaterThan(0);
    const pitch = surfacePitchAt(track, climbAlong);
    expect(Math.abs(pitch)).toBeGreaterThan(0.05);
    expect(Math.abs(pitch)).toBeLessThan(0.55);
    expect(surfacePitchAt(track, 0)).toBeCloseTo(0, 2);
  });
});

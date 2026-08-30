import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { BRIDGE_CLEARANCE_M, BRIDGE_DECK_Y_M, elevationAt } from "../src/track/bridgeElevation";
import { buildTrackFromLevel, sampleCenterline } from "../src/track/buildTrack";
import { loopSeamKinkDegrees, trackSelfIntersects } from "../src/track/validateTrack";
import { planMedianBarriers } from "../src/track/medianBarriers";
import { createCarState, isAirborne, stepCar, stepJump } from "../src/sim/vehicle";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";

describe("Brückenkreuz bridge cup (CONCEPT §4.4.1)", () => {
  const level = CUP_LEVELS.find((l) => l.id === "blitz_cup_06_brueckenkreuz")!;

  it("ships cup 6 with overpass theme, elevated deck, and open underpass", () => {
    expect(level).toBeTruthy();
    expect(level.displayName).toBe("Brückenkreuz");
    expect(level.theme).toBe("overpass");
    expect(level.laps).toBe(3);
    expect(level.track.authoredCenterline?.length).toBeGreaterThan(100);
    // Elevated asphalt is the bridge — no floating Tripo prop required.
    expect(level.sceneryPlacements?.some((p) => p.kind === "bridge") ?? false).toBe(false);

    const track = buildTrackFromLevel(level);
    expect(track.totalLength).toBeGreaterThan(700);
    expect(Math.max(...track.elevation)).toBeGreaterThanOrEqual(BRIDGE_DECK_Y_M - 0.05);
    expect(trackSelfIntersects(track)).toBe(false);
    expect(loopSeamKinkDegrees(track)).toBeLessThan(25);
    expect(planMedianBarriers(track).length).toBe(0);
  });

  it("separates over/under decks by clearance at the crossing", () => {
    const track = buildTrackFromLevel(level);
    let maxGap = 0;
    for (let d = 0; d < track.totalLength; d += 2) {
      const s = sampleCenterline(track, d);
      if (Math.hypot(s.position.x, s.position.z) > 8) continue;
      for (let e = d + 50; e < track.totalLength; e += 2) {
        const t = sampleCenterline(track, e);
        if (Math.hypot(t.position.x - s.position.x, t.position.z - s.position.z) > 5) continue;
        maxGap = Math.max(maxGap, Math.abs(s.y - t.y));
      }
    }
    expect(maxGap).toBeGreaterThanOrEqual(BRIDGE_CLEARANCE_M);
  });

  it("grounds cars on surfaceY when climbing the bridge deck", () => {
    const track = buildTrackFromLevel(level);
    let climbAlong = 0;
    for (let d = 0; d < track.totalLength; d += 1) {
      if (elevationAt(track, d) > 1.2 && elevationAt(track, d) < BRIDGE_DECK_Y_M - 0.2) {
        climbAlong = d;
        break;
      }
    }
    expect(climbAlong).toBeGreaterThan(0);
    const s = sampleCenterline(track, climbAlong);
    const car = createCarState({
      id: "t",
      isPlayer: true,
      x: s.position.x,
      z: s.position.z,
      y: s.y,
      surfaceY: s.y,
      heading: Math.atan2(s.tangent.z, s.tangent.x),
      speed: 28,
      distanceAlong: climbAlong,
      progress: climbAlong,
      paint: "#e03131",
      sticker: "none",
      stats: mergeStats(CARS.blitz.stats, []),
    });
    stepCar(
      car,
      { throttle: 1, brake: 0, steer: 0, nitro: false, drift: false },
      track,
      1 / 60,
      { accel: 1, topSpeed: 1 },
      [],
    );
    expect(car.surfaceY).toBeGreaterThan(0.5);
    expect(Math.abs(car.y - car.surfaceY)).toBeLessThan(0.08);
    expect(isAirborne(car)).toBe(false);

    car.vy = 12;
    car.y = car.surfaceY + 0.1;
    stepJump(car, 0, 1 / 60);
    expect(isAirborne(car)).toBe(true);
  });
});

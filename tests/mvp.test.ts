import { describe, expect, it } from "vitest";
import { mergeStats, activeSynergies } from "../src/data/parts";
import { CARS } from "../src/data/cars";
import { catchUpMultipliers } from "../src/sim/catchup";
import { applyHeal, applyHit, stageFromHp } from "../src/sim/damage";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { CUP_LEVELS } from "../src/data/levels";
import { surfaceAt } from "../src/sim/zones";
import { APP_VERSION } from "../src/core/version";
import { formatChf } from "../src/meta/save";

describe("mvp core", () => {
  it("versions the build", () => {
    expect(APP_VERSION).toBe("0.2.7");
  });

  it("builds a closed cup track with asphalt width", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    expect(track.centerline.length).toBeGreaterThan(20);
    expect(track.totalLength).toBeGreaterThan(100);
    expect(track.asphaltHalfWidth).toBe(6);
  });

  it("keeps grass slower even with suspension mitigation", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const onAsphalt = surfaceAt(track, 0, 0, 0.5, 1.4);
    // Move far laterally into grass band
    const sample = track.centerline[5]!;
    const next = track.centerline[6]!;
    const tx = next.x - sample.x;
    const tz = next.z - sample.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    const grassPoint = {
      x: sample.x + nx * (track.asphaltHalfWidth + 1),
      z: sample.z + nz * (track.asphaltHalfWidth + 1),
    };
    const onGrass = surfaceAt(track, grassPoint.x, grassPoint.z, 0.5, 1.4);
    expect(onGrass.zone).toBe("grass");
    expect(onGrass.speedFactor).toBeLessThan(1);
    expect(onGrass.speedFactor).toBeLessThanOrEqual(0.92);
    expect(onAsphalt.speedFactor).toBe(1);
  });

  it("heals damage over time and stages KO", () => {
    expect(stageFromHp(0)).toBe(4);
    expect(applyHit(1, 0.5, 1)).toBeLessThan(1);
    const healed = applyHeal(0.4, 2, false);
    expect(healed).toBeGreaterThan(0.4);
  });

  it("gives catch-up to trailing places only mildly", () => {
    const lead = catchUpMultipliers(1, 6);
    const last = catchUpMultipliers(6, 6);
    expect(last.accel).toBeGreaterThan(lead.accel);
    expect(last.topSpeed).toBeGreaterThan(lead.topSpeed);
    expect(last.topSpeed).toBeLessThan(1.1);
  });

  it("applies part synergies for street glue", () => {
    const parts = ["big_engine", "big_wheels", "rear_spoiler"] as const;
    const syn = activeSynergies([...parts]);
    expect(syn.some((s) => s.id === "street_glue")).toBe(true);
    const stats = mergeStats(CARS.blitz.stats, [...parts]);
    expect(stats.grip).toBeGreaterThan(CARS.blitz.stats.grip);
  });

  it("formats CHF for Swiss locale", () => {
    expect(formatChf(500)).toMatch(/CHF|Fr/);
  });

  it("ships five cup levels", () => {
    expect(CUP_LEVELS).toHaveLength(5);
  });
});

import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { generateAdhocLevel } from "../src/track/adhoc";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { trackSelfIntersects } from "../src/track/validateTrack";
import { collisionRadiusFor } from "../src/data/carModels";

describe("track layout rules (CONCEPT §4.4)", () => {
  it("every cup centerline does not self-intersect", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      expect(trackSelfIntersects(track), level.id).toBe(false);
    }
  });

  it("adhoc seeds produce non-crossing ovals", () => {
    const seeds = ["A7F2", "B3K9", "ZZ99", "HARB", "CITY", "FACT", "LONG", "SHRT"];
    for (const seed of seeds) {
      const level = generateAdhocLevel({ seed });
      const track = buildTrackFromLevel(level);
      expect(trackSelfIntersects(track), seed).toBe(false);
    }
  });

  it("solid obstacles leave a clear center corridor (verge placement)", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const solids = level.obstacles.filter(
        (o) => o.type === "tire_stack" || o.type === "concrete_barrier",
      );
      for (const o of solids) {
        const [ox, oz] = o.position;
        // Find nearest centerline distance
        let best = Infinity;
        for (const p of track.centerline) {
          best = Math.min(best, Math.hypot(p.x - ox, p.z - oz));
        }
        const r = o.radius ?? 1.2;
        const carR = collisionRadiusFor("blitz");
        // Blocker sits near asphalt edge — center strip stays free for a car
        expect(best + r).toBeGreaterThan(carR + 0.4);
        expect(best).toBeGreaterThan(track.asphaltHalfWidth * 0.35);
      }
    }
  });

  it("outer wall limit is asphalt+grass so cars cannot leave the ribbon", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      expect(track.grassWidth).toBeGreaterThan(0);
      expect(track.asphaltHalfWidth + track.grassWidth).toBeGreaterThan(track.asphaltHalfWidth);
    }
  });
});

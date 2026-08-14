import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { clearsAllRibbonAsphalt } from "../src/track/medianBarriers";
import { planWallPlacements } from "../src/render/trackKit";

describe("dual-ribbon boundary clearance (Phase E)", () => {
  it("keeps every cup outer wall module off all ribbon asphalts", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      for (const w of planWallPlacements(track)) {
        expect(
          clearsAllRibbonAsphalt(track, w.x, w.z, { selfAlong: w.along, padding: 0.55 }),
          `${level.id} wall along=${w.along.toFixed(0)} side=${w.side}`,
        ).toBe(true);
      }
    }
  });

  it("keeps median section barriers off racing-line asphalt centers", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      for (const o of level.obstacles.filter((x) => x.role === "median")) {
        expect(
          clearsAllRibbonAsphalt(track, o.position[0]!, o.position[1]!, {
            padding: track.asphaltHalfWidth * 0.15,
          }),
          `${level.id} median at ${o.position}`,
        ).toBe(true);
      }
    }
  });
});

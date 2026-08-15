import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { clearsAllRibbonAsphalt } from "../src/track/medianBarriers";
import { planWallPlacements } from "../src/render/trackKit";
import { tileAlongFor } from "../src/render/loadTrackGltf";

describe("dual-ribbon boundary clearance (Phase E)", () => {
  it("keeps every cup outer wall module off racing-line asphalt", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      for (const w of planWallPlacements(track)) {
        expect(
          clearsAllRibbonAsphalt(track, w.x, w.z, { selfAlong: w.along, padding: 0.2 }),
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

  it("seals Omegatal wall ribbons without along-track holes", () => {
    const level = CUP_LEVELS.find((l) => l.id.includes("buckelpiste"))!;
    const track = buildTrackFromLevel(level);
    const walls = planWallPlacements(track);
    const tire = tileAlongFor("tire-wall");
    const conc = tileAlongFor("concrete-wall");
    for (const side of [-1, 1] as const) {
      const seq = walls.filter((w) => w.side === side).sort((a, b) => a.along - b.along);
      expect(seq.length, `Omegatal side ${side}`).toBeGreaterThan(40);
      for (let i = 0; i < seq.length; i++) {
        const a = seq[i]!;
        const b = seq[(i + 1) % seq.length]!;
        let gap = b.along - a.along;
        if (gap < 0) gap += track.totalLength;
        const world = Math.hypot(a.x - b.x, a.z - b.z);
        const spacing = a.kind === "tire" ? tire : conc;
        // Start/finish seam: modules overlap in world space even when along wraps.
        if (world < spacing * 1.25) continue;
        expect(gap, `Omegatal side ${side} hole ${a.along.toFixed(0)}→${b.along.toFixed(0)}`).toBeLessThan(
          spacing * 1.55,
        );
      }
    }
  });
});

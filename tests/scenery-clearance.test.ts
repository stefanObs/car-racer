import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { planSceneryAnchors, sceneryOverlapsTrack } from "../src/render/themeScenery";

describe("theme scenery clearance", () => {
  it("keeps harbor props (incl. blue ship/containers) off the racing surface", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const anchors = planSceneryAnchors(track, level.theme);
      const onTrack = anchors.filter((a) => sceneryOverlapsTrack(track, a.x, a.z, a.radius));
      expect(onTrack, `${level.id} (${level.theme})`).toEqual([]);
    }
  });

  it("documents that world-axis offsets used to place props on asphalt", () => {
    // RCA lock: old code did `px + side * 7` / `pz + 3` in world space.
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const broken = { x: 0, z: 0, radius: 4 };
    // Center of typical cup track is near origin — overlaps.
    expect(sceneryOverlapsTrack(track, broken.x, broken.z, broken.radius)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import {
  buildPanoramaSurround,
  makeHorizonPanoramaTexture,
  makeInfieldPanoramaTexture,
  makeSkyDomeTexture,
} from "../src/render/panoramaSurround";
import { themeLook } from "../src/render/themeLook";

describe("sky dome + panorama surround", () => {
  it("builds sky and horizon textures for every known cup theme", () => {
    for (const level of CUP_LEVELS) {
      const look = themeLook(level.theme);
      const sky = makeSkyDomeTexture(look);
      const horizon = makeHorizonPanoramaTexture(level.theme, look);
      const infield = makeInfieldPanoramaTexture(level.theme, look);
      expect(sky).toBeTruthy();
      expect(horizon).toBeTruthy();
      expect(infield).toBeTruthy();
      sky.dispose();
      horizon.dispose();
      infield.dispose();
    }
  });

  it("attaches a horizon panorama ring for every cup", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const look = themeLook(level.theme);
      const g = buildPanoramaSurround(track, level.theme, look);
      const names = new Set<string>();
      g.traverse((o) => {
        if (o.name) names.add(o.name);
      });
      expect(names.has("horizonPanorama"), level.id).toBe(true);
      // Harbor uses modelled basin instead of infield disc; other themes get a disc when infield is large enough.
      if (level.theme === "harbor") {
        expect(names.has("infieldPanorama")).toBe(false);
      }
    }
  });

  it("keeps Hafenstart display name and harbor theme unchanged", () => {
    const h = CUP_LEVELS[0]!;
    expect(h.displayName).toBe("Hafenstart");
    expect(h.theme).toBe("harbor");
    expect(h.id).toBe("blitz_cup_01_hafenstart");
  });

  it("renames cups 2–5 to proposal names", () => {
    expect(CUP_LEVELS.map((l) => l.displayName)).toEqual([
      "Hafenstart",
      "Parabolbogen",
      "Schikanenring",
      "Omegatal",
      "Kuppenfinale",
    ]);
  });
});

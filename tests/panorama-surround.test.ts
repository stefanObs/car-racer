import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import {
  buildPanoramaSurround,
  makeHarborEquirectTexture,
  makeHorizonPanoramaTexture,
  makeInfieldPanoramaTexture,
  makeSkyDomeTexture,
} from "../src/render/panoramaSurround";
import { buildThemeScenery, planSceneryAnchors } from "../src/render/themeScenery";
import { themeLook } from "../src/render/themeLook";

describe("sky dome + panorama surround", () => {
  it("builds an equirect harbor environment texture", () => {
    const tex = makeHarborEquirectTexture(themeLook("harbor"));
    expect(tex).toBeTruthy();
    tex.dispose();
  });

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
      if (level.theme === "harbor") {
        // Harbor skyline lives on the equirect sky dome; surround is water apron + infield disc.
        expect(names.has("infieldPanorama"), level.id).toBe(true);
        expect(names.has("harborWaterApron"), level.id).toBe(true);
      } else {
        expect(names.has("horizonPanorama"), level.id).toBe(true);
      }
    }
  });

  it("keeps Hafenstart display name and harbor theme unchanged", () => {
    const h = CUP_LEVELS[0]!;
    expect(h.displayName).toBe("Hafenstart");
    expect(h.theme).toBe("harbor");
    expect(h.id).toBe("blitz_cup_01_hafenstart");
  });

  it("drops harbour box props in favour of panorama + sparse Tripo", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const kinds = new Set(planSceneryAnchors(track, "harbor").map((a) => a.kind));
    for (const banned of ["ship", "quay", "bollard", "water"]) {
      expect(kinds.has(banned)).toBe(false);
    }
    for (const keep of ["crane", "container", "warehouse", "tank"]) {
      expect(kinds.has(keep)).toBe(true);
    }
    const scenery = buildThemeScenery(track, "harbor");
    let basin = false;
    scenery.traverse((o) => {
      if (o.userData?.sceneryKind === "basin") basin = true;
    });
    expect(basin).toBe(false);
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

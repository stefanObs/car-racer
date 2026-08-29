import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import {
  applyHorizonHeight,
  buildPanoramaSurround,
  GROUND_PLANE_Y,
  HARBOR_HORIZON_PIER_V,
  HARBOR_SKYLINE_CROP,
  HARBOR_SKYLINE_URL,
  harborEquirectPlateBand,
  horizonRingLayout,
  makeHarborEquirectTexture,
  makeHorizonPanoramaTexture,
  makeInfieldPanoramaTexture,
  makeSkyDomeTexture,
  PANORAMA_URLS,
  type PanoramaKind,
} from "../src/render/panoramaSurround";
import { buildThemeScenery, planSceneryAnchors } from "../src/render/themeScenery";
import { themeLook } from "../src/render/themeLook";

describe("sky dome + panorama surround", () => {
  it("ships Asphalt-Comic panorama plates for every theme", () => {
    for (const kind of Object.keys(PANORAMA_URLS) as PanoramaKind[]) {
      for (const plate of ["horizon", "infield"] as const) {
        const url = PANORAMA_URLS[kind][plate];
        const path = resolve(`public${url}`);
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size, path).toBeGreaterThan(80_000);
        const buf = readFileSync(path);
        expect(buf.subarray(0, 8).toString("binary")).toBe("\x89PNG\r\n\x1a\n");
      }
    }
  });

  it("builds an equirect harbor environment texture", () => {
    const tex = makeHarborEquirectTexture(themeLook("harbor"));
    expect(tex).toBeTruthy();
    tex.dispose();
  });

  it("stamps the harbor pier on the equirect horizon, not under the floor", () => {
    const { pierCanvasV, bandH } = harborEquirectPlateBand(1024);
    expect(bandH).toBeGreaterThan(400);
    // Equirect v=0.5 is the world horizon; v>0.5 is the ground hemisphere (hidden by the floor).
    expect(pierCanvasV).toBeLessThanOrEqual(0.51);
    expect(pierCanvasV).toBeGreaterThan(0.45);
  });

  it("crops the harbor cylinder plate to the pier/crane band, dropping empty sky", () => {
    expect(HARBOR_SKYLINE_CROP.top).toBeGreaterThan(0.55);
    expect(HARBOR_SKYLINE_CROP.top).toBeLessThan(HARBOR_HORIZON_PIER_V);
    expect(HARBOR_SKYLINE_CROP.bottom).toBeGreaterThan(HARBOR_HORIZON_PIER_V);
    expect(HARBOR_SKYLINE_CROP.bottom - HARBOR_SKYLINE_CROP.top).toBeLessThan(0.4);
    const path = resolve(`public${HARBOR_SKYLINE_URL}`);
    expect(existsSync(path), path).toBe(true);
    expect(statSync(path).size, path).toBeGreaterThan(80_000);
  });

  it("builds sky and horizon textures for every known cup theme", () => {
    for (const level of CUP_LEVELS) {
      const look = themeLook(level.theme);
      const sky = makeSkyDomeTexture(look, level.theme);
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
      if (level.theme === "harbor") {
        expect(names.has("infieldPanorama"), level.id).toBe(true);
        expect(names.has("harborWaterApron"), level.id).toBe(true);
      }
    }
  });

  it("applyHorizonHeight offsets and stretches the horizon ring from home pose", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const g = buildPanoramaSurround(track, "harbor", themeLook("harbor"));
    const ring = g.getObjectByName("horizonPanorama");
    expect(ring).toBeTruthy();
    const homeY = ring!.position.y;
    const homeScale = ring!.scale.y;
    applyHorizonHeight(g, 4, 1.25);
    expect(ring!.position.y).toBeCloseTo(homeY + 4, 5);
    expect(ring!.scale.y).toBeCloseTo(homeScale * 1.25, 5);
    applyHorizonHeight(g, 0, 1);
    expect(ring!.position.y).toBeCloseTo(homeY, 5);
    expect(ring!.scale.y).toBeCloseTo(homeScale, 5);
  });

  it("keeps harbor panorama decks and the skyline ring above the ground plane", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const g = buildPanoramaSurround(track, "harbor", themeLook("harbor"));
    const ring = g.getObjectByName("horizonPanorama");
    const apron = g.getObjectByName("harborWaterApron");
    const disc = g.getObjectByName("infieldPanorama");
    expect(ring).toBeTruthy();
    expect(apron).toBeTruthy();
    expect(disc).toBeTruthy();
    const { ringH, centerY } = horizonRingLayout("harbor");
    expect(centerY).toBe(ring!.position.y);
    expect(centerY + ringH / 2).toBeGreaterThan(20);
    expect(apron!.position.y).toBeGreaterThan(GROUND_PLANE_Y);
    expect(disc!.position.y).toBeGreaterThan(GROUND_PLANE_Y);
    expect(disc!.position.y).toBeLessThan(0);
  });

  it("keeps Hafenstart display name and harbor theme unchanged", () => {
    const h = CUP_LEVELS[0]!;
    expect(h.displayName).toBe("Hafenstart");
    expect(h.theme).toBe("harbor");
    expect(h.id).toBe("blitz_cup_01_hafenstart");
    expect(h.panorama).toEqual({ offsetY: 16, heightScale: 1.5 });
  });

  it("applies baked panorama offset at race load", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const g = buildPanoramaSurround(track, "harbor", themeLook("harbor"));
    const ring = g.getObjectByName("horizonPanorama")!;
    const homeY = ring.position.y;
    applyHorizonHeight(g, 16, 1.5);
    expect(ring.position.y).toBeCloseTo(homeY + 16, 5);
    expect(ring.scale.y).toBeCloseTo(1.5, 5);
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

  it("lists proposal cup names including Brückenkreuz", () => {
    expect(CUP_LEVELS.map((l) => l.displayName)).toEqual([
      "Hafenstart",
      "Parabolbogen",
      "Schikanenring",
      "Omegatal",
      "Kuppenfinale",
      "Brückenkreuz",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { CUP_LEVELS, layoutFingerprint } from "../src/data/levels";
import { knownThemes, themeLook } from "../src/render/themeLook";
import { planSceneryAnchors } from "../src/render/themeScenery";
import { buildTrackFromLevel } from "../src/track/buildTrack";

describe("cup track variance", () => {
  it("gives each cup a unique segment layout fingerprint", () => {
    const prints = CUP_LEVELS.map((l) => layoutFingerprint(l));
    expect(new Set(prints).size).toBe(CUP_LEVELS.length);
  });

  it("gives each cup a distinct normalized centerline silhouette", () => {
    const sigs = CUP_LEVELS.map((l) => {
      const track = buildTrackFromLevel(l);
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of track.centerline) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      const w = Math.max(1e-6, maxX - minX);
      const h = Math.max(1e-6, maxZ - minZ);
      const step = Math.max(1, Math.floor(track.centerline.length / 24));
      return track.centerline
        .filter((_, i) => i % step === 0)
        .map((p) => `${((p.x - minX) / w).toFixed(2)},${((p.z - minZ) / h).toFixed(2)}`)
        .join(";");
    });
    expect(new Set(sigs).size).toBe(CUP_LEVELS.length);
  });

  it("maps each cup to a distinct theme with matching scenery kinds", () => {
    const themes = CUP_LEVELS.map((l) => l.theme);
    expect(new Set(themes).size).toBe(CUP_LEVELS.length);

    const expectedKinds: Record<string, string[]> = {
      harbor: ["crane", "container", "warehouse", "tank"],
      beach: ["palm", "water", "scrub", "hut", "grandstand"],
      city: ["building", "tower", "scrub"],
      factory: ["warehouse", "tree", "scrub", "spire"],
      canyon: ["cliff", "spire", "scrub"],
      overpass: ["crane", "container", "warehouse", "tank"],
    };

    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const kinds = new Set(planSceneryAnchors(track, level.theme).map((a) => a.kind));
      for (const k of expectedKinds[level.theme]!) {
        expect(kinds.has(k), `${level.id} missing scenery kind ${k}`).toBe(true);
      }
    }
  });

  it("tints sky/ground differently per theme", () => {
    const looks = knownThemes().map((t) => themeLook(t));
    const skies = new Set(looks.map((l) => l.sky));
    const grounds = new Set(looks.map((l) => l.ground));
    expect(skies.size).toBe(knownThemes().length);
    expect(grounds.size).toBe(knownThemes().length);
  });

  it("keeps harbor ground pier-gray (not grass-green infield wall)", () => {
    const g = themeLook("harbor").ground;
    const r = (g >> 16) & 0xff;
    const green = (g >> 8) & 0xff;
    const b = g & 0xff;
    // Pier concrete: green channel must not dominate (old 0x4a5c52 read as a green wall).
    expect(green).toBeLessThanOrEqual(r + 8);
    expect(green).toBeLessThanOrEqual(b + 12);
    expect(r).toBeGreaterThan(90);
  });
});

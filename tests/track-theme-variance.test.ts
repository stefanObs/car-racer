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

  it("maps each cup to a distinct theme with matching scenery kinds", () => {
    const themes = CUP_LEVELS.map((l) => l.theme);
    expect(new Set(themes).size).toBe(CUP_LEVELS.length);

    const expectedKinds: Record<string, string[]> = {
      harbor: ["crane", "container", "water", "ship"],
      beach: ["palm", "water", "dune", "hut"],
      city: ["building", "tower", "lamp"],
      factory: ["warehouse", "stack", "pipe"],
      canyon: ["cliff", "spire", "scrub"],
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
});

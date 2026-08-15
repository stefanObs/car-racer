import { describe, expect, it } from "vitest";
import { bannedTarget, collectViolations, eachImport, layerOfRel } from "../scripts/check-architecture.mjs";

describe("architecture guard", () => {
  it("classifies src folders as layers", () => {
    expect(layerOfRel("ui/miniMap.ts")).toBe("ui");
    expect(layerOfRel("main.ts")).toBe("main");
    expect(layerOfRel("app/GameApp.ts")).toBe("app");
  });

  it("bans ui→render and sim→GameAudio; allows sim type-only raceEvents", () => {
    expect(bannedTarget("ui", "render", "../render/palette", false)).toMatch(/must not import render/);
    expect(bannedTarget("meta", "render", "../render/RaceRenderer", false)).toMatch(/must not import render/);
    expect(bannedTarget("sim", "audio", "../audio/GameAudio", false)).toMatch(/raceEvents/);
    expect(bannedTarget("sim", "audio", "../audio/raceEvents", true)).toBeNull();
    expect(bannedTarget("data", "track", "../track/types", false)).toBeNull();
    expect(bannedTarget("app", "render", "../render/createGameRenderer", false)).toBeNull();
  });

  it("treats import type as type-only", () => {
    const hits = [];
    eachImport('import type { X } from "../audio/raceEvents";\nimport { play } from "../audio/GameAudio";', (spec, typeOnly) => {
      hits.push({ spec, typeOnly });
    });
    expect(hits).toEqual([
      { spec: "../audio/raceEvents", typeOnly: true },
      { spec: "../audio/GameAudio", typeOnly: false },
    ]);
  });

  it("reports zero violations on current src/", () => {
    expect(collectViolations()).toEqual([]);
  });
});

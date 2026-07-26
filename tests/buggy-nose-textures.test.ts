import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasBuggyNoseTexture } from "../src/render/buggyNoseTextures";
import { atlasRoleFromName } from "../src/render/comicCarAtlases";

describe("buggy nose textures", () => {
  it("has no maps before preload (unit env)", () => {
    expect(hasBuggyNoseTexture("skull")).toBe(false);
    expect(hasBuggyNoseTexture("skullHorn")).toBe(false);
  });

  it("does not route Skull / SkullHorn through the dark trim atlas", () => {
    expect(atlasRoleFromName("Skull", "kaeferkraft")).toBe("body");
    expect(atlasRoleFromName("SkullHorn", "kaeferkraft")).toBe("body");
  });

  it("ships a baked double-horn sheet for YZ skull-horn UVs", () => {
    const path = resolve("public/textures/buggy-skull-horn.png");
    expect(existsSync(path)).toBe(true);
    const buf = readFileSync(path);
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(existsSync(resolve("scripts/bake-buggy-skull-horn.mjs"))).toBe(true);
    expect(existsSync(resolve("scripts/reshape-buggy-skull-horns.mjs"))).toBe(true);
  });
});

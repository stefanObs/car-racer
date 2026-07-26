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

  it("ships the comic single-horn sheet used by reshaped SkullHorn meshes", () => {
    const path = resolve("public/textures/buggy-skull-horn.png");
    expect(existsSync(path)).toBe(true);
    const buf = readFileSync(path);
    // Prior comic horn (v0.2.82) is ~247KB; V-bake was ~77KB — keep the larger sheet.
    expect(buf.length).toBeGreaterThan(100_000);
    expect(buf[0]).toBe(0x89);
    expect(existsSync(resolve("scripts/reshape-buggy-skull-horns.mjs"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { hasBuggyNoseTexture } from "../src/render/buggyNoseTextures";
import { atlasRoleFromName } from "../src/render/comicCarAtlases";

describe("buggy nose textures", () => {
  it("has no maps before preload (unit env)", () => {
    expect(hasBuggyNoseTexture("skull")).toBe(false);
    expect(hasBuggyNoseTexture("skullHorn")).toBe(false);
  });

  it("does not route Skull / SkullHorn through the dark trim atlas", () => {
    // Procedural bone/keratin atlases via buggyNoseTextures (mesh-fitted UVs).
    expect(atlasRoleFromName("Skull", "kaeferkraft")).toBe("body");
    expect(atlasRoleFromName("SkullHorn", "kaeferkraft")).toBe("body");
  });
});

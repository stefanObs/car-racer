import { describe, expect, it } from "vitest";
import { hasBuggyNoseTexture } from "../src/render/buggyNoseTextures";
import { atlasRoleFromName } from "../src/render/comicCarAtlases";

describe("buggy nose textures", () => {
  it("has no maps before preload (unit env)", () => {
    expect(hasBuggyNoseTexture("skull")).toBe(false);
    expect(hasBuggyNoseTexture("dogStatue")).toBe(false);
  });

  it("does not route Skull materials through the dark trim atlas", () => {
    // Skull uses public/textures/buggy-skull.png via buggyNoseTextures.
    expect(atlasRoleFromName("Skull", "kaeferkraft")).toBe("body");
  });
});

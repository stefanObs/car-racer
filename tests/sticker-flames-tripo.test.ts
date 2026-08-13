import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";

describe("Tripo Flammen sticker plaque", () => {
  const glb = "public/models/stickers/flames.glb";
  const concept = "assets/tripo-concepts/sticker-flames-tripo-concept.png";

  it("ships baked GLB + concept + bake script", () => {
    expect(existsSync(glb)).toBe(true);
    expect(existsSync(concept)).toBe(true);
    expect(existsSync("scripts/bake-sticker-flames-tripo.mjs")).toBe(true);
    expect(statSync(glb).size).toBeGreaterThan(50_000);
  });

  it("keeps FlameSticker material and door-plate proportions", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(glb);
    const mats = doc.getRoot().listMaterials().map((m) => m.getName());
    expect(mats.some((n) => n === "FlameSticker")).toBe(true);
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    expect(size[0]).toBeGreaterThan(0.9);
    expect(size[0]).toBeLessThan(1.5);
    expect(size[1]).toBeGreaterThan(0.3);
    expect(size[1]).toBeLessThan(0.7);
    expect(size[2]).toBeLessThan(0.15);
    const bake = readFileSync("scripts/bake-sticker-flames-tripo.mjs", "utf8");
    expect(bake).toContain("orientAsDoorPlate");
    expect(bake).toContain("FlameSticker");
  });
});

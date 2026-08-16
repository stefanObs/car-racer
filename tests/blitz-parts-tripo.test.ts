import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { BLITZ_PART_MESH_IDS, BLITZ_PART_PLACEMENT } from "../src/render/carParts";

const MATERIALS: Partial<Record<(typeof BLITZ_PART_MESH_IDS)[number], string>> = {
  rear_spoiler: "Spoiler",
  big_engine: "Carbon",
  nitro_kit: "NitroKit",
  spike_bumper: "Spike",
  offroad_suspension: "Spring",
  reinforced_frame: "Grey",
};

/** Blitz no longer ships Leichtbau hood vents — other classes still load that id. */
const BLITZ_SHIPPED_PART_IDS = BLITZ_PART_MESH_IDS.filter((id) => id !== "lightweight_body");

describe("Blitz Tripo part add-on bakes", () => {
  it.each([...BLITZ_SHIPPED_PART_IDS])("ships a small %s GLB with authored material", async (id) => {
    const path = resolve("public/models/parts", `blitz-${id}.glb`);
    expect(existsSync(path), path).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(8_000);
    expect(statSync(path).size).toBeLessThan(2_000_000);
    const text = readFileSync(path).toString("latin1");
    expect(text).toContain(MATERIALS[id]!);

    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    expect(Math.max(sx, sy, sz)).toBeLessThan(2.2);
    expect(sy).toBeGreaterThan(id === "reinforced_frame" ? 0.08 : 0.04);
    expect(sy).toBeLessThan(id === "reinforced_frame" ? 0.4 : 1.1);
    expect(BLITZ_PART_PLACEMENT[id].length).toBeGreaterThan(0);
  });

  it("does not ship Blitz Leichtbau hood-vent GLB", () => {
    expect(existsSync(resolve("public/models/parts/blitz-lightweight_body.glb"))).toBe(false);
    expect(BLITZ_PART_PLACEMENT.lightweight_body).toHaveLength(0);
  });
  it("ships Großer Motor with comic red + black two-tone albedo", async () => {
    const sharp = (await import("sharp")).default;
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(resolve("public/models/parts/blitz-big_engine.glb"));
    const mat = doc.getRoot().listMaterials()[0]!;
    expect(mat.getName()).toBe("Carbon");
    const tex = mat.getBaseColorTexture();
    expect(tex).toBeTruthy();
    const img = tex!.getImage();
    expect(img?.byteLength).toBeGreaterThan(10_000);
    const { data } = await sharp(Buffer.from(img!))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let red = 0;
    let black = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      n++;
      if (r > 160 && r > g * 1.5 && r > b * 1.5) red++;
      if (r < 55 && g < 55 && b < 55) black++;
    }
    expect(red / n).toBeGreaterThan(0.08);
    expect(black / n).toBeGreaterThan(0.35);
  });

  it("recolors Großer Motor red texels to garage paint and keeps carbon black", async () => {
    const { isComicRedAccentPixel, recolorComicRedAccentPixels } = await import(
      "../src/render/paintAuthoredWhite"
    );
    const sharp = (await import("sharp")).default;
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(resolve("public/models/parts/blitz-big_engine.glb"));
    const img = doc.getRoot().listMaterials()[0]!.getBaseColorTexture()!.getImage()!;
    const { data } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const copy = Uint8ClampedArray.from(data);
    const n = recolorComicRedAccentPixels(copy, 0.07, 0.72, 0.53);
    expect(n).toBeGreaterThan(200);
    let redLeft = 0;
    let redTotal = 0;
    let carbonSame = 0;
    let carbonTotal = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r0 = data[i]!;
      const g0 = data[i + 1]!;
      const b0 = data[i + 2]!;
      if (isComicRedAccentPixel(r0, g0, b0)) {
        redTotal++;
        if (isComicRedAccentPixel(copy[i]!, copy[i + 1]!, copy[i + 2]!)) redLeft++;
      }
      if (r0 < 55 && g0 < 55 && b0 < 55 && !isComicRedAccentPixel(r0, g0, b0)) {
        carbonTotal++;
        if (copy[i] === r0 && copy[i + 1] === g0 && copy[i + 2] === b0) carbonSame++;
      }
    }
    expect(redTotal).toBeGreaterThan(50);
    expect(redLeft).toBe(0);
    expect(carbonSame / carbonTotal).toBeGreaterThan(0.98);
  });
});

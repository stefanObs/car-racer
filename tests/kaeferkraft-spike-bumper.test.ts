import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

describe("Käferkraft spike bumper albedo", () => {
  it("paints spike cones charcoal like the pole frame, not light grey", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read("public/models/parts/kaeferkraft-spike_bumper.glb");
    const tex = doc.getRoot().listTextures()[0];
    expect(tex).toBeTruthy();
    const img = tex!.getImage();
    expect(img).toBeTruthy();
    const { data } = await sharp(Buffer.from(img!)).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    let lightGrey = 0;
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 8) continue;
      opaque += 1;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum >= 140 && chroma < 50) lightGrey += 1;
    }
    expect(opaque).toBeGreaterThan(1000);
    expect(lightGrey / opaque).toBeLessThan(0.02);
  });
});

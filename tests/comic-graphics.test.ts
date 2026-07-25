import { describe, expect, it } from "vitest";
import { comicToon, outlineMaterial, toonGradient, withOutline } from "../src/render/comicMaterials";
import { ComicPalette, ComicPaletteCss } from "../src/render/palette";
import { BoxGeometry } from "three";

describe("Asphalt-Comic palette", () => {
  it("matches style-bible track zone colors", () => {
    expect(ComicPalette.asphalt).toBe(0x4a4f57);
    expect(ComicPalette.grass).toBe(0x3f8f3a);
    expect(ComicPalette.tire).toBe(0x1a1a1a);
    expect(ComicPalette.tireAccent).toBe(0xe85d04);
    expect(ComicPalette.concrete).toBe(0x8b9098);
    expect(ComicPalette.outline).toBe(0x1b1b1f);
    expect(ComicPaletteCss.asphalt).toBe("#4A4F57");
    expect(ComicPaletteCss.sky).toBe("#5BA3D9");
  });

  it("builds toon materials with stepped gradient and outline shell", () => {
    const grad = toonGradient();
    expect(grad.image.width).toBe(4);
    const mat = comicToon(ComicPalette.asphalt);
    expect(mat.gradientMap).toBe(grad);
    const mesh = withOutline(new BoxGeometry(1, 1, 1), mat);
    expect(mesh.children).toHaveLength(1);
    expect(outlineMaterial().side).toBe(1); // BackSide
  });
});

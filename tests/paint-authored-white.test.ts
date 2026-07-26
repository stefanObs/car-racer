import { describe, expect, it } from "vitest";
import {
  isNearWhitePaintPixel,
  recolorNearWhitePixels,
} from "../src/render/paintAuthoredWhite";

describe("bunker authored white → garage paint", () => {
  it("treats bright low-chroma pixels as body white", () => {
    expect(isNearWhitePaintPixel(245, 245, 248)).toBe(true);
    expect(isNearWhitePaintPixel(230, 230, 230)).toBe(true);
    // Yellow accent on Hummer atlas
    expect(isNearWhitePaintPixel(240, 200, 40)).toBe(false);
    // Black / dark trim
    expect(isNearWhitePaintPixel(30, 30, 32)).toBe(false);
    // Mid grey panel (not white body)
    expect(isNearWhitePaintPixel(120, 120, 125)).toBe(false);
  });

  it("recolors white pixels toward chosen paint and leaves yellow alone", () => {
    const data = new Uint8ClampedArray([
      240, 240, 242, 255, // white
      235, 190, 35, 255, // yellow
      20, 20, 22, 255, // black
    ]);
    const n = recolorNearWhitePixels(data, 0.88, 0.19, 0.19); // #e03131-ish
    expect(n).toBe(1);
    expect(data[0]!).toBeGreaterThan(150);
    expect(data[1]!).toBeLessThan(100);
    expect(data[2]!).toBeLessThan(100);
    // yellow unchanged
    expect(data[4]).toBe(235);
    expect(data[5]).toBe(190);
    expect(data[6]).toBe(35);
    // black unchanged
    expect(data[8]).toBe(20);
  });
});

import { describe, expect, it } from "vitest";
import {
  isNearWhitePaintPixel,
  isOrangeBodyPixel,
  isRedBodyPixel,
  paintSrgb01,
  recolorNearWhitePixels,
  recolorOrangeBodyPixels,
  recolorRedBodyPixels,
} from "../src/render/paintAuthoredWhite";
import { CAR_PAINT_BLACK } from "../src/render/palette";

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

describe("Käferkraft orange body → garage paint", () => {
  it("treats bright and shaded orange as body, not black cage or grey", () => {
    expect(isOrangeBodyPixel(220, 110, 40)).toBe(true);
    expect(isOrangeBodyPixel(80, 41, 12)).toBe(true);
    expect(isOrangeBodyPixel(55, 37, 25)).toBe(true);
    expect(isOrangeBodyPixel(20, 20, 22)).toBe(false);
    expect(isOrangeBodyPixel(90, 90, 95)).toBe(false);
  });

  it("recolors shaded orange into a darker paint, not leftover rust", () => {
    const data = new Uint8ClampedArray([
      210, 95, 35, 255,
      80, 41, 12, 255,
      18, 18, 20, 255,
    ]);
    const n = recolorOrangeBodyPixels(data, 0.2, 0.4, 0.85); // blue
    expect(n).toBe(2);
    expect(data[2]!).toBeGreaterThan(data[0]!);
    expect(data[6]!).toBeGreaterThan(data[4]!);
    expect(data[6]!).toBeLessThan(data[2]!);
    expect(data[4]).not.toBe(80);
    expect(data[8]).toBe(18);
  });
});

describe("Blitz red body → garage paint", () => {
  it("treats bright and shaded red as body, not black trim or orange", () => {
    expect(isRedBodyPixel(224, 49, 49)).toBe(true);
    expect(isRedBodyPixel(90, 20, 20)).toBe(true);
    expect(isRedBodyPixel(42, 24, 20)).toBe(true);
    expect(isRedBodyPixel(19, 7, 7)).toBe(true);
    expect(isRedBodyPixel(220, 110, 40)).toBe(false);
    expect(isRedBodyPixel(20, 20, 22)).toBe(false);
  });

  it("recolors shaded red into a darker paint, not leftover dark red", () => {
    const data = new Uint8ClampedArray([
      210, 48, 48, 255,
      80, 18, 18, 255,
      19, 7, 7, 255,
      20, 20, 22, 255,
    ]);
    const n = recolorRedBodyPixels(data, 0.07, 0.72, 0.53); // teal
    expect(n).toBe(3);
    expect(data[1]!).toBeGreaterThan(data[0]!);
    expect(data[5]!).toBeGreaterThan(data[4]!);
    expect(data[5]!).toBeLessThan(data[1]!);
    expect(data[4]).not.toBe(80);
    expect(data[9]!).toBeGreaterThan(data[8]!);
    expect(data[12]).toBe(20);
  });

  it("keeps charcoal black paint bright enough for cel shading", () => {
    const paint = paintSrgb01(CAR_PAINT_BLACK);
    expect(paint.r * 255).toBeGreaterThanOrEqual(70);
    const data = new Uint8ClampedArray([
      210, 48, 48, 255,
      80, 18, 18, 255,
    ]);
    expect(recolorRedBodyPixels(data, paint.r, paint.g, paint.b)).toBe(2);
    expect(data[0]!).toBeGreaterThan(40);
    expect(data[0]!).toBeGreaterThan(data[4]! + 8);
  });
});


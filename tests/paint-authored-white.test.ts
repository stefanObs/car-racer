import { describe, expect, it } from "vitest";
import {
  buildWheelTexelMask,
  isBlueBodyPixel,
  isHotRodFlamePixel,
  isGreenBodyPixel,
  isNearWhitePaintPixel,
  isOrangeBodyPixel,
  isRedBodyPixel,
  isTireOrRimPixel,
  isWheelPaintVertex,
  paintSrgb01,
  recolorBlueBodyPixels,
  recolorDonnerBodyPixels,
  recolorGreenBodyPixels,
  recolorNearWhitePixels,
  recolorOrangeBodyPixels,
  recolorRedBodyPixels,
} from "../src/render/paintAuthoredWhite";
import { CAR_PAINT_BLACK } from "../src/render/palette";

describe("bunker authored white → garage paint", () => {
  it("treats pale armor including cel shadows as body, not stripe or trim", () => {
    expect(isNearWhitePaintPixel(245, 245, 248)).toBe(true);
    expect(isNearWhitePaintPixel(230, 230, 230)).toBe(true);
    expect(isNearWhitePaintPixel(140, 142, 148)).toBe(true);
    expect(isNearWhitePaintPixel(81, 80, 78)).toBe(true);
    // Yellow / tan hazard stripe
    expect(isNearWhitePaintPixel(240, 200, 40)).toBe(false);
    expect(isNearWhitePaintPixel(188, 165, 123)).toBe(false);
    // Charcoal tires / grille
    expect(isNearWhitePaintPixel(30, 30, 32)).toBe(false);
    expect(isNearWhitePaintPixel(58, 58, 58)).toBe(false);
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

  it("recolors pale armor shadows toward garage paint", () => {
    const data = new Uint8ClampedArray([
      140, 142, 148, 255,
      188, 165, 123, 255,
    ]);
    const n = recolorNearWhitePixels(data, 0.53, 0.56, 0.59);
    expect(n).toBe(1);
    expect(data[0]).not.toBe(140);
    expect(data[4]).toBe(188);
    expect(data[5]).toBe(165);
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

describe("Bison green body → garage paint", () => {
  it("treats default pickup green and shaded green as body", () => {
    expect(isGreenBodyPixel(47, 158, 68)).toBe(true); // #2f9e44
    expect(isGreenBodyPixel(90, 180, 70)).toBe(true);
    expect(isGreenBodyPixel(28, 72, 32)).toBe(true);
    expect(isGreenBodyPixel(20, 20, 22)).toBe(false);
    expect(isGreenBodyPixel(235, 190, 35)).toBe(false); // yellow chrome/trim
    expect(isGreenBodyPixel(180, 180, 190)).toBe(false); // grey chrome
  });

  it("recolors green panels and leaves tires/trim", () => {
    const data = new Uint8ClampedArray([
      47, 158, 68, 255,
      28, 72, 32, 255,
      20, 20, 22, 255,
      235, 190, 35, 255,
    ]);
    const n = recolorGreenBodyPixels(data, 0.89, 0.19, 0.19); // red
    expect(n).toBe(2);
    expect(data[0]!).toBeGreaterThan(data[1]!);
    expect(data[4]!).toBeGreaterThan(data[5]!);
    expect(data[4]!).toBeLessThan(data[0]!);
    expect(data[8]).toBe(20);
    expect(data[12]).toBe(235);
  });
});

describe("Donnerbüchse blue body → garage paint", () => {
  it("treats default hot-rod blue as body, not chrome or flames", () => {
    expect(isBlueBodyPixel(51, 154, 240)).toBe(true); // #339af0
    expect(isBlueBodyPixel(40, 90, 180)).toBe(true);
    expect(isBlueBodyPixel(20, 20, 22)).toBe(false);
    expect(isBlueBodyPixel(220, 110, 40)).toBe(false); // orange flames are not blue
    expect(isHotRodFlamePixel(220, 110, 40)).toBe(true);
    expect(isBlueBodyPixel(180, 180, 190)).toBe(false); // chrome
    expect(isBlueBodyPixel(96, 120, 134)).toBe(false); // blue-grey rim
  });

  it("recolors blue panels and leftover flames; chrome stays", () => {
    const data = new Uint8ClampedArray([
      51, 154, 240, 255,
      40, 90, 180, 255,
      200, 200, 210, 255,
      220, 110, 40, 255,
    ]);
    const n = recolorDonnerBodyPixels(data, 0.07, 0.72, 0.53); // teal-green
    expect(n).toBe(3);
    expect(data[1]!).toBeGreaterThan(data[2]!);
    expect(data[5]!).toBeGreaterThan(data[6]!);
    expect(data[8]).toBe(200);
    expect(data[13]!).toBeGreaterThan(data[12]!); // flame → paint green channel
  });
});

describe("wheels stay off the garage paint path", () => {
  const tire = [30, 30, 32] as const;
  const greyRim = [110, 108, 106] as const;
  const blueGreyRim = [96, 120, 134] as const;
  const darkTireRedCast = [31, 23, 21] as const;

  it("does not treat dark tire or grey rim as chromatic body paint", () => {
    for (const px of [tire, greyRim, blueGreyRim, darkTireRedCast]) {
      expect(isRedBodyPixel(...px), `red ${px}`).toBe(false);
      expect(isOrangeBodyPixel(...px), `orange ${px}`).toBe(false);
      expect(isGreenBodyPixel(...px), `green ${px}`).toBe(false);
      expect(isBlueBodyPixel(...px), `blue ${px}`).toBe(false);
    }
    expect(isNearWhitePaintPixel(...tire)).toBe(false);
  });

  it("BodyPaint bake of red body+tire+rim leaves tire and rim bytes equal", () => {
    const data = new Uint8ClampedArray([
      210, 48, 48, 255,
      30, 30, 32, 255,
      110, 108, 106, 255,
      31, 23, 21, 255,
    ]);
    const before = Uint8ClampedArray.from(data);
    expect(recolorRedBodyPixels(data, 0.07, 0.72, 0.53)).toBe(1);
    expect(data[0]).not.toBe(210);
    expect(data.slice(4, 16)).toEqual(before.slice(4, 16));
  });

  it("BodyPaint bake of white armor+tire leaves tire bytes equal", () => {
    const data = new Uint8ClampedArray([
      240, 240, 242, 255,
      30, 30, 32, 255,
      20, 20, 22, 255,
    ]);
    recolorNearWhitePixels(data, 0.88, 0.19, 0.19);
    expect(data[4]).toBe(30);
    expect(data[8]).toBe(20);
    expect(data[0]).not.toBe(240);
  });

  it("classifies rubber and steel as tire/rim, not bright body paint", () => {
    expect(isTireOrRimPixel(30, 30, 32)).toBe(true);
    expect(isTireOrRimPixel(110, 108, 106)).toBe(true);
    expect(isTireOrRimPixel(96, 120, 134)).toBe(true);
    expect(isTireOrRimPixel(31, 23, 21)).toBe(true);
    expect(isTireOrRimPixel(224, 49, 49)).toBe(false);
    expect(isTireOrRimPixel(19, 7, 7)).toBe(false);
    expect(isTireOrRimPixel(245, 245, 248)).toBe(false);
  });

  it("wheel texel mask keeps grey hubcap while pale armor still paints", () => {
    const data = new Uint8ClampedArray([
      240, 240, 242, 255,
      140, 142, 148, 255,
      110, 108, 106, 255,
      81, 80, 78, 255,
    ]);
    const skip = new Uint8Array([0, 0, 1, 0]);
    expect(recolorNearWhitePixels(data, 0.07, 0.72, 0.53, skip)).toBe(3);
    expect(data[0]).not.toBe(240);
    expect(data[4]).not.toBe(140);
    expect(data[8]).toBe(110);
    expect(data[12]).not.toBe(81);
  });

  it("treats low outboard verts as wheels, not the roof", () => {
    const bounds = { minY: 0, height: 1.2, maxAbsX: 0.9 };
    expect(isWheelPaintVertex(0.8, 0.12, 1.1, bounds)).toBe(true);
    expect(isWheelPaintVertex(0, 0.9, 0, bounds)).toBe(false);
    expect(isWheelPaintVertex(0.2, 0.1, 0, bounds)).toBe(false);
  });

  it("fills wheel UV triangle interiors so hubcaps are masked", () => {
    const mask = buildWheelTexelMask(8, 8, [0.1, 0.1, 0.6, 0.1, 0.1, 0.6], 0);
    let marked = 0;
    for (const v of mask) if (v) marked++;
    expect(marked).toBeGreaterThan(4);
    expect(mask[1 * 8 + 1]).toBe(1);
  });
});


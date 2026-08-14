/**
 * Recolor authored albedo pixels to garage paint
 * (Bunker white, Käferkraft orange, Blitz red, Bison green, Donnerbüchse blue).
 * Keeps trim / lights / cage / wheel pixels that fail the body-pixel test.
 */
import {
  CanvasTexture,
  NearestFilter,
  SRGBColorSpace,
  type Texture,
} from "three";

const cache = new Map<string, Texture>();

export function clearAuthoredWhitePaintCache(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

/**
 * Charcoal rubber and weakly tinted steel (rims / hubcaps).
 * Used by chromatic body matchers only — bunker pale-armor greys stay paint targets.
 */
export function isTireOrRimPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lum = (r + g + b) / 3;
  if (max < 1) return true;
  if (max < 72 && chroma / max < 0.42) return true;
  if (lum >= 60 && lum <= 180 && chroma / max < 0.4 && chroma <= 50) return true;
  return false;
}

export type CarPaintBounds = {
  minY: number;
  height: number;
  maxAbsX: number;
};

export type BunkerTrimBounds = CarPaintBounds & {
  maxAbsZ: number;
};

/** Low, outboard verts — wheel disks on a grounded arcade silhouette. */
export function isWheelPaintVertex(x: number, y: number, _z: number, bounds: CarPaintBounds): boolean {
  if (bounds.height < 0.05 || bounds.maxAbsX < 0.05) return false;
  const yCut = bounds.minY + Math.min(0.58, Math.max(0.2, bounds.height * 0.32));
  return y < yCut && Math.abs(x) >= bounds.maxAbsX * 0.5;
}

/**
 * Bunker front/rear bumper beams + tow hooks — look sheet charcoal trim, not body paint.
 */
export function isBunkerBumperTriangle(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  _nx: number,
  _ny: number,
  _nz: number,
  bounds: BunkerTrimBounds,
): boolean {
  if (bounds.height < 0.05 || bounds.maxAbsZ < 0.05) return false;
  const y = (ay + by + cy) / 3;
  const z = (az + bz + cz) / 3;
  const yHi = bounds.minY + bounds.height * 0.3;
  if (y > yHi) return false;
  if (z > bounds.maxAbsZ * 0.7) return true;
  if (z < -bounds.maxAbsZ * 0.7) return true;
  return false;
}

/**
 * Bunker headlamp pockets + roof beacon — keep authored lens / housing colors.
 */
export function isBunkerLightTriangle(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  _nx: number,
  _ny: number,
  _nz: number,
  bounds: BunkerTrimBounds,
): boolean {
  if (bounds.height < 0.05 || bounds.maxAbsZ < 0.05 || bounds.maxAbsX < 0.05) return false;
  const x = (ax + bx + cx) / 3;
  const y = (ay + by + cy) / 3;
  const z = (az + bz + cz) / 3;
  // Roof spotlight
  if (y > bounds.minY + bounds.height * 0.82 && Math.abs(x) < bounds.maxAbsX * 0.4) return true;
  // Front headlamp housings / lenses (outboard nose)
  if (
    y > bounds.minY + bounds.height * 0.2 &&
    y < bounds.minY + bounds.height * 0.48 &&
    z > bounds.maxAbsZ * 0.72 &&
    Math.abs(x) > bounds.maxAbsX * 0.38
  ) {
    return true;
  }
  return false;
}

function fract01(t: number): number {
  return ((t % 1) + 1) % 1;
}

/** Mark texels covered by a UV triangle (image origin top-left in canvas bake). */
export function fillUvTriangleMask(
  mask: Uint8Array,
  width: number,
  height: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
): void {
  if (Math.abs(u1 - u0) > 0.5 || Math.abs(u2 - u0) > 0.5 || Math.abs(u2 - u1) > 0.5) return;
  if (Math.abs(v1 - v0) > 0.5 || Math.abs(v2 - v0) > 0.5 || Math.abs(v2 - v1) > 0.5) return;
  const x0 = fract01(u0) * (width - 1);
  const y0 = fract01(v0) * (height - 1);
  const x1 = fract01(u1) * (width - 1);
  const y1 = fract01(v1) * (height - 1);
  const x2 = fract01(u2) * (width - 1);
  const y2 = fract01(v2) * (height - 1);
  const stamp = (x: number, y: number) => {
    const px = Math.min(width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(height - 1, Math.max(0, Math.round(y)));
    mask[py * width + px] = 1;
  };
  stamp(x0, y0);
  stamp(x1, y1);
  stamp(x2, y2);
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 0.5) return;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / area;
      const w1 = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) mask[y * width + x] = 1;
    }
  }
}

function dilateTexelMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius < 1) return mask;
  const out = new Uint8Array(mask);
  const hits: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) hits.push(i);
  for (const i of hits) {
    const x = i % width;
    const y = (i / width) | 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1;
      }
    }
  }
  return out;
}

/** Rasterize wheel UV triangles and dilate so hubcap interiors stay off the paint bake. */
export function buildWheelTexelMask(
  width: number,
  height: number,
  uvTriangles: ArrayLike<number>,
  dilate = 2,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i + 5 < uvTriangles.length; i += 6) {
    fillUvTriangleMask(
      mask,
      width,
      height,
      uvTriangles[i]!,
      uvTriangles[i + 1]!,
      uvTriangles[i + 2]!,
      uvTriangles[i + 3]!,
      uvTriangles[i + 4]!,
      uvTriangles[i + 5]!,
    );
  }
  return dilateTexelMask(mask, width, height, dilate);
}

/**
 * Tripo Bunker armor — pale / off-white at any luminance, including comic shadows.
 * Skips charcoal tires/grille, yellow-tan hazard stripe, and warm headlights.
 * Grey hubcaps that match this test are skipped via wheel UV mask, not color.
 */
export function isNearWhitePaintPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < 72) return false;
  if (r > 140 && g > b + 30 && r > g - 20) return false;
  if (max >= 220 && r > b + 16 && g > b + 8) return false;
  if (chroma > 48 && chroma / max > 0.18) return false;
  return true;
}

/**
 * Tripo Käferkraft body — orange/rust at any luminance, including comic shadows.
 * Skips black cage/tires, grey, and yellow coils.
 */
export function isOrangeBodyPixel(r: number, g: number, b: number): boolean {
  if (isTireOrRimPixel(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < 16 || r < max) return false;
  if (chroma / max < 0.22) return false;
  if (g >= r * 0.78 && g > b + 40) return false;
  if (b >= r * 0.38 && b > g + 20) return false;
  if (r < g + 6 || r < b + 8) return false;
  return true;
}

/**
 * Tripo Blitz body — any luminance of chromatic red, including comic shadows.
 * Skips black trim/tires, grey, and orange.
 */
export function isRedBodyPixel(r: number, g: number, b: number): boolean {
  if (isTireOrRimPixel(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < 16 || r < max) return false;
  if (chroma / max < 0.22) return false;
  if (r < g + 8 || r < b + 8) return false;
  if (g >= r * 0.38 && g > b + 20) return false;
  if (b >= r * 0.38 && b > g + 20) return false;
  return true;
}

/**
 * Tripo Bison body — chromatic green at any luminance, including comic shadows.
 * Skips yellow/chrome, black tires, and a dark bed liner.
 */
export function isGreenBodyPixel(r: number, g: number, b: number): boolean {
  if (isTireOrRimPixel(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < 16 || g < max) return false;
  if (chroma / max < 0.22) return false;
  if (g < r + 6 || g < b + 8) return false;
  if (r >= g * 0.78 && r > b + 40) return false;
  if (b >= g * 0.72) return false;
  return true;
}

/**
 * Tripo Donnerbüchse body — chromatic blue at any luminance, including comic shadows.
 * Skips chrome engine/exhaust and black tires. Orange door flames are handled separately
 * via {@link isHotRodFlamePixel} / {@link recolorDonnerBodyPixels}.
 */
export function isBlueBodyPixel(r: number, g: number, b: number): boolean {
  if (isTireOrRimPixel(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < 16 || b < max) return false;
  if (chroma / max < 0.32) return false;
  if (b < r + 8 || b < g + 16) return false;
  if (g >= b * 0.78 && g > r + 40) return false;
  if (r >= b * 0.38 && r > g + 20) return false;
  return true;
}

/** Baked Hot-Rod door flames (orange tongues) — stock albedo should not keep these. */
export function isHotRodFlamePixel(r: number, g: number, b: number): boolean {
  if (isTireOrRimPixel(r, g, b)) return false;
  if (r < 150) return false;
  if (r <= g + 12) return false;
  if (b > g * 0.9 && b > 70) return false;
  if (!(r > g && g >= b - 10)) return false;
  if (r - b < 55) return false;
  if (g < 35) return false;
  return true;
}

/** Hex paint → 0..1 sRGB (canvas albedo, not three.js linear Color). */
export function paintSrgb01(paint: string): { r: number; g: number; b: number } {
  const hex = paint.replace("#", "");
  if (hex.length < 6) return { r: 1, g: 1, b: 1 };
  return {
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function shadeScale(lum: number, paintR: number, paintG: number, paintB: number): number {
  const paintLum = (paintR + paintG + paintB) / 3;
  const floor = paintLum < 0.28 ? 0.52 : 0.35;
  return floor + (1 - floor) * lum;
}

function shadeMatchingPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  match: (r: number, g: number, b: number) => boolean,
  skipTexels?: Uint8Array,
): number {
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (skipTexels && skipTexels[i / 4]) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (!match(r, g, b)) continue;
    const lum = (r + g + b) / (3 * 255);
    const shade = shadeScale(lum, paintR, paintG, paintB);
    data[i] = Math.round(paintR * 255 * shade);
    data[i + 1] = Math.round(paintG * 255 * shade);
    data[i + 2] = Math.round(paintB * 255 * shade);
    changed++;
  }
  return changed;
}

/** Mutates RGBA buffer in place. paint channels are 0..1. */
export function recolorNearWhitePixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isNearWhitePaintPixel, skipTexels);
}

type RecolorPixels = (
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
) => number;

function bakeAuthoredMap(
  base: Texture,
  paint: string,
  cacheKey: string,
  recolor: RecolorPixels,
  wheelUvTris?: ArrayLike<number>,
): Texture {
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  if (typeof document === "undefined" || !base.image) {
    cache.set(cacheKey, base);
    return base;
  }

  const img = base.image as { width?: number; height?: number; complete?: boolean; naturalWidth?: number };
  const w = Number(img.width ?? img.naturalWidth ?? 0);
  const h = Number(img.height ?? 0);
  if (w < 8 || h < 8) {
    cache.set(cacheKey, base);
    return base;
  }
  if (typeof HTMLImageElement !== "undefined" && base.image instanceof HTMLImageElement) {
    if (!base.image.complete || base.image.naturalWidth < 1) {
      cache.set(cacheKey, base);
      return base;
    }
  }

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    cache.set(cacheKey, base);
    return base;
  }
  try {
    ctx.drawImage(base.image as CanvasImageSource, 0, 0, w, h);
  } catch {
    cache.set(cacheKey, base);
    return base;
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const paintColor = paintSrgb01(paint);
  const skip =
    wheelUvTris && wheelUvTris.length >= 6 ? buildWheelTexelMask(w, h, wheelUvTris) : undefined;
  recolor(imageData.data, paintColor.r, paintColor.g, paintColor.b, skip);
  ctx.putImageData(imageData, 0, 0);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = base.flipY;
  tex.needsUpdate = true;
  cache.set(cacheKey, tex);
  return tex;
}

function mapCacheKey(
  kind: string,
  paint: string,
  base: Texture,
  wheelUvTris?: ArrayLike<number>,
): string {
  return `${kind}:${paint}:${textureKey(base)}:wuv${wheelUvTris?.length ?? 0}`;
}

/** Canvas texture with matching body pixels tinted to `paint`; falls back to the original map. */
export function bakeAuthoredWhiteToPaint(
  base: Texture,
  paint: string,
  wheelUvTris?: ArrayLike<number>,
): Texture {
  return bakeAuthoredMap(
    base,
    paint,
    mapCacheKey("bunker-white", paint, base, wheelUvTris),
    recolorNearWhitePixels,
    wheelUvTris,
  );
}

/** Mutates RGBA: orange body panels → garage paint, keep cage/tire/chrome. */
export function recolorOrangeBodyPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isOrangeBodyPixel, skipTexels);
}

export function bakeAuthoredOrangeToPaint(
  base: Texture,
  paint: string,
  wheelUvTris?: ArrayLike<number>,
): Texture {
  return bakeAuthoredMap(
    base,
    paint,
    mapCacheKey("kaeferkraft-orange", paint, base, wheelUvTris),
    recolorOrangeBodyPixels,
    wheelUvTris,
  );
}

/** Mutates RGBA: red body panels → garage paint, keep dark lights/trim. */
export function recolorRedBodyPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isRedBodyPixel, skipTexels);
}

export function bakeAuthoredRedToPaint(
  base: Texture,
  paint: string,
  wheelUvTris?: ArrayLike<number>,
): Texture {
  return bakeAuthoredMap(
    base,
    paint,
    mapCacheKey("blitz-red", paint, base, wheelUvTris),
    recolorRedBodyPixels,
    wheelUvTris,
  );
}

/** Mutates RGBA: green body panels → garage paint, keep yellow/chrome/tires/liner. */
export function recolorGreenBodyPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isGreenBodyPixel, skipTexels);
}

export function bakeAuthoredGreenToPaint(
  base: Texture,
  paint: string,
  wheelUvTris?: ArrayLike<number>,
): Texture {
  return bakeAuthoredMap(
    base,
    paint,
    mapCacheKey("bison-green", paint, base, wheelUvTris),
    recolorGreenBodyPixels,
    wheelUvTris,
  );
}

/** Mutates RGBA: blue body panels → garage paint (chrome/tires stay). */
export function recolorBlueBodyPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isBlueBodyPixel, skipTexels);
}

/** Mutates RGBA: leftover orange flame islands → garage paint. */
export function recolorHotRodFlamePixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isHotRodFlamePixel, skipTexels);
}

/** Blue body + residual door flames → paint; chrome/tires stay. */
export function recolorDonnerBodyPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  skipTexels?: Uint8Array,
): number {
  let changed = recolorHotRodFlamePixels(data, paintR, paintG, paintB, skipTexels);
  for (let i = 0; i < data.length; i += 4) {
    if (skipTexels && skipTexels[i / 4]) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (!isBlueBodyPixel(r, g, b)) continue;
    let lum = (r + g + b) / (3 * 255);
    // Scrubbed flame tongues are abnormally bright cyan on door panels — flatten so
    // "Kein Aufkleber" does not leave a painted-over silhouette.
    if (lum > 0.6) lum = 0.46 + (lum - 0.6) * 0.2;
    const shade = shadeScale(lum, paintR, paintG, paintB);
    data[i] = Math.round(paintR * 255 * shade);
    data[i + 1] = Math.round(paintG * 255 * shade);
    data[i + 2] = Math.round(paintB * 255 * shade);
    changed++;
  }
  return changed;
}

export function bakeAuthoredBlueToPaint(
  base: Texture,
  paint: string,
  wheelUvTris?: ArrayLike<number>,
): Texture {
  return bakeAuthoredMap(
    base,
    paint,
    mapCacheKey("donnerbuechse-blue-v3", paint, base, wheelUvTris),
    recolorDonnerBodyPixels,
    wheelUvTris,
  );
}

function textureKey(tex: Texture): string {
  const img = tex.image as { width?: number; height?: number; src?: string } | undefined;
  return `${img?.src ?? "img"}:${img?.width ?? 0}x${img?.height ?? 0}`;
}

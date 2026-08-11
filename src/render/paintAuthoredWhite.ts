/**
 * Recolor authored albedo pixels to garage paint (Bunker white, Käferkraft orange, Blitz red).
 * Keeps trim / lights / cage pixels that fail the body-pixel test.
 */
import {
  CanvasTexture,
  Color,
  NearestFilter,
  SRGBColorSpace,
  type Texture,
} from "three";

const cache = new Map<string, Texture>();

export function clearAuthoredWhitePaintCache(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

/** Bright + low chroma → body white (not yellow badges / black trim). */
export function isNearWhitePaintPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max >= 175 && max - min <= 48;
}

/** Tripo Käferkraft body panels (orange hood/sides, not black cage/tires). */
export function isOrangeBodyPixel(r: number, g: number, b: number): boolean {
  return r >= 90 && r >= g + 12 && r >= b + 28 && g >= b - 8 && r + g + b >= 180;
}

/**
 * Tripo Blitz body — any luminance of chromatic red, including comic shadows.
 * Skips black trim/tires, grey, and orange.
 */
export function isRedBodyPixel(r: number, g: number, b: number): boolean {
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

function shadeMatchingPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
  match: (r: number, g: number, b: number) => boolean,
): number {
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (!match(r, g, b)) continue;
    const lum = (r + g + b) / (3 * 255);
    const shade = 0.35 + 0.65 * lum;
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
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isNearWhitePaintPixel);
}

type RecolorPixels = (
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
) => number;

function bakeAuthoredMap(
  base: Texture,
  paint: string,
  cacheKey: string,
  recolor: RecolorPixels,
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
  const paintColor = new Color(paint);
  recolor(imageData.data, paintColor.r, paintColor.g, paintColor.b);
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

/** Canvas texture with matching body pixels tinted to `paint`; falls back to the original map. */
export function bakeAuthoredWhiteToPaint(base: Texture, paint: string): Texture {
  return bakeAuthoredMap(base, paint, `bunker-white:${paint}:${textureKey(base)}`, recolorNearWhitePixels);
}

/** Mutates RGBA: orange body panels → garage paint, keep cage/tire/chrome. */
export function recolorOrangeBodyPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isOrangeBodyPixel);
}

export function bakeAuthoredOrangeToPaint(base: Texture, paint: string): Texture {
  return bakeAuthoredMap(base, paint, `kaeferkraft-orange:${paint}:${textureKey(base)}`, recolorOrangeBodyPixels);
}

/** Mutates RGBA: red body panels → garage paint, keep dark lights/trim. */
export function recolorRedBodyPixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
): number {
  return shadeMatchingPixels(data, paintR, paintG, paintB, isRedBodyPixel);
}

export function bakeAuthoredRedToPaint(base: Texture, paint: string): Texture {
  return bakeAuthoredMap(base, paint, `blitz-red:${paint}:${textureKey(base)}`, recolorRedBodyPixels);
}

function textureKey(tex: Texture): string {
  const img = tex.image as { width?: number; height?: number; src?: string } | undefined;
  return `${img?.src ?? "img"}:${img?.width ?? 0}x${img?.height ?? 0}`;
}

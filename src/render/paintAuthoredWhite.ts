/**
 * Recolor near-white albedo pixels to garage paint (Bunker authored maps).
 * Keeps yellow/black/chromatic detail from the Hummer atlas.
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

/** Mutates RGBA buffer in place. paint channels are 0..1. */
export function recolorNearWhitePixels(
  data: Uint8ClampedArray | Uint8Array,
  paintR: number,
  paintG: number,
  paintB: number,
): number {
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (!isNearWhitePaintPixel(r, g, b)) continue;
    // Keep authored shading: scale paint by original luminance
    const lum = (r + g + b) / (3 * 255);
    const shade = 0.35 + 0.65 * lum;
    data[i] = Math.round(paintR * 255 * shade);
    data[i + 1] = Math.round(paintG * 255 * shade);
    data[i + 2] = Math.round(paintB * 255 * shade);
    changed++;
  }
  return changed;
}

/**
 * Returns a canvas texture with near-white body panels tinted to `paint`.
 * Falls back to the original map when canvas/image is unavailable.
 */
export function bakeAuthoredWhiteToPaint(base: Texture, paint: string): Texture {
  const key = `bunker-white:${paint}:${textureKey(base)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  if (typeof document === "undefined" || !base.image) {
    cache.set(key, base);
    return base;
  }

  const img = base.image as { width?: number; height?: number; complete?: boolean; naturalWidth?: number };
  const w = Number(img.width ?? img.naturalWidth ?? 0);
  const h = Number(img.height ?? 0);
  if (w < 8 || h < 8) {
    cache.set(key, base);
    return base;
  }
  if (typeof HTMLImageElement !== "undefined" && base.image instanceof HTMLImageElement) {
    if (!base.image.complete || base.image.naturalWidth < 1) {
      cache.set(key, base);
      return base;
    }
  }

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    cache.set(key, base);
    return base;
  }
  try {
    ctx.drawImage(base.image as CanvasImageSource, 0, 0, w, h);
  } catch {
    cache.set(key, base);
    return base;
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const paintColor = new Color(paint);
  recolorNearWhitePixels(imageData.data, paintColor.r, paintColor.g, paintColor.b);
  ctx.putImageData(imageData, 0, 0);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = base.flipY;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

function textureKey(tex: Texture): string {
  const img = tex.image as { width?: number; height?: number; src?: string } | undefined;
  return `${img?.src ?? "img"}:${img?.width ?? 0}x${img?.height ?? 0}`;
}

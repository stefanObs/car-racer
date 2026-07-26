/**
 * Asphalt-Comic textures for garage bay meshes (applied as material maps — no floating decals).
 */
import {
  CanvasTexture,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
} from "three";
import { ComicPaletteCss } from "./palette";

const texCache = new Map<string, Texture>();

export function clearGarageTextureCache(): void {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

export function garageTextureCacheSize(): number {
  return texCache.size;
}

function outline(): string {
  return ComicPaletteCss.outline;
}

function fallbackTex(r = 180, g = 180, b = 185): DataTexture {
  const data = new Uint8Array([r, g, b, 255]);
  const tex = new DataTexture(data, 1, 1, RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  return tex;
}

function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") {
    const tex = fallbackTex();
    texCache.set(key, tex);
    return tex;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const tex = fallbackTex();
    texCache.set(key, tex);
    return tex;
  }
  draw(ctx);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

function hatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing = 12,
  angle = -0.4,
  alpha = 0.28,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = outline();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = alpha;
  const pad = Math.hypot(w, h);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  for (let i = -pad; i < pad; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, -pad * 0.55);
    ctx.lineTo(i, pad * 0.55);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Outer garage floor — dark concrete, light panel grid only. */
export function floorTexture(): Texture {
  return canvasTex("garage-floor-v3", 512, 512, (ctx) => {
    const w = 512;
    const h = 512;
    ctx.fillStyle = "#3A4046";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = outline();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.35;
    for (let x = 64; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 64; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/** Race pad asphalt with curb lines + dashed center (baked in). */
export function asphaltPadTexture(): Texture {
  return canvasTex("garage-asphalt-pad-v3", 512, 640, (ctx) => {
    const w = 512;
    const h = 640;
    ctx.fillStyle = ComicPaletteCss.asphalt;
    ctx.fillRect(0, 0, w, h);

    // Soft center shade (one clean ellipse)
    ctx.fillStyle = "rgba(27, 27, 31, 0.16)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5, 150, 70, 0, 0, Math.PI * 2);
    ctx.fill();

    // Two clean tire arcs
    ctx.strokeStyle = outline();
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(200, 380, 90, 0.3, 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(320, 390, 100, -0.2, 1.0);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Yellow curb rails
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(16, 36, 20, h - 72);
    ctx.fillRect(w - 36, 36, 20, h - 72);
    ctx.strokeStyle = outline();
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 36, 20, h - 72);
    ctx.strokeRect(w - 36, 36, 20, h - 72);

    // White dashed center
    ctx.fillStyle = ComicPaletteCss.asphaltLine;
    for (let y = 56; y < h - 56; y += 46) {
      ctx.fillRect(w * 0.5 - 5, y, 10, 22);
      ctx.strokeStyle = outline();
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.5 - 5, y, 10, 22);
    }

    ctx.strokeStyle = outline();
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** Concrete wall panels with seams. */
export function wallPanelTexture(seed: number): Texture {
  return canvasTex(`garage-wall-v3-${seed}`, 512, 384, (ctx) => {
    const w = 512;
    const h = 384;
    ctx.fillStyle = seed % 2 === 0 ? "#6A7178" : "#5A6168";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = outline();
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.7;
    for (const x of [128, 256, 384]) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, h - 10);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(10, h * 0.5);
    ctx.lineTo(w - 10, h * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Rivets
    ctx.fillStyle = outline();
    ctx.globalAlpha = 0.45;
    for (const x of [128, 256, 384]) {
      for (let y = 32; y < h - 24; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = outline();
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
}

/** Black / yellow hazard chevrons. */
export function hazardChevronTexture(): Texture {
  return canvasTex("garage-hazard-v2", 512, 96, (ctx) => {
    const w = 512;
    const h = 96;
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = outline();
    const step = 48;
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.55, 0);
      ctx.lineTo(x + h * 0.55 + h, h);
      ctx.lineTo(x + h, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = outline();
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });
}

/** Red locker door face. */
export function cabinetDoorTexture(): Texture {
  return canvasTex("garage-cabinet-v2", 256, 384, (ctx) => {
    const w = 256;
    const h = 384;
    ctx.fillStyle = "#E03131";
    ctx.fillRect(0, 0, w, h);
    hatch(ctx, 12, 12, w - 24, h - 24, 10, -0.55, 0.18);

    ctx.strokeStyle = outline();
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.lineWidth = 4;
    ctx.strokeRect(26, 26, w - 52, h - 52);

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(26, h * 0.48);
    ctx.lineTo(w - 26, h * 0.48);
    ctx.stroke();

    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(w - 58, h * 0.42, 22, 55);
    ctx.strokeStyle = outline();
    ctx.lineWidth = 3;
    ctx.strokeRect(w - 58, h * 0.42, 22, 55);
  });
}

/** Shipping crate face. */
export function crateFaceTexture(fill: string): Texture {
  return canvasTex(`garage-crate-v2-${fill}`, 256, 256, (ctx) => {
    const w = 256;
    const h = 256;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = outline();
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(w - 40, h - 40);
    ctx.moveTo(w - 40, 40);
    ctx.lineTo(40, h - 40);
    ctx.stroke();
    ctx.fillStyle = outline();
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 5; i++) ctx.fillRect(48 + i * 14, h - 52, 8, 28);
    ctx.globalAlpha = 1;
  });
}

/** Shop banner face. */
export function bannerTexture(): Texture {
  return canvasTex("garage-banner-v2", 640, 128, (ctx) => {
    const w = 640;
    const h = 128;
    ctx.fillStyle = "#E03131";
    ctx.fillRect(0, 0, w, h);
    hatch(ctx, 0, 0, w, h, 10, -0.55, 0.2);

    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(20, h * 0.68, w - 40, 12);
    ctx.fillStyle = outline();
    ctx.fillRect(20, 14, w - 40, 8);

    ctx.fillStyle = ComicPaletteCss.curbLight;
    const blocks = [
      [70, 38, 70, 26],
      [155, 38, 48, 26],
      [220, 38, 88, 26],
      [330, 38, 40, 26],
      [390, 38, 100, 26],
      [510, 38, 55, 26],
    ] as const;
    for (const [x, y, bw, bh] of blocks) {
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = outline();
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, bw, bh);
    }

    ctx.strokeStyle = outline();
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** Wall poster panel. */
export function posterTexture(accent: string): Texture {
  return canvasTex(`garage-poster-v2-${accent}`, 256, 192, (ctx) => {
    const w = 256;
    const h = 192;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    hatch(ctx, 16, 16, w - 32, h - 32, 9, -0.4, 0.3);

    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 44);
    ctx.lineTo(w * 0.56, 78);
    ctx.lineTo(w * 0.74, 78);
    ctx.lineTo(w * 0.59, 98);
    ctx.lineTo(w * 0.65, 130);
    ctx.lineTo(w * 0.5, 110);
    ctx.lineTo(w * 0.35, 130);
    ctx.lineTo(w * 0.41, 98);
    ctx.lineTo(w * 0.26, 78);
    ctx.lineTo(w * 0.44, 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outline();
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

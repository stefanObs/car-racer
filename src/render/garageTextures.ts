/**
 * Bright Asphalt-Comic garage textures — flat base + bold ink detail (reference daylight look).
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

function ink(): string {
  return ComicPaletteCss.outline;
}

function fallbackTex(r = 200, g = 205, b = 210): DataTexture {
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Workshop concrete — cooler grey, cracks, ink seams (car-targets garage). */
export function floorTexture(): Texture {
  return canvasTex("garage-floor-v6", 512, 512, (ctx) => {
    const w = 512;
    const h = 512;
    ctx.fillStyle = "#C5C9CE";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#B7BCC2";
    for (let y = 0; y < h; y += 72) {
      for (let x = 0; x < w; x += 72) {
        if (((x + y) / 72) % 2 === 0) ctx.fillRect(x, y, 72, 72);
      }
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;
    for (let x = 72; x < w; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 72; y < h; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ink();
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(40, 80);
    ctx.lineTo(90, 140);
    ctx.lineTo(70, 210);
    ctx.lineTo(130, 280);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(380, 60);
    ctx.lineTo(420, 130);
    ctx.lineTo(400, 200);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

/** Circular asphalt turntable with hazard ring. */
export function turntableTexture(): Texture {
  return canvasTex("garage-turntable-v1", 512, 512, (ctx) => {
    const w = 512;
    const h = 512;
    const cx = 256;
    const cy = 256;
    ctx.fillStyle = "#8A9098";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#7A8088";
    ctx.lineWidth = 3;
    for (let r = 40; r < 230; r += 16) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 0.5) / 24) * Math.PI * 2;
      ctx.fillStyle = i % 2 === 0 ? ComicPaletteCss.repairSpark : ink();
      ctx.beginPath();
      ctx.arc(cx, cy, 252, a0, a1);
      ctx.arc(cx, cy, 218, a1, a0, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,248,220,0.22)";
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Sunny race-pad asphalt with curb + dashes + ink grain. */
export function asphaltPadTexture(): Texture {
  return canvasTex("garage-asphalt-pad-v5", 640, 768, (ctx) => {
    const w = 640;
    const h = 768;
    ctx.fillStyle = "#8A9098";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#7A8088";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.65;
    for (let y = 20; y < h; y += 14) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 40, y + (y % 28 === 0 ? 3 : -2));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.48, 40, w * 0.5, h * 0.48, 220);
    grad.addColorStop(0, "rgba(255,248,220,0.28)");
    grad.addColorStop(1, "rgba(255,248,220,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink();
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(230, 460, 100, 0.25, 1.35);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ink();
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** Concrete wall with mid hazard band (car-targets garage). */
export function wallPanelTexture(seed: number): Texture {
  return canvasTex(`garage-wall-v6-${seed}`, 640, 480, (ctx) => {
    const w = 640;
    const h = 480;
    ctx.fillStyle = seed % 2 === 0 ? "#D8DCE1" : "#CED3D8";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(90,100,110,0.12)";
    ctx.fillRect(0, 0, w, h * 0.18);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(0, h * 0.38, w, 22);
    ctx.strokeStyle = ink();
    ctx.lineWidth = 4;
    ctx.strokeRect(0, h * 0.38, w, 22);
    const hy = h * 0.46;
    const hh = 36;
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(0, hy, w, hh);
    ctx.fillStyle = ink();
    const step = 44;
    for (let x = -hh; x < w + hh; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, hy);
      ctx.lineTo(x + hh * 0.5, hy);
      ctx.lineTo(x + hh * 0.5 + hh, hy + hh);
      ctx.lineTo(x + hh, hy + hh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 6;
    for (const x of [160, 320, 480]) {
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x, h - 14);
      ctx.stroke();
    }
    ctx.fillStyle = ink();
    for (const x of [160, 320, 480]) {
      for (let y = 36; y < h - 28; y += 44) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.55;
    const ox = 40 + seed * 40;
    ctx.beginPath();
    ctx.moveTo(ox, 80);
    ctx.lineTo(ox + 35, 120);
    ctx.lineTo(ox + 18, 170);
    ctx.lineTo(ox + 50, 210);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
  });
}

/** Bold hazard chevrons. */
export function hazardChevronTexture(): Texture {
  return canvasTex("garage-hazard-v4", 640, 128, (ctx) => {
    const w = 640;
    const h = 128;
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ink();
    const step = 56;
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.5, 0);
      ctx.lineTo(x + h * 0.5 + h, h);
      ctx.lineTo(x + h, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
}

/** Shop banner — CRASH CIRCUIT blocks. */
export function bannerTexture(): Texture {
  return canvasTex("garage-banner-v4", 768, 160, (ctx) => {
    const w = 768;
    const h = 160;
    ctx.fillStyle = "#E03131";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(16, h - 28, w - 32, 12);
    ctx.fillStyle = "#F8F9FA";
    const blocks = [
      [48, 48, 78, 36],
      [140, 48, 56, 36],
      [210, 48, 90, 36],
      [320, 48, 48, 36],
      [386, 48, 110, 36],
      [516, 48, 62, 36],
      [600, 48, 100, 36],
    ] as const;
    for (const [x, y, bw, bh] of blocks) {
      roundRect(ctx, x, y, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = ink();
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** Wall slogan from the car-targets garage sheet. */
export function sloganPosterTexture(title: string, chevron: string): Texture {
  return canvasTex(`garage-slogan-v1-${title}`, 384, 220, (ctx) => {
    const w = 384;
    const h = 220;
    ctx.fillStyle = ink();
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(10, 10, w - 20, 8);
    ctx.fillRect(10, h - 18, w - 20, 8);
    ctx.fillStyle = "#F8F9FA";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, w / 2, h * 0.42);
    ctx.fillStyle = chevron;
    for (let i = 0; i < 3; i++) {
      const x = 118 + i * 52;
      ctx.beginPath();
      ctx.moveTo(x, 148);
      ctx.lineTo(x + 28, 168);
      ctx.lineTo(x, 188);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = ComicPaletteCss.repairSpark;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}

/** Comic race poster. */
export function posterTexture(accent: string): Texture {
  return canvasTex(`garage-poster-v4-${accent}`, 320, 240, (ctx) => {
    const w = 320;
    const h = 240;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ComicPaletteCss.sky;
    ctx.fillRect(24, 80, w - 48, 70);
    ctx.fillStyle = ComicPaletteCss.asphalt;
    ctx.fillRect(24, 140, w - 48, 50);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.beginPath();
    ctx.moveTo(90, 155);
    ctx.lineTo(220, 160);
    ctx.lineTo(210, 175);
    ctx.lineTo(100, 175);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}

/** Sky peek through open bay door. */
export function skyPeekTexture(): Texture {
  return canvasTex("garage-sky-v4", 256, 384, (ctx) => {
    const w = 256;
    const h = 384;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#6BB3E8");
    g.addColorStop(0.55, "#5BA3D9");
    g.addColorStop(1, "#A8D4F0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#F8F9FA";
    for (const [x, y, r] of [
      [60, 90, 28],
      [90, 85, 34],
      [120, 92, 26],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

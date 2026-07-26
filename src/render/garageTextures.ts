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

/** Bright workshop concrete floor with comic tile seams. */
export function floorTexture(): Texture {
  return canvasTex("garage-floor-v5", 512, 512, (ctx) => {
    const w = 512;
    const h = 512;
    ctx.fillStyle = "#E4E7EC";
    ctx.fillRect(0, 0, w, h);
    // Checker warmth
    ctx.fillStyle = "#D5DAE0";
    for (let y = 0; y < h; y += 64) {
      for (let x = 0; x < w; x += 64) {
        if (((x + y) / 64) % 2 === 0) ctx.fillRect(x, y, 64, 64);
      }
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
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
    // Corner bolts
    ctx.fillStyle = ink();
    for (let y = 32; y < h; y += 64) {
      for (let x = 32; x < w; x += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Sunny race-pad asphalt with curb + dashes + ink grain. */
export function asphaltPadTexture(): Texture {
  return canvasTex("garage-asphalt-pad-v5", 640, 768, (ctx) => {
    const w = 640;
    const h = 768;
    ctx.fillStyle = "#8A9098";
    ctx.fillRect(0, 0, w, h);
    // Light/dark bands (comic asphalt grain)
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

    // Soft spotlight pool under car
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.48, 40, w * 0.5, h * 0.48, 220);
    grad.addColorStop(0, "rgba(255,248,220,0.28)");
    grad.addColorStop(1, "rgba(255,248,220,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Tire arcs
    ctx.strokeStyle = ink();
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(230, 460, 100, 0.25, 1.35);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(400, 470, 115, -0.25, 1.05);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Yellow curbs with black segments
    for (const x of [14, w - 38] as const) {
      for (let y = 30; y < h - 30; y += 36) {
        ctx.fillStyle = y % 72 < 36 ? ComicPaletteCss.repairSpark : ink();
        ctx.fillRect(x, y, 24, 34);
      }
      ctx.strokeStyle = ink();
      ctx.lineWidth = 4;
      ctx.strokeRect(x, 30, 24, h - 60);
    }

    // Center dashes
    for (let y = 50; y < h - 50; y += 52) {
      ctx.fillStyle = ComicPaletteCss.asphaltLine;
      roundRect(ctx, w * 0.5 - 7, y, 14, 28, 3);
      ctx.fill();
      ctx.strokeStyle = ink();
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.strokeStyle = ink();
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** Light concrete wall with comic panel seams. */
export function wallPanelTexture(seed: number): Texture {
  return canvasTex(`garage-wall-v5-${seed}`, 640, 480, (ctx) => {
    const w = 640;
    const h = 480;
    ctx.fillStyle = seed % 2 === 0 ? "#EEF1F4" : "#E4E8ED";
    ctx.fillRect(0, 0, w, h);
    // Top shade band
    ctx.fillStyle = "rgba(90,100,110,0.08)";
    ctx.fillRect(0, 0, w, h * 0.18);

    ctx.strokeStyle = ink();
    ctx.lineWidth = 6;
    for (const x of [160, 320, 480]) {
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x, h - 14);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(14, h * 0.42);
    ctx.lineTo(w - 14, h * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, h * 0.72);
    ctx.lineTo(w - 14, h * 0.72);
    ctx.stroke();

    // Rivets
    ctx.fillStyle = ink();
    for (const x of [160, 320, 480]) {
      for (let y = 36; y < h - 28; y += 44) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#F1F3F5";
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink();
      }
    }

    // One comic crack per wall
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

/** Detailed red locker door. */
export function cabinetDoorTexture(): Texture {
  return canvasTex("garage-cabinet-v4", 320, 480, (ctx) => {
    const w = 320;
    const h = 480;
    ctx.fillStyle = "#E03131";
    ctx.fillRect(0, 0, w, h);
    // Highlight stripe
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(18, 18, 36, h - 36);

    ctx.strokeStyle = ink();
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 5;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    // Two door panels
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 44, w - 80, h * 0.38);
    ctx.strokeRect(40, h * 0.5, w - 80, h * 0.38);

    // Louvers
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 5; i++) {
      const y = 60 + i * 28;
      ctx.beginPath();
      ctx.moveTo(52, y);
      ctx.lineTo(w - 52, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Handle plate + grip
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    roundRect(ctx, w - 72, h * 0.44, 28, 70, 4);
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = ink();
    roundRect(ctx, w - 64, h * 0.48, 12, 42, 3);
    ctx.fill();

    // Vent dots
    ctx.fillStyle = ink();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(56 + i * 22, h - 70, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Shipping crate with X brace + stencil. */
export function crateFaceTexture(fill: string): Texture {
  return canvasTex(`garage-crate-v4-${fill}`, 320, 320, (ctx) => {
    const w = 320;
    const h = 320;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    ctx.strokeStyle = ink();
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    // X brace
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(48, 48);
    ctx.lineTo(w - 48, h - 48);
    ctx.moveTo(w - 48, 48);
    ctx.lineTo(48, h - 48);
    ctx.stroke();

    // Corner plates
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    for (const [x, y] of [
      [20, 20],
      [w - 52, 20],
      [20, h - 52],
      [w - 52, h - 52],
    ] as const) {
      ctx.fillRect(x, y, 32, 32);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 32, 32);
    }

    // Barcode
    ctx.fillStyle = ink();
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(70 + i * 16, h - 70, 8 + (i % 2) * 4, 36);
    }
  });
}

/** Shop banner — CRASH CIRCUIT blocks. */
export function bannerTexture(): Texture {
  return canvasTex("garage-banner-v4", 768, 160, (ctx) => {
    const w = 768;
    const h = 160;
    ctx.fillStyle = "#E03131";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(0, 0, w, 28);

    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(16, h - 28, w - 32, 12);
    ctx.fillStyle = ink();
    ctx.fillRect(16, 16, w - 32, 8);

    // Word marks
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

/** Comic race poster. */
export function posterTexture(accent: string): Texture {
  return canvasTex(`garage-poster-v4-${accent}`, 320, 240, (ctx) => {
    const w = 320;
    const h = 240;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(20, 20, w - 40, 50);

    // Horizon stripe
    ctx.fillStyle = ComicPaletteCss.sky;
    ctx.fillRect(24, 80, w - 48, 70);
    ctx.fillStyle = ComicPaletteCss.asphalt;
    ctx.fillRect(24, 140, w - 48, 50);

    // Mini car silhouette
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.beginPath();
    ctx.moveTo(90, 155);
    ctx.lineTo(140, 145);
    ctx.lineTo(190, 148);
    ctx.lineTo(220, 160);
    ctx.lineTo(210, 175);
    ctx.lineTo(100, 175);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = ink();
    ctx.beginPath();
    ctx.arc(120, 178, 10, 0, Math.PI * 2);
    ctx.arc(190, 178, 10, 0, Math.PI * 2);
    ctx.fill();

    // Star badge
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.beginPath();
    ctx.moveTo(w * 0.78, 36);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const b = a + Math.PI / 5;
      ctx.lineTo(w * 0.78 + Math.cos(a) * 22, 48 + Math.sin(a) * 22);
      ctx.lineTo(w * 0.78 + Math.cos(b) * 10, 48 + Math.sin(b) * 10);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.lineWidth = 4;
    ctx.strokeRect(22, 22, w - 44, h - 44);
  });
}

/** Wood workbench top. */
export function woodBenchTexture(): Texture {
  return canvasTex("garage-wood-v4", 512, 160, (ctx) => {
    const w = 512;
    const h = 160;
    ctx.fillStyle = "#C48A4A";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#8B5A2B";
    ctx.lineWidth = 3;
    for (let y = 18; y < h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.bezierCurveTo(w * 0.3, y - 4, w * 0.6, y + 5, w - 8, y);
      ctx.stroke();
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    // Knots
    ctx.fillStyle = "#8B5A2B";
    ctx.beginPath();
    ctx.ellipse(120, 70, 14, 9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(360, 90, 12, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Orange oil drum label. */
export function drumLabelTexture(): Texture {
  return canvasTex("garage-drum-v4", 256, 320, (ctx) => {
    const w = 256;
    const h = 320;
    ctx.fillStyle = "#E8590C";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(0, 40, w, 36);
    ctx.fillStyle = ink();
    ctx.fillRect(0, 120, w, 28);
    ctx.fillStyle = "#F8F9FA";
    roundRect(ctx, 48, 170, w - 96, 70, 6);
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 4;
    ctx.stroke();
    // Warning triangle
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 185);
    ctx.lineTo(w * 0.5 + 28, 225);
    ctx.lineTo(w * 0.5 - 28, 225);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
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
    // Comic clouds
    ctx.fillStyle = "#F8F9FA";
    for (const [x, y, r] of [
      [60, 90, 28],
      [90, 85, 34],
      [120, 92, 26],
      [160, 180, 30],
      [190, 175, 36],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = ink();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(40, 100);
    ctx.quadraticCurveTo(90, 70, 140, 100);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

/** Clean pegboard face — holes + ink frame (tools are separate 3D meshes). */
export function toolBoardTexture(): Texture {
  return canvasTex("garage-toolboard-v2", 512, 320, (ctx) => {
    const w = 512;
    const h = 320;
    ctx.fillStyle = "#F0D9A8";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#E4C48A";
    for (let y = 0; y < h; y += 16) {
      ctx.fillRect(0, y, w, 8);
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, 0, w, 40);

    for (let y = 36; y < h - 28; y += 32) {
      for (let x = 36; x < w - 28; x += 32) {
        ctx.fillStyle = "#5C4A32";
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink();
        ctx.beginPath();
        ctx.arc(x - 0.5, y - 0.5, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = ComicPaletteCss.repairSpark;
    for (const [x, y] of [
      [18, 18],
      [w - 50, 18],
      [18, h - 50],
      [w - 50, h - 50],
    ] as const) {
      ctx.fillRect(x, y, 32, 32);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, 32, 32);
    }

    ctx.strokeStyle = ink();
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.lineWidth = 4;
    ctx.strokeRect(22, 22, w - 44, h - 44);
  });
}

/**
 * Asphalt-Comic albedo atlases for non-Hotrod cars (tintable white+ink detail).
 * Hotrod keeps its Sketchfab atlas untouched.
 */
import {
  CanvasTexture,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
} from "three";
import type { CarId } from "../data/cars";
import { ComicPaletteCss } from "./palette";

export type ComicAtlasRole =
  | "body"
  | "tire"
  | "chrome"
  | "glass"
  | "light"
  | "dark"
  | "armor"
  | "engine";

const texCache = new Map<string, Texture>();

export function clearComicCarAtlasCache(): void {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

export function comicCarAtlasCacheSize(): number {
  return texCache.size;
}

function ink(): string {
  return ComicPaletteCss.outline;
}

function fallbackTex(r = 245, g = 245, b = 248): DataTexture {
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
  tex.userData = { comicTintable: true };
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

function softShade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.fillRect(0, h * 0.58, w, h * 0.42);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(0, 0, w, h * 0.2);
}

function inkStroke(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, lw = 5): void {
  ctx.strokeStyle = ink();
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function vents(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number): void {
  ctx.strokeStyle = ink();
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 3;
  const gap = h / (n + 1);
  for (let i = 1; i <= n; i++) {
    const yy = y + gap * i;
    ctx.beginPath();
    ctx.moveTo(x + 8, yy);
    ctx.lineTo(x + w - 8, yy);
    ctx.stroke();
  }
}

function cornerBolts(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]): void {
  ctx.fillStyle = ink();
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F8F9FA";
    ctx.beginPath();
    ctx.arc(x - 1.2, y - 1.2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink();
  }
}

/** Cars that already ship Sketchfab-quality atlases — do not overlay. */
export function carUsesAuthoredAtlas(id: CarId): boolean {
  return id === "donnerbuechse";
}

export function comicAtlasForRole(carId: CarId, role: ComicAtlasRole): Texture {
  if (role === "body") return bodyAtlas(carId);
  if (role === "tire") return tireAtlas();
  if (role === "chrome") return chromeAtlas();
  if (role === "glass") return glassAtlas();
  if (role === "light") return lightAtlas();
  if (role === "engine") return engineAtlas();
  if (role === "armor") return armorAtlas();
  return darkAtlas();
}

function bodyAtlas(carId: CarId): Texture {
  return canvasTex(`comic-body-v2:${carId}`, 512, 512, (ctx) => {
    const w = 512;
    const h = 512;
    ctx.fillStyle = "#F6F7F9";
    ctx.fillRect(0, 0, w, h);
    softShade(ctx, w, h);

    if (carId === "blitz") {
      inkStroke(ctx, 40, 160, 470, 160, 6);
      inkStroke(ctx, 40, 320, 470, 320, 6);
      inkStroke(ctx, 180, 40, 180, 470, 5);
      inkStroke(ctx, 340, 40, 340, 470, 5);
      vents(ctx, 55, 70, 100, 70, 4);
      vents(ctx, 360, 70, 100, 70, 4);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 6;
      roundRect(ctx, 200, 200, 120, 55, 8);
      ctx.stroke();
      inkStroke(ctx, 215, 228, 305, 228, 4);
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 5; i++) inkStroke(ctx, 70 + i * 14, 380, 110 + i * 14, 450, 2.5);
      ctx.globalAlpha = 1;
      cornerBolts(ctx, [
        [50, 50],
        [460, 50],
        [50, 460],
        [460, 460],
        [50, 160],
        [460, 160],
        [50, 320],
        [460, 320],
      ]);
    } else if (carId === "bison") {
      inkStroke(ctx, w * 0.4, 30, w * 0.4, h - 30, 8);
      inkStroke(ctx, 30, h * 0.55, w - 30, h * 0.55, 6);
      ctx.strokeStyle = ink();
      ctx.lineWidth = 5;
      roundRect(ctx, w * 0.44, 210, 55, 22, 5);
      ctx.stroke();
      vents(ctx, 45, 55, 110, 50, 3);
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 4; i++) inkStroke(ctx, 60 + i * 100, 320, 100 + i * 100, 470, 3);
      ctx.globalAlpha = 1;
      cornerBolts(ctx, [
        [40, 40],
        [470, 40],
        [40, 470],
        [470, 470],
        [w * 0.4, 40],
        [w * 0.4, 470],
      ]);
    } else if (carId === "kaeferkraft") {
      ctx.strokeStyle = ink();
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(50, 60);
      ctx.lineTo(200, 200);
      ctx.lineTo(80, 400);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(460, 70);
      ctx.lineTo(300, 220);
      ctx.lineTo(440, 420);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeRect(70, 100, 150, 110);
      ctx.strokeRect(290, 300, 150, 120);
      cornerBolts(ctx, [
        [70, 100],
        [220, 100],
        [70, 210],
        [220, 210],
        [290, 300],
        [440, 300],
        [290, 420],
        [440, 420],
      ]);
    } else {
      armorDraw(ctx, w, h);
    }

    ctx.strokeStyle = ink();
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}

function armorDraw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  softShade(ctx, w, h);
  // Large armor plates (sparse — not a rivet carpet)
  ctx.strokeStyle = ink();
  ctx.lineWidth = 7;
  ctx.strokeRect(36, 36, 200, 180);
  ctx.strokeRect(270, 36, 200, 180);
  ctx.strokeRect(36, 250, 200, 200);
  ctx.strokeRect(270, 250, 200, 200);
  cornerBolts(ctx, [
    [36, 36],
    [236, 36],
    [36, 216],
    [236, 216],
    [270, 36],
    [470, 36],
    [270, 216],
    [470, 216],
    [36, 250],
    [236, 250],
    [36, 450],
    [236, 450],
    [270, 250],
    [470, 250],
    [270, 450],
    [470, 450],
  ]);
  // Hazard band
  ctx.fillStyle = ComicPaletteCss.repairSpark;
  ctx.fillRect(0, h * 0.44, w, 40);
  ctx.fillStyle = ink();
  for (let x = -30; x < w + 30; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.44);
    ctx.lineTo(x + 20, h * 0.44);
    ctx.lineTo(x + 40, h * 0.44 + 40);
    ctx.lineTo(x + 20, h * 0.44 + 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(27,27,31,0.18)";
  roundRect(ctx, w * 0.58, 70, 140, 60, 6);
  ctx.fill();
  ctx.strokeStyle = ink();
  ctx.lineWidth = 4;
  ctx.stroke();
}

function armorAtlas(): Texture {
  return canvasTex("comic-armor-v2", 512, 512, (ctx) => {
    ctx.fillStyle = "#E8EAED";
    ctx.fillRect(0, 0, 512, 512);
    armorDraw(ctx, 512, 512);
    ctx.strokeStyle = ink();
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, 496, 496);
  });
}

function tireAtlas(): Texture {
  return canvasTex("comic-tire-v2", 256, 256, (ctx) => {
    const w = 256;
    const h = 256;
    ctx.fillStyle = "#2A2A2E";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#111114";
    ctx.lineWidth = 6;
    for (let y = 16; y < h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(w - 12, y + (y % 44 === 0 ? 5 : -4));
      ctx.stroke();
    }
    ctx.fillStyle = "#E85D04";
    ctx.fillRect(0, h * 0.42, w, 26);
    ctx.strokeStyle = ink();
    ctx.lineWidth = 4;
    ctx.strokeRect(0, h * 0.42, w, 26);
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
}

function chromeAtlas(): Texture {
  return canvasTex("comic-chrome-v2", 256, 256, (ctx) => {
    const w = 256;
    const h = 256;
    ctx.fillStyle = "#E8ECF0";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#F8F9FA";
    ctx.fillRect(0, 0, w, h * 0.28);
    ctx.fillStyle = "#B8C0C8";
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.strokeStyle = ink();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(30 + i * 40, 24);
      ctx.lineTo(55 + i * 40, h - 24);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, w - 10, h - 10);
  });
}

function glassAtlas(): Texture {
  return canvasTex("comic-glass-v2", 256, 256, (ctx) => {
    const w = 256;
    const h = 256;
    ctx.fillStyle = "#3A4A5A";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(200,230,255,0.28)";
    ctx.beginPath();
    ctx.moveTo(24, 28);
    ctx.lineTo(150, 18);
    ctx.lineTo(110, 110);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    inkStroke(ctx, w * 0.5, 16, w * 0.5, h - 16, 4);
  });
}

function lightAtlas(): Texture {
  return canvasTex("comic-light-v2", 128, 128, (ctx) => {
    ctx.fillStyle = "#FFF3C4";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#FFE066";
    ctx.beginPath();
    ctx.arc(64, 64, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(64, 64, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 120, 120);
  });
}

function engineAtlas(): Texture {
  return canvasTex("comic-engine-v2", 256, 256, (ctx) => {
    const w = 256;
    const h = 256;
    ctx.fillStyle = "#6C7178";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink();
    ctx.lineWidth = 5;
    for (let i = 0; i < 4; i++) ctx.strokeRect(30 + i * 50, 40, 40, 160);
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    ctx.fillRect(20, 20, w - 40, 16);
    ctx.lineWidth = 8;
    ctx.strokeStyle = ink();
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

function darkAtlas(): Texture {
  return canvasTex("comic-dark-v2", 256, 256, (ctx) => {
    const w = 256;
    const h = 256;
    ctx.fillStyle = "#3A3A40";
    ctx.fillRect(0, 0, w, h);
    softShade(ctx, w, h);
    inkStroke(ctx, 40, 40, 216, 40, 4);
    inkStroke(ctx, 40, 128, 216, 128, 4);
    inkStroke(ctx, 40, 216, 216, 216, 4);
    ctx.lineWidth = 8;
    ctx.strokeStyle = ink();
    ctx.strokeRect(5, 5, w - 10, h - 10);
  });
}

/** Infer atlas role from material / mesh name. */
export function atlasRoleFromName(name: string, carId: CarId): ComicAtlasRole {
  const n = name.toLowerCase();
  if (n.includes("tire") || n.includes("rubber") || n.includes("wheel")) return "tire";
  if (
    n.includes("chrome") ||
    n.includes("metal") ||
    n.includes("rim") ||
    n.includes("grey") ||
    n === "gray" ||
    n === "graylight"
  ) {
    return "chrome";
  }
  if (n.includes("glass") || n.includes("window")) return "glass";
  if (n.includes("light") || n.includes("head") || n.includes("tail") || n.includes("lamp")) return "light";
  if (n.includes("engine")) return "engine";
  if (n.includes("seat") || n === "dark" || n.includes("black") || n.includes("skull")) return "dark";
  if (carId === "bunker" && (n.includes("truck") || n.includes("orange") || n.includes("armor"))) return "armor";
  if (carId === "bunker") return "armor";
  return "body";
}

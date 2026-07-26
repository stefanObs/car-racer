/**
 * Garage stickers on GLB cars (meshes already carry Asphalt-Comic shading).
 */
import {
  CanvasTexture,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
} from "three";
import type { GearClass } from "../data/cars";
import { ComicPaletteCss } from "./palette";

export type CarOverlayOpts = {
  sticker: string;
  gearClass?: GearClass;
};

const texCache = new Map<string, Texture>();

function fallbackTex(): DataTexture {
  const data = new Uint8Array([255, 255, 255, 220]);
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

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - 18, y - h * 0.4, x - 10, y - h * 0.75, x, y - h);
  ctx.bezierCurveTo(x + 12, y - h * 0.7, x + 20, y - h * 0.35, x + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    const x1 = cx + Math.cos(a) * r;
    const y1 = cy + Math.sin(a) * r;
    const x2 = cx + Math.cos(b) * r * 0.45;
    const y2 = cy + Math.sin(b) * r * 0.45;
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Flat sticker art with thick comic outline. */
export function stickerTexture(sticker: string): Texture | null {
  if (!sticker || sticker === "none") return null;
  return canvasTex(`sticker-v2:${sticker}`, 256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = ComicPaletteCss.outline;
    if (sticker === "flames") {
      ctx.fillStyle = "#FF7A18";
      flame(ctx, 70, 110, 90);
      flame(ctx, 130, 115, 100);
      flame(ctx, 190, 108, 85);
      ctx.fillStyle = "#FFE066";
      flame(ctx, 100, 112, 55);
      flame(ctx, 160, 114, 60);
    } else if (sticker === "lightning") {
      ctx.fillStyle = "#FFE066";
      ctx.beginPath();
      ctx.moveTo(95, 14);
      ctx.lineTo(155, 14);
      ctx.lineTo(125, 58);
      ctx.lineTo(185, 58);
      ctx.lineTo(85, 118);
      ctx.lineTo(115, 70);
      ctx.lineTo(55, 70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = "#3DB9C7";
      for (const [x, y, r] of [
        [70, 64, 30],
        [140, 52, 36],
        [205, 70, 26],
      ] as const) {
        star(ctx, x, y, r);
      }
    }
  });
}

function decal(tex: Texture, w: number, h: number, opacity = 1): Mesh {
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    side: DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.renderOrder = 3;
  return mesh;
}

/** Stickers only — GLB cars already have authored shading. */
export function buildCarOverlays(opts: CarOverlayOpts): Group {
  const g = new Group();
  g.name = "carOverlays";
  const stickerTex = stickerTexture(opts.sticker);
  if (!stickerTex) return g;

  const L = stickerLayout(opts.gearClass ?? "sport");
  const stL = decal(stickerTex, L.stW, L.stH, 0.98);
  stL.position.set(-(L.sideX + 0.02), L.sideY + 0.02, L.stZ);
  stL.rotation.y = Math.PI / 2;
  const stR = decal(stickerTex, L.stW, L.stH, 0.98);
  stR.position.set(L.sideX + 0.02, L.sideY + 0.02, L.stZ);
  stR.rotation.y = -Math.PI / 2;
  stR.rotation.z = Math.PI;
  g.add(stL, stR);
  return g;
}

type StickerLayout = { sideX: number; sideY: number; stW: number; stH: number; stZ: number };

function stickerLayout(gear: GearClass): StickerLayout {
  switch (gear) {
    case "pickup":
      return { sideX: 1.0, sideY: 0.85, stW: 1.2, stH: 0.55, stZ: 0.4 };
    case "buggy":
      return { sideX: 0.72, sideY: 0.6, stW: 0.85, stH: 0.35, stZ: 0.2 };
    case "hotrod":
      return { sideX: 0.82, sideY: 0.55, stW: 1.0, stH: 0.4, stZ: 0.15 };
    case "armor":
      return { sideX: 1.08, sideY: 1.05, stW: 1.25, stH: 0.5, stZ: 0.2 };
    default:
      return { sideX: 0.86, sideY: 0.55, stW: 1.05, stH: 0.45, stZ: 0.25 };
  }
}

export function overlayTextureCacheSize(): number {
  return texCache.size;
}

export function clearOverlayTextureCache(): void {
  for (const tex of texCache.values()) tex.dispose();
  texCache.clear();
}

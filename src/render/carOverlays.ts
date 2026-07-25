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
  paint: string;
  sticker: string;
  /** Stable seed for layout variants (e.g. car id). */
  variant?: string;
  gearClass?: GearClass;
};

const texCache = new Map<string, Texture>();

function outlineCss(): string {
  return ComicPaletteCss.outline;
}

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

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Parallel comic hatching (reference rear bumper / side shade). */
function hatchBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing = 7,
  angle = -0.35,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = outlineCss();
  ctx.lineWidth = 1.35;
  ctx.globalAlpha = 0.55;
  const pad = Math.hypot(w, h);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  for (let i = -pad; i < pad; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, -pad * 0.6);
    ctx.lineTo(i, pad * 0.6);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Short ink speed/scratch marks like the reference paint. */
function speedMarks(ctx: CanvasRenderingContext2D, seed: number, count: number): void {
  ctx.strokeStyle = outlineCss();
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const n = (seed + i * 97) % 1000;
    const x = 40 + (n % 160);
    const y = 70 + ((n * 3) % 40);
    const len = 6 + (n % 10);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Side body: hard cel rim highlight + one crease + sparse scratches.
 * Dense hatch lives on the rear deck (flat), not on curved side planes —
 * floating hatch on spheres looked scribble-y vs the concept reference.
 */
export function sidePanelTexture(paint: string, variant: string): Texture {
  return canvasTex(`side-v4:${paint}:${variant}`, 256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);

    // Soft shade veil — lower band only
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(16, 78, 224, 36);

    // Hard white rim highlight (reference edge light)
    ctx.strokeStyle = "#F8F9FA";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(20, 14);
    ctx.lineTo(236, 10);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // One panel crease
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 2.8;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(18, 70);
    ctx.lineTo(238, 74);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Very few scratches
    speedMarks(ctx, hashSeed(variant + paint), 3);
  });
}

/** Rear engine cover: horizontal louvers + hatch (reference). */
export function rearDeckTexture(): Texture {
  return canvasTex("rear-deck-v3", 256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = "rgba(27,27,31,0.82)";
    ctx.fillRect(28, 34, 200, 62);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 34, 200, 62);

    for (let i = 0; i < 5; i++) {
      const y = 42 + i * 10;
      ctx.fillStyle = i % 2 === 0 ? "rgba(42,42,48,0.95)" : "rgba(18,21,28,0.95)";
      ctx.fillRect(40, y, 176, 6);
      ctx.strokeStyle = outlineCss();
      ctx.lineWidth = 1.5;
      ctx.strokeRect(40, y, 176, 6);
    }

    ctx.strokeStyle = "#F8F9FA";
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(32, 36);
    ctx.lineTo(224, 36);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

/** Hard cel glass glare (flat wedge, not soft gradient). */
export function glassGlareTexture(): Texture {
  return canvasTex("glass-glare-v2", 128, 64, (ctx) => {
    ctx.clearRect(0, 0, 128, 64);
    ctx.fillStyle = "rgba(248,249,250,0.7)";
    ctx.beginPath();
    ctx.moveTo(8, 48);
    ctx.lineTo(42, 10);
    ctx.lineTo(78, 10);
    ctx.lineTo(52, 48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 3;
    ctx.stroke();
    // Second thin highlight
    ctx.fillStyle = "rgba(248,249,250,0.35)";
    ctx.beginPath();
    ctx.moveTo(70, 44);
    ctx.lineTo(92, 14);
    ctx.lineTo(108, 14);
    ctx.lineTo(88, 44);
    ctx.closePath();
    ctx.fill();
  });
}

/** Roof / hood edge highlight strip (replaces muddy racing stripe). */
export function roofEdgeTexture(): Texture {
  return canvasTex("roof-edge-v2", 64, 256, (ctx) => {
    ctx.clearRect(0, 0, 64, 256);
    ctx.fillStyle = "rgba(248,249,250,0.55)";
    ctx.fillRect(22, 12, 10, 232);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 12, 10, 232);
    hatchBand(ctx, 10, 40, 44, 80, 4, 0.9);
  });
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
    ctx.strokeStyle = outlineCss();
    if (sticker === "flames") {
      ctx.fillStyle = "#FF7A18";
      flame(ctx, 48, 108, 58);
      ctx.fillStyle = "#FFE066";
      flame(ctx, 100, 112, 46);
      ctx.fillStyle = "#E03131";
      flame(ctx, 155, 108, 54);
    } else if (sticker === "bolt") {
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

/** @deprecated alias — roof edge highlight replaced racing stripe. */
export function stripeTexture(paint: string, variant: string): Texture {
  void paint;
  void variant;
  return roofEdgeTexture();
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

/** Comic graphic overlays — hatch/highlight language from concept reference. */
export function buildCarOverlays(opts: CarOverlayOpts): Group {
  const g = new Group();
  g.name = "carOverlays";
  const variant = opts.variant ?? opts.paint;
  const gear = opts.gearClass ?? "sport";
  const pickup = gear === "pickup";

  const sideW = pickup ? 2.4 : 2.15;
  const sideH = pickup ? 0.7 : 0.52;
  const sideY = pickup ? 0.72 : 0.55;
  const sideX = pickup ? 0.98 : 0.86;

  const sideL = decal(sidePanelTexture(opts.paint, variant), sideW, sideH, 0.82);
  sideL.position.set(-sideX, sideY, pickup ? 0.15 : 0.08);
  sideL.rotation.y = Math.PI / 2;

  const sideR = decal(sidePanelTexture(opts.paint, variant), sideW, sideH, 0.82);
  sideR.position.set(sideX, sideY, pickup ? 0.15 : 0.08);
  sideR.rotation.y = -Math.PI / 2;
  sideR.rotation.z = Math.PI;

  // Thin roof edge highlight instead of thick racing stripe
  const roof = decal(roofEdgeTexture(), pickup ? 0.22 : 0.18, pickup ? 1.6 : 1.9, 0.55);
  roof.position.set(0, pickup ? 1.72 : 1.22, pickup ? 0.45 : 0.05);
  roof.rotation.x = -Math.PI / 2;

  const rear = decal(rearDeckTexture(), pickup ? 1.5 : 1.25, pickup ? 0.7 : 0.5, 0.9);
  rear.position.set(0, pickup ? 0.95 : 0.7, pickup ? -0.35 : -1.05);
  rear.rotation.x = pickup ? -Math.PI / 2.1 : -Math.PI / 2.35;

  const glare = decal(glassGlareTexture(), pickup ? 1.35 : 1.0, pickup ? 0.55 : 0.42, 0.75);
  glare.position.set(0, pickup ? 1.35 : 1.02, pickup ? 1.0 : 0.2);
  glare.rotation.x = pickup ? -0.2 : -0.4;

  g.add(sideL, sideR, roof, rear, glare);

  const stickerTex = stickerTexture(opts.sticker);
  if (stickerTex) {
    const stW = pickup ? 1.2 : 1.05;
    const stH = pickup ? 0.55 : 0.45;
    const stL = decal(stickerTex, stW, stH, 0.98);
    stL.position.set(-(sideX + 0.02), sideY + 0.02, pickup ? 0.35 : 0.25);
    stL.rotation.y = Math.PI / 2;
    const stR = decal(stickerTex, stW, stH, 0.98);
    stR.position.set(sideX + 0.02, sideY + 0.02, pickup ? 0.35 : 0.25);
    stR.rotation.y = -Math.PI / 2;
    stR.rotation.z = Math.PI;
    g.add(stL, stR);
  }

  return g;
}

export function overlayTextureCacheSize(): number {
  return texCache.size;
}

export function clearOverlayTextureCache(): void {
  for (const tex of texCache.values()) tex.dispose();
  texCache.clear();
}

/** Test helper: side texture uses hatch (opaque ink pixels present). */
export function sideTextureHasInk(paint: string, variant: string): boolean {
  if (typeof document === "undefined") return true;
  const tex = sidePanelTexture(paint, variant) as CanvasTexture;
  const img = tex.image as HTMLCanvasElement | undefined;
  if (!img?.getContext) return true;
  const ctx = img.getContext("2d");
  if (!ctx) return true;
  const data = ctx.getImageData(0, 70, 256, 40).data;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]! < 40 && data[i + 1]! < 40 && data[i + 2]! < 40 && data[i + 3]! > 100) dark++;
  }
  return dark > 80;
}

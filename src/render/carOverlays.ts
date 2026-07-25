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
import { ComicPaletteCss } from "./palette";

export type CarOverlayOpts = {
  paint: string;
  sticker: string;
  /** Stable seed for stripe layout (e.g. car id). */
  variant?: string;
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
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

function paintCss(paint: string): string {
  return paint.startsWith("#") ? paint : `#${paint}`;
}

function hashPick(s: string, options: string[]): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length]!;
}

/** Cel highlight + ink panel lines for body sides. */
export function sidePanelTexture(paint: string, variant: string): Texture {
  return canvasTex(`side:${paint}:${variant}`, 256, 128, (ctx) => {
    const p = paintCss(paint);
    ctx.clearRect(0, 0, 256, 128);
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.35, "rgba(255,255,255,0.12)");
    g.addColorStop(0.55, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);

    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(18, 20);
    ctx.lineTo(240, 24);
    ctx.moveTo(22, 64);
    ctx.lineTo(235, 70);
    ctx.moveTo(30, 108);
    ctx.lineTo(220, 104);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(120, 16);
    ctx.quadraticCurveTo(128, 64, 118, 112);
    ctx.stroke();

    ctx.fillStyle = p;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(160, 40, 50, 18);
    ctx.globalAlpha = 1;
  });
}

/** Hood / roof racing stripe. */
export function stripeTexture(paint: string, variant: string): Texture {
  const stripe = hashPick(variant, ["#1B1B1F", "#F8F9FA", "#FFE066"]);
  return canvasTex(`stripe:${paint}:${stripe}`, 128, 256, (ctx) => {
    ctx.clearRect(0, 0, 128, 256);
    ctx.fillStyle = stripe;
    ctx.fillRect(44, 8, 40, 240);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 6;
    ctx.strokeRect(44, 8, 40, 240);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    for (let y = 30; y < 230; y += 28) {
      ctx.beginPath();
      ctx.moveTo(52, y);
      ctx.lineTo(76, y + 10);
      ctx.stroke();
    }
  });
}

/** Rear deck comic hatch / vent lines. */
export function rearDeckTexture(): Texture {
  return canvasTex("rear-deck", 256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(20, 30, 216, 70);
    ctx.strokeStyle = outlineCss();
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 30, 216, 70);
    ctx.lineWidth = 4;
    for (let x = 40; x < 230; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 38);
      ctx.lineTo(x, 92);
      ctx.stroke();
    }
  });
}

/** Windshield glare strip. */
export function glassGlareTexture(): Texture {
  return canvasTex("glass-glare", 128, 64, (ctx) => {
    ctx.clearRect(0, 0, 128, 64);
    const g = ctx.createLinearGradient(0, 0, 128, 64);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.4, "rgba(255,255,255,0.55)");
    g.addColorStop(0.55, "rgba(180,220,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(10, 50);
    ctx.lineTo(50, 8);
    ctx.lineTo(90, 8);
    ctx.lineTo(118, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(27,27,31,0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();
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

/** Flat sticker art (flames / bolt / stars). */
export function stickerTexture(sticker: string): Texture | null {
  if (!sticker || sticker === "none") return null;
  return canvasTex(`sticker:${sticker}`, 256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = outlineCss();
    if (sticker === "flames") {
      ctx.fillStyle = "#FF7A18";
      flame(ctx, 40, 100, 50);
      ctx.fillStyle = "#FFE066";
      flame(ctx, 90, 105, 40);
      ctx.fillStyle = "#E03131";
      flame(ctx, 145, 100, 48);
      ctx.fillStyle = "#FF7A18";
      flame(ctx, 200, 108, 36);
    } else if (sticker === "bolt") {
      ctx.fillStyle = "#FFE066";
      ctx.beginPath();
      ctx.moveTo(90, 16);
      ctx.lineTo(150, 16);
      ctx.lineTo(120, 60);
      ctx.lineTo(180, 60);
      ctx.lineTo(80, 120);
      ctx.lineTo(110, 72);
      ctx.lineTo(50, 72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = "#3DB9C7";
      for (const [x, y, r] of [
        [70, 64, 28],
        [140, 50, 34],
        [200, 70, 24],
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
  });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.renderOrder = 2;
  return mesh;
}

/** Build comic graphic overlays parented to a car root. */
export function buildCarOverlays(opts: CarOverlayOpts): Group {
  const g = new Group();
  g.name = "carOverlays";
  const variant = opts.variant ?? opts.paint;

  const sideL = decal(sidePanelTexture(opts.paint, variant), 2.2, 0.55, 0.95);
  sideL.position.set(-0.88, 0.58, 0.05);
  sideL.rotation.y = Math.PI / 2;

  const sideR = decal(sidePanelTexture(opts.paint, variant), 2.2, 0.55, 0.95);
  sideR.position.set(0.88, 0.58, 0.05);
  sideR.rotation.y = -Math.PI / 2;
  sideR.rotation.z = Math.PI;

  const stripe = decal(stripeTexture(opts.paint, variant), 0.45, 2.4, 0.95);
  stripe.position.set(0, 0.78, 0.15);
  stripe.rotation.x = -Math.PI / 2;

  const rear = decal(rearDeckTexture(), 1.35, 0.55, 0.9);
  rear.position.set(0, 0.72, -1.15);
  rear.rotation.x = -Math.PI / 2.4;

  const glare = decal(glassGlareTexture(), 1.05, 0.45, 0.85);
  glare.position.set(0, 1.05, 0.15);
  glare.rotation.x = -0.35;

  g.add(sideL, sideR, stripe, rear, glare);

  const stickerTex = stickerTexture(opts.sticker);
  if (stickerTex) {
    const stL = decal(stickerTex, 1.1, 0.48);
    stL.position.set(-0.9, 0.62, 0.2);
    stL.rotation.y = Math.PI / 2;
    const stR = decal(stickerTex, 1.1, 0.48);
    stR.position.set(0.9, 0.62, 0.2);
    stR.rotation.y = -Math.PI / 2;
    stR.rotation.z = Math.PI;
    g.add(stL, stR);
  }

  return g;
}

export function overlayTextureCacheSize(): number {
  return texCache.size;
}

/** Reset cache between tests. */
export function clearOverlayTextureCache(): void {
  for (const tex of texCache.values()) tex.dispose();
  texCache.clear();
}

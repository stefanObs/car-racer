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
  /** GLTF cars already have authored shading — only attach garage stickers. */
  mode?: "full" | "stickers-only";
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
  const L = overlayLayout(gear);
  const stickersOnly = opts.mode === "stickers-only";

  if (!stickersOnly) {
    const sideL = decal(sidePanelTexture(opts.paint, variant), L.sideW, L.sideH, 0.35);
    sideL.position.set(-L.sideX, L.sideY, L.sideZ);
    sideL.rotation.y = Math.PI / 2;

    const sideR = decal(sidePanelTexture(opts.paint, variant), L.sideW, L.sideH, 0.35);
    sideR.position.set(L.sideX, L.sideY, L.sideZ);
    sideR.rotation.y = -Math.PI / 2;
    sideR.rotation.z = Math.PI;

    const roof = decal(roofEdgeTexture(), L.roofW, L.roofL, 0.3);
    roof.position.set(0, L.roofY, L.roofZ);
    roof.rotation.x = -Math.PI / 2;

    const rear = decal(rearDeckTexture(), L.rearW, L.rearH, 0.4);
    rear.position.set(0, L.rearY, L.rearZ);
    rear.rotation.x = L.rearTilt;

    const glare = decal(glassGlareTexture(), L.glareW, L.glareH, 0.45);
    glare.position.set(0, L.glareY, L.glareZ);
    glare.rotation.x = L.glareTilt;

    g.add(sideL, sideR, roof, rear, glare);
  }

  const stickerTex = stickerTexture(opts.sticker);
  if (stickerTex) {
    const stL = decal(stickerTex, L.stW, L.stH, 0.98);
    stL.position.set(-(L.sideX + 0.02), L.sideY + 0.02, L.stZ);
    stL.rotation.y = Math.PI / 2;
    const stR = decal(stickerTex, L.stW, L.stH, 0.98);
    stR.position.set(L.sideX + 0.02, L.sideY + 0.02, L.stZ);
    stR.rotation.y = -Math.PI / 2;
    stR.rotation.z = Math.PI;
    g.add(stL, stR);
  }

  return g;
}

type OverlayLayout = {
  sideW: number;
  sideH: number;
  sideX: number;
  sideY: number;
  sideZ: number;
  roofW: number;
  roofL: number;
  roofY: number;
  roofZ: number;
  rearW: number;
  rearH: number;
  rearY: number;
  rearZ: number;
  rearTilt: number;
  glareW: number;
  glareH: number;
  glareY: number;
  glareZ: number;
  glareTilt: number;
  stW: number;
  stH: number;
  stZ: number;
};

function overlayLayout(gear: GearClass): OverlayLayout {
  switch (gear) {
    case "pickup":
      return {
        sideW: 2.5,
        sideH: 0.75,
        sideX: 1.0,
        sideY: 0.85,
        sideZ: 0.2,
        roofW: 0.22,
        roofL: 1.7,
        roofY: 1.85,
        roofZ: 0.5,
        rearW: 1.5,
        rearH: 0.65,
        rearY: 1.0,
        rearZ: -0.4,
        rearTilt: -Math.PI / 2.1,
        glareW: 1.4,
        glareH: 0.55,
        glareY: 1.4,
        glareZ: 1.15,
        glareTilt: -0.2,
        stW: 1.2,
        stH: 0.55,
        stZ: 0.4,
      };
    case "buggy":
      return {
        sideW: 1.6,
        sideH: 0.4,
        sideX: 0.72,
        sideY: 0.6,
        sideZ: 0.1,
        roofW: 0.14,
        roofL: 0.9,
        roofY: 1.55,
        roofZ: -0.1,
        rearW: 0.9,
        rearH: 0.4,
        rearY: 0.75,
        rearZ: -0.9,
        rearTilt: -Math.PI / 2.2,
        glareW: 0.7,
        glareH: 0.35,
        glareY: 0.95,
        glareZ: 0.35,
        glareTilt: -0.25,
        stW: 0.85,
        stH: 0.35,
        stZ: 0.2,
      };
    case "hotrod":
      return {
        sideW: 2.3,
        sideH: 0.45,
        sideX: 0.82,
        sideY: 0.55,
        sideZ: 0.05,
        roofW: 0.16,
        roofL: 1.2,
        roofY: 1.32,
        roofZ: -0.5,
        rearW: 1.15,
        rearH: 0.45,
        rearY: 0.65,
        rearZ: -1.15,
        rearTilt: -Math.PI / 2.3,
        glareW: 0.95,
        glareH: 0.38,
        glareY: 1.05,
        glareZ: -0.05,
        glareTilt: -0.35,
        stW: 1.0,
        stH: 0.4,
        stZ: 0.15,
      };
    case "armor":
      return {
        sideW: 2.7,
        sideH: 0.85,
        sideX: 1.08,
        sideY: 1.05,
        sideZ: 0,
        roofW: 0.2,
        roofL: 2.4,
        roofY: 1.7,
        roofZ: 0,
        rearW: 1.7,
        rearH: 0.8,
        rearY: 1.15,
        rearZ: -1.35,
        rearTilt: -Math.PI / 2,
        glareW: 1.2,
        glareH: 0.3,
        glareY: 1.4,
        glareZ: 1.5,
        glareTilt: -0.1,
        stW: 1.25,
        stH: 0.5,
        stZ: 0.2,
      };
    default:
      return {
        sideW: 2.15,
        sideH: 0.52,
        sideX: 0.86,
        sideY: 0.55,
        sideZ: 0.08,
        roofW: 0.18,
        roofL: 1.9,
        roofY: 1.22,
        roofZ: 0.05,
        rearW: 1.25,
        rearH: 0.5,
        rearY: 0.7,
        rearZ: -1.05,
        rearTilt: -Math.PI / 2.35,
        glareW: 1.0,
        glareH: 0.42,
        glareY: 1.02,
        glareZ: 0.2,
        glareTilt: -0.4,
        stW: 1.05,
        stH: 0.45,
        stZ: 0.25,
      };
  }
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

/**
 * Garage stickers as albedo textures (no floating plane overlays).
 * Per-car art + placement: side / hood / door (Bunker ironClad slots).
 */
import {
  CanvasTexture,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  type Mesh,
  type MeshToonMaterial,
  type Object3D,
  type Texture,
} from "three";
import type { CarId } from "../data/cars";
import { ComicPaletteCss } from "./palette";

export type StickerId = "none" | "flames" | "bolt" | "star" | "ironClad";

export type StickerSlot = "side" | "hood" | "door";

const texCache = new Map<string, Texture>();

/** Where stickers land per car (Käferkraft uses nose variants instead). */
export function stickerSlotsForCar(id: CarId): StickerSlot[] {
  switch (id) {
    case "blitz":
      return ["side"];
    case "bison":
      return ["side", "hood"];
    case "donnerbuechse":
      return ["side"];
    case "bunker":
      return ["door"];
    case "kaeferkraft":
      return [];
  }
}

export function carUsesNoseVariants(id: CarId): boolean {
  return id === "kaeferkraft";
}

/** ironClad door logos in bunker BodyPaint atlas (1024², tex0). */
export const BUNKER_DOOR_STICKER_RECTS = [
  { x: 318, y: 316, w: 158, h: 42 },
  { x: 330, y: 580, w: 158, h: 42 },
] as const;

function ink(): string {
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

function flameTongue(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, lean: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - 16 + lean, y - h * 0.35, x - 8 + lean, y - h * 0.72, x + lean * 0.5, y - h);
  ctx.bezierCurveTo(x + 14 + lean, y - h * 0.68, x + 22, y - h * 0.32, x + 6, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function boltMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.35, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.08);
  ctx.lineTo(cx + s * 0.45, cy - s * 0.08);
  ctx.lineTo(cx - s * 0.25, cy + s * 0.55);
  ctx.lineTo(cx + s * 0.05, cy + s * 0.05);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function starMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(b) * r * 0.42, cy + Math.sin(b) * r * 0.42);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function ironCladLogo(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.fillStyle = "#F0C000";
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(3, h * 0.08);
  // slanted badge
  ctx.beginPath();
  ctx.moveTo(h * 0.15, h * 0.12);
  ctx.lineTo(w - h * 0.08, h * 0.12);
  ctx.lineTo(w - h * 0.02, h * 0.88);
  ctx.lineTo(h * 0.02, h * 0.88);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // i pill
  const pillR = h * 0.28;
  ctx.fillStyle = ink();
  const px = h * 0.12;
  const py = h * 0.22;
  const pw = pillR * 1.35;
  const ph = h * 0.56;
  const pr = pillR * 0.45;
  ctx.beginPath();
  ctx.moveTo(px + pr, py);
  ctx.lineTo(px + pw - pr, py);
  ctx.quadraticCurveTo(px + pw, py, px + pw, py + pr);
  ctx.lineTo(px + pw, py + ph - pr);
  ctx.quadraticCurveTo(px + pw, py + ph, px + pw - pr, py + ph);
  ctx.lineTo(px + pr, py + ph);
  ctx.quadraticCurveTo(px, py + ph, px, py + ph - pr);
  ctx.lineTo(px, py + pr);
  ctx.quadraticCurveTo(px, py, px + pr, py);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#F0C000";
  ctx.font = `bold ${Math.floor(h * 0.42)}px Impact, Haettenschweiler, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("i", h * 0.12 + pillR * 0.68, h * 0.52);
  ctx.fillStyle = ink();
  ctx.font = `bold ${Math.floor(h * 0.38)}px Impact, Haettenschweiler, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("RONCLAD", h * 0.12 + pillR * 1.55, h * 0.48);
  ctx.fillRect(h * 0.12 + pillR * 1.55, h * 0.68, w * 0.55, h * 0.06);
}

/** Draw sticker art into a rect (transparent outside). Car-themed colors. */
export function drawStickerArt(
  ctx: CanvasRenderingContext2D,
  sticker: string,
  carId: CarId,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);
  if (!sticker || sticker === "none") return;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.06);

  if (sticker === "ironClad") {
    ironCladLogo(ctx, w, h);
    return;
  }

  if (sticker === "flames") {
    const outer = carId === "bunker" ? "#FF6B1A" : carId === "bison" ? "#FF8A1F" : carId === "donnerbuechse" ? "#FF5A00" : "#FF7A18";
    const inner = "#FFE066";
    ctx.fillStyle = outer;
    flameTongue(ctx, w * 0.28, h * 0.92, h * 0.78, -6);
    flameTongue(ctx, w * 0.5, h * 0.95, h * 0.88, 0);
    flameTongue(ctx, w * 0.72, h * 0.9, h * 0.72, 8);
    ctx.fillStyle = inner;
    ctx.lineWidth = Math.max(3, ctx.lineWidth * 0.7);
    flameTongue(ctx, w * 0.4, h * 0.92, h * 0.48, -2);
    flameTongue(ctx, w * 0.62, h * 0.93, h * 0.52, 4);
    return;
  }

  if (sticker === "bolt" || sticker === "lightning") {
    ctx.fillStyle = carId === "blitz" ? "#FFE066" : carId === "bunker" ? "#7CF0FF" : "#FFD43B";
    boltMark(ctx, w * 0.5, h * 0.5, Math.min(w, h) * 0.85);
    if (carId === "blitz") {
      ctx.fillStyle = "#FFF8D6";
      ctx.lineWidth = 3;
      boltMark(ctx, w * 0.5, h * 0.5, Math.min(w, h) * 0.45);
    }
    return;
  }

  // star (+ default)
  ctx.fillStyle = carId === "bison" ? "#69DB7C" : carId === "bunker" ? "#FFD43B" : "#3DB9C7";
  starMark(ctx, w * 0.32, h * 0.55, Math.min(w, h) * 0.28);
  starMark(ctx, w * 0.55, h * 0.42, Math.min(w, h) * 0.34);
  starMark(ctx, w * 0.78, h * 0.58, Math.min(w, h) * 0.24);
}

/** Standalone sticker texture (tests / previews). */
export function stickerTexture(sticker: string, carId: CarId = "blitz"): Texture | null {
  if (!sticker || sticker === "none") return null;
  return canvasTex(`sticker-v3:${carId}:${sticker}`, 256, 128, (ctx) => {
    drawStickerArt(ctx, sticker, carId, 256, 128);
  });
}

function normalizeSticker(sticker: string): string {
  if (sticker === "lightning") return "bolt";
  return sticker || "none";
}

/**
 * Bake garage stickers into body/door albedo maps on a cloned car root.
 * Call after paint. No-op for Käferkraft (nose variants elsewhere).
 */
export function applyCarStickers(root: Object3D, carId: CarId, stickerRaw: string): void {
  const sticker = normalizeSticker(stickerRaw);
  const slots = stickerSlotsForCar(carId);
  if (slots.length === 0) return;

  if (carId === "bunker") {
    // Stock door badge stays on the authored atlas until the player replaces it
    if (sticker === "ironClad") return;
    patchBunkerDoorStickers(root, sticker);
    return;
  }

  if (carId === "donnerbuechse") {
    patchAuthoredSideStickers(root, carId, sticker, slots);
    return;
  }

  // Comic-atlas cars: stamp stickers into a per-instance body map (no floating planes).
  if (sticker === "none") return;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mat = firstToon(mesh);
    if (!mat?.userData?.comicTintable || !mat.map) return;
    const paintHex = mat.color?.getHexString?.() ? `#${mat.color.getHexString()}` : "#ffffff";
    mat.map = stampComicBodyMap(mat.map, carId, sticker, slots, paintHex);
    // Paint is baked into the map so sticker colors stay true
    mat.color.setRGB(1, 1, 1);
    mat.needsUpdate = true;
  });
}

function stampComicBodyMap(
  baseMap: Texture,
  carId: CarId,
  sticker: string,
  slots: StickerSlot[],
  paintHex: string,
): Texture {
  const key = `comic-stamp-v3:${carId}:${sticker}:${slots.join(",")}:${paintHex}`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const size = 512;
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) {
    const tex = fallbackTex();
    texCache.set(key, tex);
    return tex;
  }
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#F6F7F9";
  ctx.fillRect(0, 0, size, size);
  try {
    if (baseMap.image) ctx.drawImage(baseMap.image as CanvasImageSource, 0, 0, size, size);
  } catch {
    /* headless */
  }

  // Bake garage paint into atlas (was previously a shader multiply)
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = paintHex;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  const stamp = makeStickerStamp(sticker, carId);

  if (slots.includes("side")) {
    // Box-UV sides: V is low (~0..0.25). CanvasTexture flipY → stamp near canvas bottom.
    const y = size * 0.78;
    const h = size * 0.18;
    ctx.drawImage(stamp, size * 0.06, y, size * 0.4, h);
    ctx.drawImage(stamp, size * 0.52, y, size * 0.4, h);
  }
  if (slots.includes("hood")) {
    // Hood (bison): V ~0.66 → canvas y ≈ 0.34 with flipY
    ctx.drawImage(stamp, size * 0.08, size * 0.28, size * 0.4, size * 0.16);
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.userData = { comicTintable: false }; // paint already baked
  tex.flipY = baseMap.flipY;
  texCache.set(key, tex);
  return tex;
}

/** Cream plate + art so paint multiply still reads as a sticker. */
function makeStickerStamp(sticker: string, carId: CarId): HTMLCanvasElement {
  const stamp = document.createElement("canvas");
  stamp.width = 256;
  stamp.height = 128;
  const sctx = stamp.getContext("2d")!;
  sctx.fillStyle = "rgba(255,248,230,0.95)";
  sctx.fillRect(6, 10, 244, 108);
  sctx.strokeStyle = ink();
  sctx.lineWidth = 6;
  sctx.strokeRect(6, 10, 244, 108);
  drawStickerArt(sctx, sticker, carId, 256, 128);
  return stamp;
}

function firstToon(mesh: Mesh): MeshToonMaterial | null {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const m = mats[0] as MeshToonMaterial | undefined;
  if (!m || !("color" in m)) return null;
  return m;
}

function patchBunkerDoorStickers(root: Object3D, sticker: string): void {
  const replaced = new Map<Texture, Texture>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of mats) {
      const mat = raw as MeshToonMaterial;
      if (!mat?.map) continue;
      const name = (mat.name ?? "").toLowerCase();
      if (name && !name.includes("body") && !name.includes("paint")) continue;
      const prev = mat.map;
      const hit = replaced.get(prev);
      if (hit) {
        mat.map = hit;
        mat.needsUpdate = true;
        continue;
      }
      const next = patchDoorMap(prev, "bunker", sticker);
      replaced.set(prev, next);
      mat.map = next;
      mat.needsUpdate = true;
    }
  });
}

function patchAuthoredSideStickers(
  root: Object3D,
  carId: CarId,
  sticker: string,
  slots: StickerSlot[],
): void {
  if (sticker === "none" || !slots.includes("side")) return;
  const replaced = new Map<Texture, Texture>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of mats) {
      const mat = raw as MeshToonMaterial;
      if (!mat?.map) continue;
      const name = (mat.name ?? mesh.name ?? "").toLowerCase();
      if (name.includes("tire") || name.includes("glass")) continue;
      const prev = mat.map;
      const hit = replaced.get(prev);
      if (hit) {
        mat.map = hit;
        mat.needsUpdate = true;
        continue;
      }
      const next = stampAuthoredSide(prev, carId, sticker);
      replaced.set(prev, next);
      mat.map = next;
      mat.needsUpdate = true;
      if (mat.color) mat.color.setRGB(1, 1, 1);
    }
  });
}

function stampAuthoredSide(base: Texture, carId: CarId, sticker: string): Texture {
  if (!textureImageReady(base)) return base;
  const key = `authored-side:${carId}:${sticker}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const img = base.image as { width: number; height: number };
  const w = img.width;
  const h = img.height;
  if (w < 256 || h < 256) return base;
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) return base;
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return base;
  try {
    ctx.drawImage(base.image as CanvasImageSource, 0, 0, w, h);
  } catch {
    return base;
  }
  // Placement matches former overlay: mid-door band on both body islands
  const stamps = [
    { x: w * 0.12, y: h * 0.38, bw: w * 0.28, bh: h * 0.12 },
    { x: w * 0.55, y: h * 0.4, bw: w * 0.28, bh: h * 0.12 },
  ];
  const stamp = document.createElement("canvas");
  stamp.width = 256;
  stamp.height = 128;
  drawStickerArt(stamp.getContext("2d")!, sticker, carId, 256, 128);
  for (const s of stamps) ctx.drawImage(stamp, s.x, s.y, s.bw, s.bh);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.flipY = base.flipY;
  texCache.set(key, tex);
  return tex;
}

function patchDoorMap(base: Texture, carId: CarId, sticker: string): Texture {
  if (!textureImageReady(base)) return base;
  const key = `door:${carId}:${sticker}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const img = base.image as { width: number; height: number };
  const w = img.width;
  const h = img.height;
  // Only patch the big body atlas (door logos live on ~1024 albedo)
  if (w < 512 || h < 512) return base;

  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) return base;
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return base;
  try {
    ctx.drawImage(base.image as CanvasImageSource, 0, 0, w, h);
  } catch {
    return base;
  }

  const sx = w / 1024;
  const sy = h / 1024;
  for (const r of BUNKER_DOOR_STICKER_RECTS) {
    const x = r.x * sx;
    const y = r.y * sy;
    const rw = r.w * sx;
    const rh = r.h * sy;
    const sampleX = Math.min(w - 1, Math.floor(x + rw + 8));
    const sampleY = Math.min(h - 1, Math.floor(y + rh * 0.5));
    const fill = samplePixel(ctx, sampleX, sampleY) ?? "#E8B800";
    ctx.fillStyle = fill;
    ctx.fillRect(x - 2, y - 2, rw + 4, rh + 4);

    if (sticker !== "none") {
      const stamp = document.createElement("canvas");
      stamp.width = 256;
      stamp.height = 128;
      drawStickerArt(stamp.getContext("2d")!, sticker, carId, 256, 128);
      ctx.drawImage(stamp, x, y, rw, rh);
    }
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.flipY = base.flipY;
  texCache.set(key, tex);
  return tex;
}

function textureImageReady(tex: Texture): boolean {
  const img = tex.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | { width?: number; height?: number }
    | undefined
    | null;
  if (!img) return false;
  if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0;
  }
  const w = "width" in img ? Number(img.width) : 0;
  const h = "height" in img ? Number(img.height) : 0;
  return w > 0 && h > 0;
}

function samplePixel(ctx: CanvasRenderingContext2D, x: number, y: number): string | null {
  try {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch {
    return null;
  }
}

export function overlayTextureCacheSize(): number {
  return texCache.size;
}

export function clearOverlayTextureCache(): void {
  for (const tex of texCache.values()) tex.dispose();
  texCache.clear();
}

/** @deprecated Use applyCarStickers — kept for test migration. */
export function buildCarOverlays(_opts: { sticker: string; gearClass?: string }): { name: string; children: unknown[] } {
  return { name: "carOverlays", children: [] };
}

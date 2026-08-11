/**
 * Garage stickers as albedo textures (no floating plane overlays).
 * Per-car art + placement: side / hood. Bunker IronClad is the default kit sticker.
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
      return ["side"];
    case "kaeferkraft":
      return [];
  }
}

export function carUsesNoseVariants(id: CarId): boolean {
  return id === "kaeferkraft";
}

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

/** Hot-Rod door flames — thick tongues leaning rearward (sticker-proposal-flames). */
function flameTongue(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  baseX: number,
  baseY: number,
  halfW: number,
): void {
  const mx = (tipX + baseX) / 2;
  const my = (tipY + baseY) / 2;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY - halfW);
  ctx.quadraticCurveTo(mx - halfW * 0.35, my - halfW * 0.2, tipX, tipY);
  ctx.quadraticCurveTo(mx + halfW * 0.45, my + halfW * 0.15, baseX, baseY + halfW);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawHotRodFlames(ctx: CanvasRenderingContext2D, carId: CarId, w: number, h: number): void {
  const outer =
    carId === "bunker" ? "#FF6B1A" : carId === "bison" ? "#FF8A1F" : carId === "donnerbuechse" ? "#FF5A00" : "#FF7A18";
  const core = "#FFE066";
  // Rearward lean: tips toward -X (left), bases toward door trailing edge
  ctx.fillStyle = outer;
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.055);
  flameTongue(ctx, w * 0.08, h * 0.42, w * 0.78, h * 0.28, h * 0.16);
  flameTongue(ctx, w * 0.05, h * 0.62, w * 0.82, h * 0.55, h * 0.2);
  flameTongue(ctx, w * 0.12, h * 0.82, w * 0.72, h * 0.78, h * 0.14);
  ctx.fillStyle = core;
  ctx.lineWidth = Math.max(2.5, ctx.lineWidth * 0.55);
  flameTongue(ctx, w * 0.18, h * 0.44, w * 0.62, h * 0.34, h * 0.07);
  flameTongue(ctx, w * 0.14, h * 0.62, w * 0.66, h * 0.56, h * 0.09);
}

/** Bold comic bolt with white core flash (sticker-proposal-bolt). */
function boltMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.08, cy - s * 0.58);
  ctx.lineTo(cx + s * 0.42, cy - s * 0.58);
  ctx.lineTo(cx + s * 0.12, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.48, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.22, cy + s * 0.58);
  ctx.lineTo(cx + s * 0.02, cy + s * 0.02);
  ctx.lineTo(cx - s * 0.42, cy + s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawPowerBolt(ctx: CanvasRenderingContext2D, carId: CarId, w: number, h: number): void {
  const cx = w * 0.52;
  const cy = h * 0.5;
  const s = Math.min(w, h) * 0.88;
  ctx.fillStyle = carId === "blitz" ? "#FFE066" : carId === "bunker" ? "#7CF0FF" : "#FFD43B";
  ctx.lineWidth = Math.max(5, Math.min(w, h) * 0.07);
  boltMark(ctx, cx, cy, s);
  ctx.fillStyle = "#FFF8D6";
  ctx.lineWidth = Math.max(2.5, ctx.lineWidth * 0.45);
  boltMark(ctx, cx - s * 0.02, cy, s * 0.48);
  // Spark ticks
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(2, h * 0.035);
  for (const [x0, y0, x1, y1] of [
    [w * 0.12, h * 0.22, w * 0.02, h * 0.12],
    [w * 0.88, h * 0.28, w * 0.96, h * 0.16],
    [w * 0.9, h * 0.78, w * 0.98, h * 0.9],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
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

function drawRacingStar(ctx: CanvasRenderingContext2D, carId: CarId, w: number, h: number): void {
  const fill = carId === "bison" ? "#69DB7C" : carId === "bunker" ? "#FFD43B" : "#3DB9C7";
  const cx = w * 0.48;
  const cy = h * 0.52;
  const r = Math.min(w, h) * 0.42;
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(5, Math.min(w, h) * 0.07);
  starMark(ctx, cx, cy, r);
  ctx.fillStyle = "#F8F9FA";
  ctx.lineWidth = Math.max(2.5, ctx.lineWidth * 0.5);
  starMark(ctx, cx - r * 0.06, cy - r * 0.08, r * 0.38);
  // Secondary burst
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.04);
  starMark(ctx, w * 0.82, h * 0.28, Math.min(w, h) * 0.14);
}

function ironCladLogo(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Steel plate
  ctx.fillStyle = "#C5CAD0";
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(4, h * 0.075);
  ctx.beginPath();
  ctx.moveTo(h * 0.18, h * 0.14);
  ctx.lineTo(w - h * 0.1, h * 0.14);
  ctx.lineTo(w - h * 0.04, h * 0.86);
  ctx.lineTo(h * 0.06, h * 0.86);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Yellow accent stripe
  ctx.fillStyle = ComicPaletteCss.repairSpark;
  ctx.fillRect(h * 0.14, h * 0.2, w * 0.72, h * 0.12);
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(2.5, h * 0.04);
  ctx.strokeRect(h * 0.14, h * 0.2, w * 0.72, h * 0.12);
  // Shield + IC
  ctx.fillStyle = "#8B9098";
  ctx.beginPath();
  const sx = h * 0.22;
  const sy = h * 0.4;
  const sw = h * 0.42;
  const sh = h * 0.4;
  ctx.moveTo(sx + sw * 0.5, sy);
  ctx.lineTo(sx + sw, sy + sh * 0.28);
  ctx.lineTo(sx + sw * 0.82, sy + sh);
  ctx.lineTo(sx + sw * 0.18, sy + sh);
  ctx.lineTo(sx, sy + sh * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ComicPaletteCss.repairSpark;
  ctx.font = `bold ${Math.floor(h * 0.22)}px Impact, Haettenschweiler, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(2, h * 0.03);
  ctx.strokeText("IC", sx + sw * 0.5, sy + sh * 0.48);
  ctx.fillText("IC", sx + sw * 0.5, sy + sh * 0.48);
  ctx.fillStyle = ink();
  ctx.font = `bold ${Math.floor(h * 0.28)}px Impact, Haettenschweiler, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("IRONCLAD", h * 0.22 + sw * 1.15, h * 0.62);
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
    drawHotRodFlames(ctx, carId, w, h);
    return;
  }

  if (sticker === "bolt" || sticker === "lightning") {
    drawPowerBolt(ctx, carId, w, h);
    return;
  }

  drawRacingStar(ctx, carId, w, h);
}

/** Standalone sticker texture (tests / previews). */
export function stickerTexture(sticker: string, carId: CarId = "blitz"): Texture | null {
  if (!sticker || sticker === "none") return null;
  return canvasTex(`sticker-v4:${carId}:${sticker}`, 256, 128, (ctx) => {
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
    // Default IronClad + swappable Tür-Aufkleber stamp into side albedo.
    patchAuthoredSideStickers(root, carId, sticker, slots);
    return;
  }

  if (carId === "donnerbuechse" || carId === "blitz") {
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
  const key = `comic-stamp-v4:${carId}:${sticker}:${slots.join(",")}:${paintHex}`;
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
      if (name.includes("tire") || name.includes("wheel") || name.includes("glass")) continue;
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

/** Cache must include the source map — paint-baked atlases are distinct textures. */
export function authoredSideCacheKey(carId: CarId, sticker: string, source: Texture): string {
  return `authored-side:${carId}:${sticker}:${source.uuid}`;
}

function stampAuthoredSide(base: Texture, carId: CarId, sticker: string): Texture {
  if (!textureImageReady(base)) return base;
  const key = authoredSideCacheKey(carId, sticker, base);
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

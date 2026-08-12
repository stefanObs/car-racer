/**
 * Garage stickers as Asphalt-Comic decals projected onto the body (CONCEPT §6.2).
 * Tripo atlases pack chaotically — UV stamps miss doors. DecalGeometry lands on
 * Seite / Motorhaube / Tür. Käferkraft uses nose variants instead.
 */
import {
  CanvasTexture,
  DataTexture,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  Vector3,
  type Object3D,
  type Texture,
} from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import type { CarId } from "../data/cars";
import { ComicPaletteCss } from "./palette";

export type StickerId = "none" | "flames" | "bolt" | "star" | "ironClad";

export type StickerSlot = "side" | "hood" | "door";

export const CAR_STICKERS_GROUP = "carStickers";

const texCache = new Map<string, Texture>();

/** Concept-matched Flammen sprite (`public/stickers/flames-donner.png`). */
let flameSprite: HTMLImageElement | null = null;
let flameSpritePromise: Promise<void> | null = null;

export function preloadFlameSticker(): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  if (flameSpritePromise) return flameSpritePromise;
  flameSpritePromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      flameSprite = img;
      // Drop cached flame textures so the next paint uses the sprite.
      for (const key of [...texCache.keys()]) {
        if (key.includes(":flames")) texCache.delete(key);
      }
      resolve();
    };
    img.onerror = () => {
      console.warn("[stickers] flames-donner.png missing — vector fallback");
      resolve();
    };
    img.src = "/stickers/flames-donner.png";
  });
  return flameSpritePromise;
}

type DecalAnchor = {
  slot: StickerSlot;
  x: number;
  y: number;
  z: number;
  /** Projector Euler (looks into the panel). */
  yaw: number;
  pitch?: number;
  width: number;
  height: number;
  /** Projection thickness through the panel. */
  depth?: number;
  mirrorU?: boolean;
};

/** Local anchors on the car clone (nose +Z). Projector yaw faces into the body. */
export const STICKER_DECALS: Record<Exclude<CarId, "kaeferkraft">, DecalAnchor[]> = {
  // Side trail needs horizontal room (nose → door cluster).
  blitz: [
    { slot: "side", x: 0.78, y: 0.5, z: 0.15, yaw: Math.PI / 2, width: 1.35, height: 0.48, depth: 0.4, mirrorU: true },
    { slot: "side", x: -0.78, y: 0.5, z: 0.15, yaw: -Math.PI / 2, width: 1.35, height: 0.48, depth: 0.4 },
  ],
  bison: [
    { slot: "side", x: 0.74, y: 0.78, z: 0.25, yaw: Math.PI / 2, width: 1.25, height: 0.48, depth: 0.42, mirrorU: true },
    { slot: "side", x: -0.74, y: 0.78, z: 0.25, yaw: -Math.PI / 2, width: 1.25, height: 0.48, depth: 0.42 },
    { slot: "hood", x: 0, y: 1.08, z: 0.65, yaw: 0, pitch: -Math.PI / 2, width: 0.75, height: 0.34, depth: 0.35 },
  ],
  donnerbuechse: [
    // Door panel — concept flames span most of the cabin side.
    { slot: "side", x: 1.0, y: 0.82, z: 0.0, yaw: Math.PI / 2, width: 1.9, height: 0.85, depth: 0.75, mirrorU: true },
    { slot: "side", x: -1.0, y: 0.82, z: 0.0, yaw: -Math.PI / 2, width: 1.9, height: 0.85, depth: 0.75 },
  ],
  bunker: [
    { slot: "door", x: 0.95, y: 1.05, z: 0.45, yaw: Math.PI / 2, width: 1.15, height: 0.48, depth: 0.42, mirrorU: true },
    { slot: "door", x: -0.95, y: 1.05, z: 0.45, yaw: -Math.PI / 2, width: 1.15, height: 0.48, depth: 0.42 },
  ],
};

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

/** Racepool99 brand red — track outlines / logo accent on racepool99.de. */
const RACEPOOL_RED = "#E63212";

/** Donnerbüchse concept flame orange (sampled from donnerbuechse-concept-3q). */
const DONNER_FLAME_ORANGE = "#CB4C01";

/**
 * Hotrod door flames matching `donnerbuechse-concept-3q.png`.
 * Prefers the baked concept sprite; falls back to a vector silhouette.
 */
function drawHotRodFlames(ctx: CanvasRenderingContext2D, _carId: CarId, w: number, h: number): void {
  if (flameSprite && flameSprite.complete && flameSprite.naturalWidth > 0) {
    ctx.drawImage(flameSprite, 0, 0, w, h);
    return;
  }

  ctx.fillStyle = DONNER_FLAME_ORANGE;
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(3.5, Math.min(w, h) * 0.045);
  ctx.beginPath();
  // Nose scallop (left) → aft tongues (right).
  ctx.moveTo(w * 0.14, h * 0.2);
  ctx.quadraticCurveTo(w * 0.06, h * 0.22, w * 0.04, h * 0.34);
  ctx.quadraticCurveTo(w * 0.1, h * 0.42, w * 0.18, h * 0.44);
  ctx.quadraticCurveTo(w * 0.1, h * 0.5, w * 0.05, h * 0.58);
  ctx.quadraticCurveTo(w * 0.08, h * 0.72, w * 0.16, h * 0.78);
  ctx.quadraticCurveTo(w * 0.22, h * 0.82, w * 0.28, h * 0.8);
  ctx.bezierCurveTo(w * 0.42, h * 0.82, w * 0.55, h * 0.88, w * 0.68, h * 0.86);
  ctx.quadraticCurveTo(w * 0.74, h * 0.85, w * 0.72, h * 0.78);
  ctx.quadraticCurveTo(w * 0.62, h * 0.76, w * 0.52, h * 0.72);
  ctx.bezierCurveTo(w * 0.62, h * 0.7, w * 0.78, h * 0.72, w * 0.9, h * 0.68);
  ctx.quadraticCurveTo(w * 0.96, h * 0.66, w * 0.94, h * 0.58);
  ctx.quadraticCurveTo(w * 0.82, h * 0.58, w * 0.7, h * 0.56);
  ctx.bezierCurveTo(w * 0.82, h * 0.52, w * 0.94, h * 0.48, w * 0.98, h * 0.4);
  ctx.quadraticCurveTo(w * 0.99, h * 0.34, w * 0.92, h * 0.32);
  ctx.quadraticCurveTo(w * 0.8, h * 0.34, w * 0.66, h * 0.36);
  ctx.bezierCurveTo(w * 0.78, h * 0.28, w * 0.88, h * 0.18, w * 0.86, h * 0.12);
  ctx.quadraticCurveTo(w * 0.84, h * 0.08, w * 0.76, h * 0.1);
  ctx.bezierCurveTo(w * 0.6, h * 0.14, w * 0.42, h * 0.18, w * 0.3, h * 0.2);
  ctx.quadraticCurveTo(w * 0.22, h * 0.2, w * 0.14, h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Garage “Blitz” decal: shooting-star trail like classic side vinyl
 * (small stars toward the nose → large cutout-star cluster aft).
 * White fill + comic ink outline for Asphalt-Comic readability.
 */
function drawPowerBolt(ctx: CanvasRenderingContext2D, _carId: CarId, w: number, h: number): void {
  const inkCol = ink();
  const fillCol = "#F8F9FA";

  const paintStar = (cx: number, cy: number, r: number, line = Math.max(2, r * 0.18)): void => {
    ctx.fillStyle = fillCol;
    ctx.strokeStyle = inkCol;
    ctx.lineWidth = line;
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
  };

  // Sparse trail — nose / left (matches vinyl: tiny stars leading into the cluster).
  const trail: Array<[number, number, number]> = [
    [0.06, 0.42, 0.028],
    [0.1, 0.58, 0.022],
    [0.12, 0.28, 0.02],
    [0.16, 0.48, 0.036],
    [0.18, 0.68, 0.018],
    [0.22, 0.34, 0.03],
    [0.24, 0.55, 0.042],
    [0.28, 0.72, 0.024],
    [0.3, 0.4, 0.034],
    [0.34, 0.58, 0.05],
    [0.36, 0.26, 0.028],
    [0.4, 0.48, 0.055],
    [0.42, 0.7, 0.032],
    [0.46, 0.36, 0.04],
    [0.48, 0.6, 0.062],
    [0.52, 0.44, 0.048],
    [0.54, 0.72, 0.036],
    [0.58, 0.32, 0.055],
    [0.6, 0.55, 0.07],
    [0.64, 0.68, 0.045],
  ];
  for (const [nx, ny, nr] of trail) {
    paintStar(w * nx, h * ny, Math.min(w, h) * nr, Math.max(1.5, Math.min(w, h) * nr * 0.2));
  }

  // Aft cluster — overlapping medium stars around the hero cutout star.
  const cluster: Array<[number, number, number]> = [
    [0.7, 0.28, 0.09],
    [0.68, 0.72, 0.08],
    [0.78, 0.78, 0.1],
    [0.88, 0.62, 0.085],
    [0.86, 0.3, 0.075],
    [0.74, 0.5, 0.095],
  ];
  for (const [nx, ny, nr] of cluster) {
    paintStar(w * nx, h * ny, Math.min(w, h) * nr, Math.max(2.5, Math.min(w, h) * nr * 0.16));
  }

  // Hero star with smaller star cut-out (vinyl look).
  const hx = w * 0.8;
  const hy = h * 0.48;
  const outer = Math.min(w, h) * 0.22;
  const inner = outer * 0.42;
  ctx.fillStyle = fillCol;
  ctx.strokeStyle = inkCol;
  ctx.lineWidth = Math.max(3, outer * 0.12);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(hx + Math.cos(a) * outer, hy + Math.sin(a) * outer);
    else ctx.lineTo(hx + Math.cos(a) * outer, hy + Math.sin(a) * outer);
    ctx.lineTo(hx + Math.cos(b) * outer * 0.42, hy + Math.sin(b) * outer * 0.42);
  }
  ctx.closePath();
  // Inner hole (same orientation, slightly smaller).
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(hx + Math.cos(a) * inner, hy + Math.sin(a) * inner);
    else ctx.lineTo(hx + Math.cos(a) * inner, hy + Math.sin(a) * inner);
    ctx.lineTo(hx + Math.cos(b) * inner * 0.42, hy + Math.sin(b) * inner * 0.42);
  }
  ctx.closePath();
  ctx.fill("evenodd");
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(hx + Math.cos(a) * outer, hy + Math.sin(a) * outer);
    else ctx.lineTo(hx + Math.cos(a) * outer, hy + Math.sin(a) * outer);
    ctx.lineTo(hx + Math.cos(b) * outer * 0.42, hy + Math.sin(b) * outer * 0.42);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(hx + Math.cos(a) * inner, hy + Math.sin(a) * inner);
    else ctx.lineTo(hx + Math.cos(a) * inner, hy + Math.sin(a) * inner);
    ctx.lineTo(hx + Math.cos(b) * inner * 0.42, hy + Math.sin(b) * inner * 0.42);
  }
  ctx.closePath();
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

/** Racepool99 flat vector look (#E63212 track-outline red) as racing stars. */
function drawRacingStar(ctx: CanvasRenderingContext2D, _carId: CarId, w: number, h: number): void {
  ctx.fillStyle = RACEPOOL_RED;
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.055);
  starMark(ctx, w * 0.42, h * 0.52, Math.min(w, h) * 0.4);
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.04);
  starMark(ctx, w * 0.78, h * 0.32, Math.min(w, h) * 0.16);
  starMark(ctx, w * 0.82, h * 0.72, Math.min(w, h) * 0.11);
}

function ironCladLogo(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
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
  ctx.fillStyle = ComicPaletteCss.repairSpark;
  ctx.fillRect(h * 0.14, h * 0.2, w * 0.72, h * 0.12);
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(2.5, h * 0.04);
  ctx.strokeRect(h * 0.14, h * 0.2, w * 0.72, h * 0.12);
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

/** Standalone sticker texture (tests / previews / decals). */
export function stickerTexture(sticker: string, carId: CarId = "blitz"): Texture | null {
  if (!sticker || sticker === "none") return null;
  return canvasTex(`sticker-v9:${carId}:${sticker}`, 512, 256, (ctx) => {
    ctx.clearRect(0, 0, 512, 256);
    drawStickerArt(ctx, sticker, carId, 512, 256);
  });
}

function normalizeSticker(sticker: string): string {
  if (sticker === "lightning") return "bolt";
  return sticker || "none";
}

function clearStickerDecals(root: Object3D): void {
  root.getObjectByName(CAR_STICKERS_GROUP)?.removeFromParent();
}

/** Largest tintable body mesh — Tripo cars are usually a single BodyPaint shell. */
export function findBodyMeshForStickers(root: Object3D): Mesh | null {
  let best: Mesh | null = null;
  let bestScore = 0;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.name.startsWith("stickerDecal") || mesh.userData.outlineShell) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const name = ((mats[0] as { name?: string })?.name ?? mesh.name ?? "").toLowerCase();
    if (
      name.includes("tire") ||
      name.includes("wheel") ||
      name.includes("glass") ||
      name.includes("chrome") ||
      name.includes("skull")
    ) {
      return;
    }
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const r = mesh.geometry.boundingSphere?.radius ?? 0;
    const paintBoost = name.includes("paint") || name.includes("body") || name.includes("atlas") ? 2 : 1;
    const score = r * paintBoost;
    if (score > bestScore) {
      bestScore = score;
      best = mesh;
    }
  });
  return best;
}

function mountStickerDecals(root: Object3D, carId: Exclude<CarId, "kaeferkraft">, sticker: string): void {
  clearStickerDecals(root);
  if (sticker === "none") return;

  const tex = stickerTexture(sticker, carId);
  if (!tex) return;

  root.updateMatrixWorld(true);
  const body = findBodyMeshForStickers(root);
  if (!body) {
    console.warn(`[stickers] no body mesh for ${carId}`);
    return;
  }
  body.updateMatrixWorld(true);

  const group = new Group();
  group.name = CAR_STICKERS_GROUP;
  group.userData.carStickers = sticker;

  const anchors = STICKER_DECALS[carId];
  const invRoot = root.matrixWorld.clone().invert();

  anchors.forEach((anchor, i) => {
    const worldPos = new Vector3(anchor.x, anchor.y, anchor.z).applyMatrix4(root.matrixWorld);
    const orientation = new Euler(anchor.pitch ?? 0, anchor.yaw, 0, "YXZ");
    const size = new Vector3(anchor.width, anchor.height, anchor.depth ?? 0.5);
    let geo: DecalGeometry;
    try {
      geo = new DecalGeometry(body, worldPos, orientation, size);
    } catch (err) {
      console.warn(`[stickers] DecalGeometry failed ${carId} ${anchor.slot}`, err);
      return;
    }
    if (!geo.getAttribute("position") || geo.getAttribute("position")!.count < 3) {
      geo.dispose();
      return;
    }
    geo.applyMatrix4(invRoot);

    const map = tex.clone();
    map.needsUpdate = true;
    if (anchor.mirrorU) {
      map.wrapS = tex.wrapS;
      map.repeat.x = -1;
      map.offset.x = 1;
    }

    const mat = new MeshBasicMaterial({
      map,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      toneMapped: false,
    });
    mat.name = `StickerDecal-${sticker}`;
    const mesh = new Mesh(geo, mat);
    mesh.name = `stickerDecal-${anchor.slot}-${i}`;
    mesh.userData.stickerDecal = sticker;
    mesh.userData.stickerSlot = anchor.slot;
    mesh.renderOrder = 10;
    group.add(mesh);
  });

  if (group.children.length > 0) root.add(group);
}

/**
 * Attach / clear garage sticker decals on a cloned car root.
 * Call after paint. No-op for Käferkraft (nose variants elsewhere).
 */
export function applyCarStickers(root: Object3D, carId: CarId, stickerRaw: string): void {
  const sticker = normalizeSticker(stickerRaw);
  if (carId === "kaeferkraft") {
    clearStickerDecals(root);
    return;
  }
  mountStickerDecals(root, carId, sticker);
}

/** @deprecated UV-stamp cache key — kept for older tests. */
export function authoredSideCacheKey(carId: CarId, sticker: string, source: Texture): string {
  return `authored-side:${carId}:${sticker}:${source.uuid}`;
}

export function overlayTextureCacheSize(): number {
  return texCache.size;
}

export function clearOverlayTextureCache(): void {
  for (const tex of texCache.values()) tex.dispose();
  texCache.clear();
}

/** @deprecated Use applyCarStickers — kept for test migration. */
export function buildCarOverlays(_opts: { sticker: string; gearClass?: string }): {
  name: string;
  children: unknown[];
} {
  return { name: "carOverlays", children: [] };
}

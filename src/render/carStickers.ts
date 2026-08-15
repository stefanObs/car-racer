/**
 * Garage stickers as Asphalt-Comic decals / Tripo plaques (CONCEPT §6.2).
 * Flammen uses Tripo relief GLB on side anchors; Blitz/Stern stay canvas decals.
 * Käferkraft uses nose variants instead.
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
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  Vector3,
  type Object3D,
  type Texture,
} from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { CarId } from "../data/cars";
import { ComicPaletteCss } from "./palette";

export type { StickerId } from "../data/stickers";

export type StickerSlot = "side" | "hood" | "door";

export const CAR_STICKERS_GROUP = "carStickers";

export const FLAME_STICKER_URL = "/models/stickers/flames.glb";

const texCache = new Map<string, Texture>();

/** Optional baked Flammen sprite (`public/stickers/flames-donner.png`). */
let flameSprite: HTMLImageElement | null = null;
let flameSpritePromise: Promise<void> | null = null;

/** Tripo relief plaque template (shared clones). */
let flameGlbTemplate: Object3D | null = null;
let flameGlbPromise: Promise<void> | null = null;

export function preloadFlameSticker(): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  if (flameSpritePromise) return flameSpritePromise;
  flameSpritePromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      flameSprite = img;
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

/** Load Tripo Flammen plaque once (comic relief on doors/sides). */
export function preloadFlameStickerGlb(): Promise<void> {
  if (flameGlbPromise) return flameGlbPromise;
  if (typeof window === "undefined") {
    flameGlbPromise = Promise.resolve();
    return flameGlbPromise;
  }
  flameGlbPromise = (async () => {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(FLAME_STICKER_URL);
      flameGlbTemplate = gltf.scene;
      flameGlbTemplate.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = 12;
      });
    } catch (err) {
      console.warn("[stickers] flames.glb missing — canvas/decal fallback", err);
      flameGlbTemplate = null;
    }
  })();
  return flameGlbPromise;
}

export function hasFlameStickerGlb(): boolean {
  return flameGlbTemplate != null;
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
  ],
  donnerbuechse: [
    // Coupe door skin is only ~|x|0.67–0.79 (fenders are wider). Sit flush, not outboard.
    { slot: "side", x: 0.705, y: 0.92, z: -0.22, yaw: Math.PI / 2, width: 1.0, height: 0.4, depth: 0.35, mirrorU: true },
    { slot: "side", x: -0.705, y: 0.92, z: -0.22, yaw: -Math.PI / 2, width: 1.0, height: 0.4, depth: 0.35 },
  ],
  bunker: [
    // Door panel between arches — above yellow stripe, clear of the front tire.
    { slot: "side", x: 0.91, y: 1.12, z: 0.05, yaw: Math.PI / 2, width: 0.88, height: 0.38, depth: 0.38, mirrorU: true },
    { slot: "side", x: -0.91, y: 1.12, z: 0.05, yaw: -Math.PI / 2, width: 0.88, height: 0.38, depth: 0.38 },
  ],
};

/** Per-car anchors; Bunker Stern sits farther aft than Flammen/Blitz. */
export function stickerDecalsFor(
  carId: Exclude<CarId, "kaeferkraft">,
  sticker: string,
): DecalAnchor[] {
  const base = STICKER_DECALS[carId];
  if (carId === "bunker" && sticker === "star") {
    return base.map((a) => ({ ...a, z: -0.32 }));
  }
  return base;
}

/** Where stickers land per car (Käferkraft uses nose variants instead). */
export function stickerSlotsForCar(id: CarId): StickerSlot[] {
  switch (id) {
    case "blitz":
      return ["side"];
    case "bison":
      return ["side"];
    case "donnerbuechse":
      return ["side"];
    case "bunker":
      return ["side"];
    case "kaeferkraft":
      return [];
  }
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

/** Hotrod vinyl orange + yellow core (Asphalt-Comic / concept door flames). */
const FLAME_ORANGE = "#FF6B1A";
const FLAME_CORE = "#FFE066";

/**
 * Classic side-vinyl flames: scalloped nose (left) → three sharp tongues (aft).
 * Prefers baked Asphalt-Comic sprite; vector fallback keeps transparent tongues.
 */
function drawHotRodFlames(ctx: CanvasRenderingContext2D, _carId: CarId, w: number, h: number): void {
  if (flameSprite && flameSprite.complete && flameSprite.naturalWidth > 0) {
    ctx.drawImage(flameSprite, 0, 0, w, h);
    return;
  }

  const inkCol = ink();
  const line = Math.max(3.2, Math.min(w, h) * 0.038);

  // Outer orange — elongated, deep valleys, sharp tips (classic hotrod vinyl).
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.36);
  // Leading scallops (nose / into the wind).
  ctx.bezierCurveTo(w * 0.0, h * 0.28, w * 0.02, h * 0.18, w * 0.12, h * 0.2);
  ctx.bezierCurveTo(w * 0.04, h * 0.42, w * 0.04, h * 0.58, w * 0.12, h * 0.62);
  ctx.bezierCurveTo(w * 0.02, h * 0.72, w * 0.06, h * 0.86, w * 0.18, h * 0.84);
  // Bottom tongue (short, sharp).
  ctx.bezierCurveTo(w * 0.38, h * 0.86, w * 0.58, h * 0.9, w * 0.72, h * 0.82);
  ctx.lineTo(w * 0.8, h * 0.78);
  ctx.bezierCurveTo(w * 0.74, h * 0.74, w * 0.62, h * 0.7, w * 0.52, h * 0.68);
  // Mid tongue (longest hero tip).
  ctx.bezierCurveTo(w * 0.68, h * 0.64, w * 0.88, h * 0.58, w * 0.98, h * 0.48);
  ctx.lineTo(w * 0.92, h * 0.42);
  ctx.bezierCurveTo(w * 0.78, h * 0.44, w * 0.6, h * 0.46, w * 0.5, h * 0.42);
  // Top tongue.
  ctx.bezierCurveTo(w * 0.66, h * 0.34, w * 0.82, h * 0.22, w * 0.9, h * 0.12);
  ctx.lineTo(w * 0.82, h * 0.08);
  ctx.bezierCurveTo(w * 0.68, h * 0.14, w * 0.5, h * 0.2, w * 0.34, h * 0.24);
  ctx.bezierCurveTo(w * 0.22, h * 0.26, w * 0.12, h * 0.3, w * 0.06, h * 0.36);
  ctx.closePath();
  ctx.fillStyle = FLAME_ORANGE;
  ctx.fill();
  ctx.strokeStyle = inkCol;
  ctx.lineWidth = line;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // Yellow core — same tongue layout, inset.
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.4);
  ctx.bezierCurveTo(w * 0.1, h * 0.34, w * 0.12, h * 0.26, w * 0.2, h * 0.28);
  ctx.bezierCurveTo(w * 0.12, h * 0.44, w * 0.12, h * 0.56, w * 0.2, h * 0.58);
  ctx.bezierCurveTo(w * 0.12, h * 0.66, w * 0.16, h * 0.76, w * 0.24, h * 0.74);
  ctx.bezierCurveTo(w * 0.4, h * 0.76, w * 0.54, h * 0.78, w * 0.64, h * 0.72);
  ctx.lineTo(w * 0.7, h * 0.68);
  ctx.bezierCurveTo(w * 0.64, h * 0.66, w * 0.54, h * 0.62, w * 0.46, h * 0.6);
  ctx.bezierCurveTo(w * 0.6, h * 0.58, w * 0.76, h * 0.54, w * 0.86, h * 0.48);
  ctx.lineTo(w * 0.8, h * 0.44);
  ctx.bezierCurveTo(w * 0.68, h * 0.46, w * 0.54, h * 0.46, w * 0.46, h * 0.44);
  ctx.bezierCurveTo(w * 0.58, h * 0.38, w * 0.7, h * 0.28, w * 0.76, h * 0.2);
  ctx.lineTo(w * 0.7, h * 0.18);
  ctx.bezierCurveTo(w * 0.58, h * 0.24, w * 0.44, h * 0.28, w * 0.32, h * 0.32);
  ctx.bezierCurveTo(w * 0.24, h * 0.34, w * 0.18, h * 0.36, w * 0.14, h * 0.4);
  ctx.closePath();
  ctx.fillStyle = FLAME_CORE;
  ctx.fill();
  ctx.strokeStyle = inkCol;
  ctx.lineWidth = Math.max(2, line * 0.55);
  ctx.stroke();
}

/**
 * Stern / shooting-star side vinyl (was wrongly wired as “Blitz”).
 * Small stars toward the nose → large cutout-star cluster aft.
 */
function drawStarTrailVinyl(ctx: CanvasRenderingContext2D, _carId: CarId, w: number, h: number): void {
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

/** Comic lightning bolt (Blitz Aufkleber) — zigzag silhouette, not stars. */
function drawLightningBolt(ctx: CanvasRenderingContext2D, _carId: CarId, w: number, h: number): void {
  ctx.fillStyle = "#FFE066";
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(3.5, Math.min(w, h) * 0.045);
  ctx.beginPath();
  // Classic bolt: top-left → zig → bottom tip, then back up the thick edge.
  ctx.moveTo(w * 0.42, h * 0.06);
  ctx.lineTo(w * 0.62, h * 0.06);
  ctx.lineTo(w * 0.48, h * 0.38);
  ctx.lineTo(w * 0.72, h * 0.38);
  ctx.lineTo(w * 0.28, h * 0.94);
  ctx.lineTo(w * 0.4, h * 0.52);
  ctx.lineTo(w * 0.22, h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Inner highlight wedge for cel depth.
  ctx.fillStyle = "#FFF3BF";
  ctx.beginPath();
  ctx.moveTo(w * 0.46, h * 0.12);
  ctx.lineTo(w * 0.56, h * 0.12);
  ctx.lineTo(w * 0.46, h * 0.34);
  ctx.lineTo(w * 0.58, h * 0.34);
  ctx.lineTo(w * 0.38, h * 0.7);
  ctx.lineTo(w * 0.42, h * 0.46);
  ctx.lineTo(w * 0.3, h * 0.46);
  ctx.closePath();
  ctx.fill();
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
  if (!sticker || sticker === "none" || sticker === "ironClad") return;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = ink();
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.06);

  if (sticker === "flames") {
    drawHotRodFlames(ctx, carId, w, h);
    return;
  }

  if (sticker === "bolt" || sticker === "lightning") {
    drawLightningBolt(ctx, carId, w, h);
    return;
  }

  if (sticker === "star") {
    drawStarTrailVinyl(ctx, carId, w, h);
    return;
  }
}

/** Standalone sticker texture (tests / previews / decals). */
export function stickerTexture(sticker: string, carId: CarId = "blitz"): Texture | null {
  if (!sticker || sticker === "none" || sticker === "ironClad") return null;
  return canvasTex(`sticker-v14:${carId}:${sticker}`, 512, 256, (ctx) => {
    ctx.clearRect(0, 0, 512, 256);
    drawStickerArt(ctx, sticker, carId, 512, 256);
  });
}

function normalizeSticker(sticker: string): string {
  if (sticker === "lightning") return "bolt";
  if (sticker === "ironClad") return "none";
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

function cloneFlamePlaque(): Object3D | null {
  if (!flameGlbTemplate) return null;
  const clone = flameGlbTemplate.clone(true);
  clone.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m.clone());
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }
  });
  return clone;
}

/** Tripo Flammen relief on every side/door anchor (same yaw as door planes). */
function mountFlameTripoPlates(root: Object3D, carId: Exclude<CarId, "kaeferkraft">): boolean {
  if (!flameGlbTemplate) return false;
  clearStickerDecals(root);
  const group = new Group();
  group.name = CAR_STICKERS_GROUP;
  group.userData.carStickers = "flames";
  group.userData.flameTripo = true;

  for (const [i, anchor] of stickerDecalsFor(carId, "flames").entries()) {
    const plaque = cloneFlamePlaque();
    if (!plaque) continue;
    plaque.name = `stickerDecal-${anchor.slot}-${i}`;
    plaque.userData.stickerDecal = "flames";
    plaque.userData.stickerSlot = anchor.slot;
    // Plaque is XY facing +Z; yaw like PlaneGeometry so +Z faces out of the door.
    plaque.position.set(anchor.x, anchor.y, anchor.z);
    plaque.rotation.y = anchor.yaw;
    plaque.position.x += Math.sign(anchor.x || 1) * 0.012;
    const fit = anchor.width / 1.05;
    // Left side (−X) needs X flip so tongues still point aft after yaw −π/2.
    const mirror = anchor.x < 0 ? -1 : 1;
    // Keep plaque thin (native ~0.08) — scaling Z with width made thick floating cards.
    plaque.scale.set(fit * mirror, fit * (anchor.height / 0.48), 1);
    group.add(plaque);
  }

  if (group.children.length === 0) return false;
  root.add(group);
  return true;
}

function mountStickerDecals(root: Object3D, carId: Exclude<CarId, "kaeferkraft">, sticker: string): void {
  clearStickerDecals(root);
  if (sticker === "none") return;

  // Tripo plaques float off flat APC doors / hot-rod curves — project or door-plane instead.
  if (
    sticker === "flames" &&
    carId !== "donnerbuechse" &&
    carId !== "bunker" &&
    mountFlameTripoPlates(root, carId)
  ) {
    return;
  }

  const tex = stickerTexture(sticker, carId);
  if (!tex) return;

  root.updateMatrixWorld(true);

  // Hot-rod coupe doors are too curved/chaotic for DecalGeometry — flat door
  // planes sit flush on the panel and keep Asphalt-Comic stickers readable.
  if (carId === "donnerbuechse") {
    mountFlushDoorPlanes(root, carId, sticker, tex);
    return;
  }

  // Boxy Bunker doors: flush planes read cleaner than DecalGeometry on the atlas shell.
  if (carId === "bunker") {
    mountFlushDoorPlanes(root, carId, sticker, tex);
    return;
  }

  const body = findBodyMeshForStickers(root);
  if (!body) {
    console.warn(`[stickers] no body mesh for ${carId}`);
    return;
  }
  body.updateMatrixWorld(true);

  const group = new Group();
  group.name = CAR_STICKERS_GROUP;
  group.userData.carStickers = sticker;

  const anchors = stickerDecalsFor(carId, sticker);
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
      alphaTest: 0.15,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      toneMapped: false,
      fog: false,
    });
    mat.name = `StickerDecal-${sticker}`;
    const mesh = new Mesh(geo, mat);
    mesh.name = `stickerDecal-${anchor.slot}-${i}`;
    mesh.userData.stickerDecal = sticker;
    mesh.userData.stickerSlot = anchor.slot;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 10;
    group.add(mesh);
  });

  if (group.children.length > 0) root.add(group);
}

/** Flush comic door stickers in local space (nose +Z) — Bunker / Donnerbüchse. */
function mountFlushDoorPlanes(
  root: Object3D,
  carId: Exclude<CarId, "kaeferkraft">,
  sticker: string,
  tex: Texture,
): void {
  const group = new Group();
  group.name = CAR_STICKERS_GROUP;
  group.userData.carStickers = sticker;

  stickerDecalsFor(carId, sticker).forEach((anchor, i) => {
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
      alphaTest: 0.12,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
      toneMapped: false,
      fog: false,
    });
    mat.name = `StickerDecal-${sticker}`;
    const mesh = new Mesh(new PlaneGeometry(anchor.width, anchor.height), mat);
    mesh.position.set(anchor.x, anchor.y, anchor.z);
    mesh.rotation.y = anchor.yaw;
    // Hairline outside the door skin — avoid burying in BodyPaint or floating off.
    mesh.position.x += Math.sign(anchor.x || 1) * 0.006;
    mesh.name = `stickerDecal-${anchor.slot}-${i}`;
    mesh.userData.stickerDecal = sticker;
    mesh.userData.stickerSlot = anchor.slot;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 12;
    group.add(mesh);
  });

  root.add(group);
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

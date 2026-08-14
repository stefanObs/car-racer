import {
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Camera,
  type Object3D,
} from "three";
import { displayLap } from "../ui/lapHud";
import { carBodyWorldBox } from "./garageSit";

export const LAP_BILLBOARD_NAME = "lapBillboard";

/** How long the plaque stays up after a finish-line crossing. */
export const LAP_BILLBOARD_FLASH_SEC = 2.2;

/** Clearance above the car roof AABB so the plaque clears the silhouette in chase cam. */
export const LAP_BILLBOARD_ROOF_CLEARANCE = 1.35;

/** World-space scale of the comic plaque (width × height). */
export const LAP_BILLBOARD_SCALE = { x: 2.0, y: 0.95 } as const;

export function formatLapBillboardLabel(lap: number, totalLaps: number): string {
  const total = Math.max(1, totalLaps);
  const cur = displayLap(lap, total);
  return `${cur}/${total}`;
}

/** True while a finish-line flash is still active. */
export function lapBillboardFlashVisible(flashUntilFxTime: number, fxTime: number): boolean {
  return flashUntilFxTime > fxTime;
}

/**
 * When `lap` increases past `prevLap`, start/extend a flash deadline.
 * Race start (lap stays 1) does not flash.
 */
export function lapBillboardFlashUntil(
  prevLap: number | undefined,
  lap: number,
  fxTime: number,
  flashSec = LAP_BILLBOARD_FLASH_SEC,
): number | null {
  if (prevLap == null || lap <= prevLap) return null;
  return fxTime + flashSec;
}

function paintLapPlaque(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.clearRect(0, 0, w, h);
  // Thick comic outline + cream fill (matches garage/settings plaques)
  ctx.fillStyle = "#1b1b1f";
  roundRect(ctx, 4, 4, w - 8, h - 8, 18);
  ctx.fill();
  ctx.fillStyle = "#fff4e0";
  roundRect(ctx, 14, 14, w - 28, h - 28, 12);
  ctx.fill();
  ctx.strokeStyle = "#ffe066";
  ctx.lineWidth = 8;
  roundRect(ctx, 22, 22, w - 44, h - 44, 10);
  ctx.stroke();

  ctx.fillStyle = "#1b1b1f";
  ctx.font = "bold 42px Trebuchet MS, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RUNDE", w / 2, h * 0.34);

  ctx.font = "900 92px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillStyle = "#e03131";
  ctx.strokeStyle = "#1b1b1f";
  ctx.lineWidth = 10;
  ctx.strokeText(label, w / 2, h * 0.68);
  ctx.fillText(label, w / 2, h * 0.68);
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

/** Comic lap plaque — Sprite always faces the camera (the player). */
export function createLapBillboard(): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) paintLapPlaque(ctx, canvas.width, canvas.height, "1/5");
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.needsUpdate = true;
  const mat = new SpriteMaterial({
    map,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new Sprite(mat);
  sprite.name = LAP_BILLBOARD_NAME;
  sprite.scale.set(LAP_BILLBOARD_SCALE.x, LAP_BILLBOARD_SCALE.y, 1);
  sprite.userData.lapCanvas = canvas;
  sprite.userData.lapLabel = "1/5";
  return sprite;
}

export function setLapBillboardLabel(sprite: Sprite, lap: number, totalLaps: number): void {
  const label = formatLapBillboardLabel(lap, totalLaps);
  if (sprite.userData.lapLabel === label) return;
  sprite.userData.lapLabel = label;
  const canvas = sprite.userData.lapCanvas as HTMLCanvasElement | undefined;
  const mat = sprite.material as SpriteMaterial;
  const map = mat.map;
  if (!canvas || !map) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  paintLapPlaque(ctx, canvas.width, canvas.height, label);
  map.needsUpdate = true;
}

/**
 * Sit the plaque well above the car (chase-cam clear) and keep Sprite facing the camera.
 * `carY` is the sim ground-sit height; we add a fixed arcade roof stack so the plaque
 * never reads as jammed in the hatch/rear (AABB alone sat too low in chase framing).
 */
export function syncLapBillboard(
  sprite: Sprite,
  carRoot: Object3D,
  camera: Camera,
  lap: number,
  totalLaps: number,
  visible: boolean,
  carY = 0,
): void {
  setLapBillboardLabel(sprite, lap, totalLaps);
  sprite.visible = visible;
  if (!visible) return;
  const box = carBodyWorldBox(carRoot);
  const cx = Number.isFinite(box.min.x) ? (box.min.x + box.max.x) * 0.5 : carRoot.position.x;
  const cz = Number.isFinite(box.min.z) ? (box.min.z + box.max.z) * 0.5 : carRoot.position.z;
  const roofY = Number.isFinite(box.max.y) ? box.max.y : carY + 1.2;
  // Prefer the higher of AABB roof + clearance vs a chase-safe stack above sit height.
  const stacked = carY + 2.75;
  const topY = Math.max(roofY + LAP_BILLBOARD_ROOF_CLEARANCE, stacked);
  const toCamX = camera.position.x - cx;
  const toCamZ = camera.position.z - cz;
  const flat = Math.hypot(toCamX, toCamZ) || 1;
  const pull = 0.45;
  sprite.position.set(cx + (toCamX / flat) * pull, topY, cz + (toCamZ / flat) * pull);
  const dx = camera.position.x - sprite.position.x;
  const dy = camera.position.y - sprite.position.y;
  const dz = camera.position.z - sprite.position.z;
  const dist = Math.hypot(dx, dy, dz);
  const s = Math.min(1.25, Math.max(0.8, 14 / Math.max(8, dist)));
  sprite.scale.set(LAP_BILLBOARD_SCALE.x * s, LAP_BILLBOARD_SCALE.y * s, 1);
}

/** World Y used when only sit height is known (tests / fallbacks). */
export function lapBillboardStackedY(carY: number): number {
  return carY + 2.75;
}

export function disposeLapBillboard(sprite: Sprite): void {
  const mat = sprite.material as SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
}

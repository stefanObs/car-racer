import {
  CanvasTexture,
  Group,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Camera,
  type Object3D,
} from "three";
import { displayLap } from "../ui/lapHud";
import { carBodyWorldBox } from "./garageSit";
import { cloneFxChunk, hasFxModels } from "./loadFxGltf";

export const LAP_BILLBOARD_NAME = "lapBillboard";

/** How long the plaque stays up after a finish-line crossing. */
export const LAP_BILLBOARD_FLASH_SEC = 2.2;

/** Clearance above the car roof AABB so the plaque clears the silhouette in chase cam. */
export const LAP_BILLBOARD_ROOF_CLEARANCE = 1.35;

/** Uniform scale for the Tripo lap-shield mesh (baked longest ~1.4). */
export const LAP_SHIELD_FLASH_SCALE = 0.55;

/**
 * Baked face normals point roughly +X; Object3D.lookAt aims local −Z at the camera.
 * Yaw −90° so the plaque face sits on −Z (camera-facing after lookAt).
 */
export const LAP_SHIELD_FACE_YAW = -Math.PI / 2;

/** Tiny number badge in front of the Tripo plaque (toward camera = −Z). */
export const LAP_NUMBER_BADGE_SCALE = { x: 0.7, y: 0.34 } as const;
export const LAP_NUMBER_BADGE_Z = -0.38;

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

function paintNumberBadge(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#1b1b1f";
  roundRect(ctx, 2, 2, w - 4, h - 4, 16);
  ctx.fill();
  ctx.fillStyle = "#ffe066";
  roundRect(ctx, 10, 10, w - 20, h - 20, 12);
  ctx.fill();
  ctx.font = "900 96px Trebuchet MS, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#1b1b1f";
  ctx.lineWidth = 10;
  ctx.strokeText(label, w / 2, h / 2 + 4);
  ctx.fillStyle = "#e03131";
  ctx.fillText(label, w / 2, h / 2 + 4);
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

function makeNumberBadge(label: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) paintNumberBadge(ctx, canvas.width, canvas.height, label);
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
  sprite.name = "lapNumberBadge";
  sprite.scale.set(LAP_NUMBER_BADGE_SCALE.x, LAP_NUMBER_BADGE_SCALE.y, 1);
  sprite.position.set(0, 0.05, LAP_NUMBER_BADGE_Z);
  sprite.userData.lapCanvas = canvas;
  sprite.userData.lapLabel = label;
  return sprite;
}

/**
 * Finish-line round flash: Tripo `lap-shield` plaque (above the car) + tiny n/m badge.
 * Falls back to the number badge alone if FX GLBs are not loaded yet.
 */
export function createLapBillboard(): Group {
  const root = new Group();
  root.name = LAP_BILLBOARD_NAME;
  root.userData.lapLabel = "1/5";

  if (hasFxModels()) {
    const crest = cloneFxChunk("lapShield");
    crest.name = "lapShieldMesh";
    crest.rotation.y = LAP_SHIELD_FACE_YAW;
    crest.scale.setScalar(LAP_SHIELD_FLASH_SCALE);
    root.add(crest);
    root.userData.usesTripoShield = true;
    root.userData.lapShieldMesh = crest;
  }

  const badge = makeNumberBadge("1/5");
  // Without Tripo mesh, center the compact badge as the whole pop.
  if (!root.userData.usesTripoShield) {
    badge.position.set(0, 0, 0);
    badge.scale.set(0.95, 0.45, 1);
  }
  root.add(badge);
  root.userData.lapBadge = badge;
  return root;
}

export function setLapBillboardLabel(root: Group, lap: number, totalLaps: number): void {
  const label = formatLapBillboardLabel(lap, totalLaps);
  if (root.userData.lapLabel === label) return;
  root.userData.lapLabel = label;
  const badge = root.userData.lapBadge as Sprite | undefined;
  if (!badge) return;
  badge.userData.lapLabel = label;
  const canvas = badge.userData.lapCanvas as HTMLCanvasElement | undefined;
  const mat = badge.material as SpriteMaterial;
  const map = mat.map;
  if (!canvas || !map) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  paintNumberBadge(ctx, canvas.width, canvas.height, label);
  map.needsUpdate = true;
}

/**
 * Sit the Tripo plaque well above the car and face the camera (player).
 */
export function syncLapBillboard(
  root: Group,
  carRoot: Object3D,
  camera: Camera,
  lap: number,
  totalLaps: number,
  visible: boolean,
  carY = 0,
): void {
  setLapBillboardLabel(root, lap, totalLaps);
  root.visible = visible;
  if (!visible) return;
  const box = carBodyWorldBox(carRoot);
  const cx = Number.isFinite(box.min.x) ? (box.min.x + box.max.x) * 0.5 : carRoot.position.x;
  const cz = Number.isFinite(box.min.z) ? (box.min.z + box.max.z) * 0.5 : carRoot.position.z;
  const roofY = Number.isFinite(box.max.y) ? box.max.y : carY + 1.2;
  const stacked = carY + 2.75;
  const topY = Math.max(roofY + LAP_BILLBOARD_ROOF_CLEARANCE, stacked);
  const toCamX = camera.position.x - cx;
  const toCamZ = camera.position.z - cz;
  const flat = Math.hypot(toCamX, toCamZ) || 1;
  const pull = 0.45;
  root.position.set(cx + (toCamX / flat) * pull, topY, cz + (toCamZ / flat) * pull);
  root.lookAt(camera.position.x, root.position.y, camera.position.z);
}

export function disposeLapBillboard(root: Group): void {
  root.traverse((obj) => {
    const sprite = obj as Sprite;
    if (sprite.isSprite) {
      const mat = sprite.material as SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
      return;
    }
    const mesh = obj as Object3D & {
      isMesh?: boolean;
      geometry?: { dispose: () => void };
      material?: { dispose: () => void } | Array<{ dispose: () => void }>;
    };
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material?.dispose();
  });
}

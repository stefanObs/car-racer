import {
  Color,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Intersection,
  type Mesh,
  type Object3D,
  type Texture,
} from "three";
import type { MeshInspectHit } from "../core/meshInspect";
import { isUnderCarFx } from "./garageSit";

export const MESH_INSPECT_BG = 0x1e88e5;
export const MESH_INSPECT_MARKER_NAME = "meshInspectMarker";
export const MESH_INSPECT_MARKER_RED = 0xff3b3b;
export const MESH_INSPECT_MARKER_BLUE = 0x40c4ff;

export type MeshInspectMarkerPose = {
  x: number;
  y: number;
  z: number;
  onRed: boolean;
};

export type MeshInspectPickResult = {
  hits: MeshInspectHit[];
  marker: MeshInspectMarkerPose | null;
};

const _ndc = new Vector2();
const _local = new Vector3();
const _towardCam = new Vector3();
const _matColor = new Color();
const _raycaster = new Raycaster();

const SKIP_NAMES = new Set(["", "Scene", "Node", "carGroundBlob", "RootNode", MESH_INSPECT_MARKER_NAME]);

const MARKER_LIFT = 0.04;
/** Comic atlases store paint in UV islands; a 1px sample often lands on ink. */
const ATLAS_FILL_RADIUS_PX = 16;
const INK_LUMA = 48;

let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;

/** True when a surface pixel is red enough that a red marker would vanish. */
export function isReddishRgb(r: number, g: number, b: number): boolean {
  return r >= 96 && r > g + 24 && r > b + 24;
}

export function isInkRgb(r: number, g: number, b: number): boolean {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < INK_LUMA;
}

function patchPixel(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  const i = (y * width + x) * 4;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
}

function averageNonInk3x3(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): { r: number; g: number; b: number } | null {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const p = patchPixel(data, width, xx, yy);
      if (isInkRgb(p.r, p.g, p.b)) continue;
      sr += p.r;
      sg += p.g;
      sb += p.b;
      n++;
    }
  }
  if (!n) return null;
  return { r: sr / n, g: sg / n, b: sb / n };
}

/**
 * Prefer nearby paint fill over black comic outlines / unused atlas texels.
 * `cx, cy` are pixel coords in the patch.
 */
export function pickFillRgbFromPatch(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
): { r: number; g: number; b: number } {
  const origin = averageNonInk3x3(data, width, height, cx, cy);
  if (origin) return origin;
  const maxR = Math.max(cx, cy, width - 1 - cx, height - 1 - cy);
  for (let rad = 1; rad <= maxR; rad++) {
    for (let y = cy - rad; y <= cy + rad; y++) {
      for (let x = cx - rad; x <= cx + rad; x++) {
        if (x !== cx - rad && x !== cx + rad && y !== cy - rad && y !== cy + rad) continue;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const p = patchPixel(data, width, x, y);
        if (isInkRgb(p.r, p.g, p.b)) continue;
        return averageNonInk3x3(data, width, height, x, y) ?? p;
      }
    }
  }
  return patchPixel(data, width, cx, cy);
}

export function meshInspectMarkerHex(r: number, g: number, b: number): number {
  return isReddishRgb(r, g, b) ? MESH_INSPECT_MARKER_BLUE : MESH_INSPECT_MARKER_RED;
}

/** Authored GLB scene (mesh-space meters). Skips the `gltf-{id}` wrap and garage scale. */
export function carMeshSpaceRoot(carRoot: Object3D): Object3D {
  const wrap = carRoot.children.find((c) => c.name.startsWith("gltf-"));
  if (wrap?.children[0]) return wrap.children[0];
  for (const child of carRoot.children) {
    if (child.name === "carGroundBlob") continue;
    if (child.userData.tripoFx) continue;
    return child;
  }
  return carRoot;
}

export function meshInspectPartName(obj: Object3D, carRoot: Object3D): string {
  let p: Object3D | null = obj;
  while (p) {
    const name = p.name?.trim() ?? "";
    if (name && !SKIP_NAMES.has(name) && !name.startsWith("WheelSpin_") && !name.startsWith("WheelSteer_")) {
      return name;
    }
    if (p === carRoot) break;
    p = p.parent;
  }
  return carRoot.name?.trim() || "car";
}

export function pointerToNdc(
  clientX: number,
  clientY: number,
  canvas: { getBoundingClientRect: () => DOMRect },
): Vector2 {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(r.width, 1);
  const h = Math.max(r.height, 1);
  _ndc.set(((clientX - r.left) / w) * 2 - 1, -((clientY - r.top) / h) * 2 + 1);
  return _ndc;
}

function sampleMapRgb(map: Texture, u: number, v: number): { r: number; g: number; b: number } | null {
  const img = map.image as { width?: number; height?: number } | undefined;
  if (!img?.width || !img.height) return null;
  if (typeof document === "undefined") return null;
  if (!sampleCanvas) {
    sampleCanvas = document.createElement("canvas");
    sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!sampleCtx) return null;
  const uu = ((u % 1) + 1) % 1;
  const vv = ((v % 1) + 1) % 1;
  const tv = map.flipY !== false ? 1 - vv : vv;
  const px = Math.min(img.width - 1, Math.max(0, Math.floor(uu * img.width)));
  const py = Math.min(img.height - 1, Math.max(0, Math.floor(tv * img.height)));
  const sx = Math.max(0, px - ATLAS_FILL_RADIUS_PX);
  const sy = Math.max(0, py - ATLAS_FILL_RADIUS_PX);
  const ex = Math.min(img.width, px + ATLAS_FILL_RADIUS_PX + 1);
  const ey = Math.min(img.height, py + ATLAS_FILL_RADIUS_PX + 1);
  const pw = ex - sx;
  const ph = ey - sy;
  sampleCanvas.width = pw;
  sampleCanvas.height = ph;
  try {
    sampleCtx.drawImage(img as CanvasImageSource, sx, sy, pw, ph, 0, 0, pw, ph);
  } catch {
    return null;
  }
  let pix: ImageData;
  try {
    pix = sampleCtx.getImageData(0, 0, pw, ph);
  } catch {
    return null;
  }
  return pickFillRgbFromPatch(pix.data, pw, ph, px - sx, py - sy);
}

export function sampleHitRgb(hit: Intersection): { r: number; g: number; b: number } {
  const mesh = hit.object as Mesh;
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat) return { r: 160, g: 160, b: 160 };
  const map = "map" in mat ? (mat.map as Texture | null) : null;
  const uv = hit.uv;
  if (map && uv) {
    const texel = sampleMapRgb(map, uv.x, uv.y);
    if (texel) {
      if ("color" in mat && mat.color) {
        _matColor.copy(mat.color as Color);
        return {
          r: texel.r * _matColor.r,
          g: texel.g * _matColor.g,
          b: texel.b * _matColor.b,
        };
      }
      return texel;
    }
  }
  if ("color" in mat && mat.color) {
    _matColor.copy(mat.color as Color);
    return { r: _matColor.r * 255, g: _matColor.g * 255, b: _matColor.b * 255 };
  }
  return { r: 160, g: 160, b: 160 };
}

function skipPickObject(obj: Object3D): boolean {
  if (!obj.visible) return true;
  if (obj.name === "carGroundBlob" || obj.name === MESH_INSPECT_MARKER_NAME) return true;
  return isUnderCarFx(obj);
}

/**
 * Named parts along the pick ray (nearest first) plus a world-space marker pose.
 * Coordinates in `hits` are car mesh space (cheat-sheet meters).
 */
export function pickMeshInspectHits(
  carRoot: Object3D,
  camera: Camera,
  clientX: number,
  clientY: number,
  canvas: { getBoundingClientRect: () => DOMRect },
): MeshInspectPickResult {
  carRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  _raycaster.setFromCamera(pointerToNdc(clientX, clientY, canvas), camera);
  const raw = _raycaster.intersectObject(carRoot, true);
  const space = carMeshSpaceRoot(carRoot);
  const seen = new Set<string>();
  const hits: MeshInspectHit[] = [];
  let marker: MeshInspectMarkerPose | null = null;
  for (const hit of raw) {
    const obj = hit.object;
    if (skipPickObject(obj)) continue;
    const name = meshInspectPartName(obj, carRoot);
    if (!seen.has(name)) {
      seen.add(name);
      space.worldToLocal(_local.copy(hit.point));
      hits.push({ name, x: _local.x, y: _local.y, z: _local.z });
    }
    if (!marker) {
      const rgb = sampleHitRgb(hit);
      _towardCam.subVectors(camera.position, hit.point).normalize();
      marker = {
        x: hit.point.x + _towardCam.x * MARKER_LIFT,
        y: hit.point.y + _towardCam.y * MARKER_LIFT,
        z: hit.point.z + _towardCam.z * MARKER_LIFT,
        onRed: isReddishRgb(rgb.r, rgb.g, rgb.b),
      };
    }
  }
  return { hits, marker };
}

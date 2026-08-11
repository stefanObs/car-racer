import {
  Box3,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  Object3D,
  SRGBColorSpace,
  Vector3,
  type MeshStandardMaterial,
  type MeshToonMaterial,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  CONCRETE_WALL_HEIGHT,
  OPTIONAL_TRACK_PROP_IDS,
  REQUIRED_TRACK_PROP_IDS,
  TRACK_PROPS,
  type TrackPropId,
} from "../data/trackModels";
import { comicToon } from "./comicMaterials";

type Template = {
  root: Object3D;
  alongX: number;
  heightY: number;
};

const templates = new Map<TrackPropId, Template>();
const luminanceMaps = new Map<Texture, Texture>();
let preloadPromise: Promise<void> | null = null;

/** Load track kit GLBs once. Missing files fail boot (no silent empty walls). */
export function preloadTrackModels(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    const loadOne = async (id: TrackPropId): Promise<void> => {
      const spec = TRACK_PROPS[id];
      const gltf = await loader.loadAsync(spec.url);
      const root = gltf.scene;
      normalizeTrackScene(root, id);
      root.updateMatrixWorld(true);
      const box = meshBounds(root);
      templates.set(id, {
        root,
        alongX: Math.max(0, box.max.x - box.min.x),
        heightY: Math.max(0, box.max.y - box.min.y),
      });
    };
    await Promise.all([
      Promise.all(REQUIRED_TRACK_PROP_IDS.map((id) => loadOne(id))),
      Promise.all(
        OPTIONAL_TRACK_PROP_IDS.map(async (id) => {
          try {
            await loadOne(id);
          } catch {
            // Harbor extras stay as primitive scenery if a GLB is absent.
          }
        }),
      ),
    ]);
  })();
  return preloadPromise;
}

export function hasTrackProp(id: TrackPropId): boolean {
  return templates.has(id);
}

export function trackPropTemplate(id: TrackPropId): Object3D | null {
  return templates.get(id)?.root ?? null;
}

/** World-space X width for tiling; spec fallback when not preloaded. */
export function tileAlongFor(id: TrackPropId): number {
  const hit = templates.get(id);
  if (hit && hit.alongX > 0.4) return hit.alongX * TRACK_PROPS[id].scale;
  return TRACK_PROPS[id].tileAlong;
}

export function propHeightFor(id: TrackPropId): number {
  const hit = templates.get(id);
  if (hit && hit.heightY > 0.2) return hit.heightY * TRACK_PROPS[id].scale;
  return id === "concrete-wall" ? CONCRETE_WALL_HEIGHT : 1;
}

/**
 * Clone a kit module. Geometry is shared with the template (do not dispose it).
 * Pass `tint` to multiply a luminance albedo (containers).
 */
export function cloneTrackProp(id: TrackPropId, tint?: number): Group | null {
  const hit = templates.get(id);
  if (!hit) return null;
  const spec = TRACK_PROPS[id];
  const clone = hit.root.clone(true);
  clone.scale.setScalar(spec.scale);
  clone.rotation.y += spec.yaw;
  clone.userData.trackProp = id;
  clone.userData.sharedKit = true;
  markSharedKit(clone);
  if (tint !== undefined) applyTint(clone, tint);
  const wrap = new Group();
  wrap.name = `track-${id}`;
  wrap.userData.trackProp = id;
  wrap.userData.sharedKit = true;
  wrap.add(clone);
  return wrap;
}

function markSharedKit(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.userData.sharedKit = true;
  });
}

function applyTint(root: Object3D, hex: number): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      const toon = (mat as MeshToonMaterial).clone();
      toon.color = new Color(hex);
      toon.needsUpdate = true;
      return toon;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
    mesh.userData.kitMatCloned = true;
  });
}

function normalizeTrackScene(root: Object3D, id: TrackPropId): void {
  stripNonMeshHelpers(root);
  root.updateMatrixWorld(true);
  const box = meshBounds(root);
  const center = new Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;

  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    convertToComic(mesh, id);
    mesh.userData.sharedKit = true;
  });
}

function stripNonMeshHelpers(root: Object3D): void {
  const drop: Object3D[] = [];
  root.traverse((obj) => {
    const any = obj as Object3D & { isLight?: boolean; isCamera?: boolean };
    if (obj === root) return;
    if (any.isLight || any.isCamera) drop.push(obj);
  });
  for (const obj of drop) obj.parent?.remove(obj);
}

function meshBounds(root: Object3D): Box3 {
  const box = new Box3();
  let found = false;
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const geoBox = mesh.geometry.boundingBox;
    if (!geoBox) return;
    const world = geoBox.clone().applyMatrix4(mesh.matrixWorld);
    if (!found) {
      box.copy(world);
      found = true;
    } else {
      box.union(world);
    }
  });
  if (!found) box.setFromObject(root);
  return box;
}

function convertToComic(mesh: Mesh, id: TrackPropId): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = mats.map((mat) => {
    const std = mat as MeshStandardMaterial & MeshToonMaterial;
    let map = std.map ?? null;
    if (id === "container" && map) map = luminanceMap(map);
    const toon = comicToon(0xffffff, { map });
    toon.name = mat?.name ?? mesh.name ?? id;
    return toon;
  });
  mesh.material = next.length === 1 ? next[0]! : next;
}

function luminanceMap(map: Texture): Texture {
  const cached = luminanceMaps.get(map);
  if (cached) return cached;
  const img = map.image as { width: number; height: number } | undefined;
  if (!img?.width || !img.height || typeof document === "undefined") return map;
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) return map;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const y = Math.round(0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!);
    px[i] = y;
    px[i + 1] = y;
    px[i + 2] = y;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new CanvasTexture(c);
  tex.colorSpace = map.colorSpace ?? SRGBColorSpace;
  tex.wrapS = map.wrapS;
  tex.wrapT = map.wrapT;
  tex.flipY = map.flipY;
  tex.needsUpdate = true;
  luminanceMaps.set(map, tex);
  return tex;
}

/** Browser boot: start loading the kit as soon as race modules import. Tests skip. */
if (!import.meta.env.VITEST) {
  void preloadTrackModels();
}

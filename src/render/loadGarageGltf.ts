import { Box3, Group, Mesh, Object3D, Vector3, type MeshStandardMaterial } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GARAGE_MESH, GARAGE_PROP_IDS, type GaragePropId } from "../data/garageProps";
import { comicFlat } from "./comicMaterials";

const templates = new Map<GaragePropId, Object3D>();
const shellTemplates = new Map<string, Object3D>();
let preloadPromise: Promise<void> | null = null;
let shellPreloadPromise: Promise<void> | null = null;

export const GARAGE_SHELL_IDS = ["floor", "wall", "turntable"] as const;
export type GarageShellId = (typeof GARAGE_SHELL_IDS)[number];

const GARAGE_SHELL_URL: Record<GarageShellId, string> = {
  floor: "/models/garage/floor.glb",
  wall: "/models/garage/wall.glb",
  turntable: "/models/garage/turntable.glb",
};

/** Load garage workshop GLBs once. Missing files fail boot (no box fallback). */
export function preloadGarageProps(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      GARAGE_PROP_IDS.map(async (id) => {
        const spec = GARAGE_MESH[id];
        const gltf = await loader.loadAsync(spec.url);
        const root = gltf.scene;
        normalizeGarageProp(root);
        templates.set(id, root);
      }),
    );
  })();
  return preloadPromise;
}

/** Optional Tripo shell meshes (floor/wall/turntable) — soft-fail if absent. */
export function preloadGarageShellMeshes(): Promise<void> {
  if (shellPreloadPromise) return shellPreloadPromise;
  shellPreloadPromise = (async () => {
    if (typeof document === "undefined") return;
    const loader = new GLTFLoader();
    await Promise.all(
      GARAGE_SHELL_IDS.map(async (id) => {
        try {
          const gltf = await loader.loadAsync(GARAGE_SHELL_URL[id]);
          const root = gltf.scene;
          normalizeGarageProp(root);
          shellTemplates.set(id, root);
        } catch (err) {
          console.warn(`[garage] shell mesh skipped (${id})`, err);
        }
      }),
    );
  })();
  return shellPreloadPromise;
}

export function hasGarageProp(id: GaragePropId): boolean {
  return templates.has(id);
}

export function hasGarageShell(id: GarageShellId): boolean {
  return shellTemplates.has(id);
}

/** Clone a preloaded workshop mesh. Returns null when preload has not run (unit tests). */
export function cloneGarageProp(id: GaragePropId, name?: string): Group | null {
  const hit = templates.get(id);
  if (!hit) return null;
  const clone = hit.clone(true);
  detachSharedResources(clone);
  const wrap = new Group();
  wrap.name = name ?? id;
  wrap.add(clone);
  return wrap;
}

export function cloneGarageShell(id: GarageShellId, name?: string): Group | null {
  const hit = shellTemplates.get(id);
  if (!hit) return null;
  const clone = hit.clone(true);
  detachSharedResources(clone);
  const wrap = new Group();
  wrap.name = name ?? `garageShell-${id}`;
  wrap.userData.garageShell = id;
  wrap.add(clone);
  return wrap;
}

function detachSharedResources(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m.clone());
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }
  });
}

function normalizeGarageProp(root: Object3D): void {
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
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    convertToComicFlat(mesh);
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

/** Unlit atlas — toon gradient would muddy the comic bake. Skip outline shells (busy debris). */
function convertToComicFlat(mesh: Mesh): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = mats.map((mat) => {
    const std = mat as MeshStandardMaterial;
    const map = std.map ?? undefined;
    const hex = std.color ? std.color.getHex() : 0xffffff;
    const flat = comicFlat(map ? 0xffffff : hex, { map });
    flat.name = mat?.name || "BodyPaint";
    return flat;
  });
  mesh.material = next.length === 1 ? next[0]! : next;
}

/**
 * Shared Asphalt-Comic race FX (smoke / repair sparks / nitro chunks).
 * Same meshes on every car — not per-car cosmetics.
 */
import { Group, Mesh, Object3D, type MeshStandardMaterial, type MeshToonMaterial } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { comicToon } from "./comicMaterials";
import { ComicPalette } from "./palette";

export const FX_CHUNK_IDS = [
  "smokePuff",
  "smokeHeavy",
  "repairSpark",
  "nitroOrange",
  "nitroCyan",
  "lapShield",
] as const;

export type FxChunkId = (typeof FX_CHUNK_IDS)[number];

export const FX_URLS: Record<FxChunkId, string> = {
  smokePuff: "/models/fx/smoke-puff.glb",
  smokeHeavy: "/models/fx/smoke-heavy.glb",
  repairSpark: "/models/fx/repair-spark.glb",
  nitroOrange: "/models/fx/nitro-orange.glb",
  nitroCyan: "/models/fx/nitro-cyan.glb",
  lapShield: "/models/fx/lap-shield.glb",
};

type FxLook = {
  color: number;
  emissive?: number;
  emissiveIntensity?: number;
};

const FX_LOOK: Record<FxChunkId, FxLook> = {
  smokePuff: { color: ComicPalette.smoke },
  smokeHeavy: { color: 0x6e747c },
  repairSpark: { color: ComicPalette.repairSpark, emissive: ComicPalette.repairSpark, emissiveIntensity: 0.55 },
  nitroOrange: {
    color: ComicPalette.nitroOrange,
    emissive: ComicPalette.nitroOrange,
    emissiveIntensity: 0.65,
  },
  nitroCyan: {
    color: ComicPalette.nitroCyan,
    emissive: ComicPalette.nitroCyan,
    emissiveIntensity: 0.65,
  },
  lapShield: {
    color: ComicPalette.nitroCyan,
    emissive: ComicPalette.nitroCyan,
    emissiveIntensity: 0.45,
  },
};

const templates = new Map<FxChunkId, Object3D>();
let preloadPromise: Promise<void> | null = null;

/** Load shared FX GLBs once. Optional — cars keep sphere FX until this succeeds. */
export function preloadFxModels(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      FX_CHUNK_IDS.map(async (id) => {
        const gltf = await loader.loadAsync(FX_URLS[id]);
        const root = gltf.scene;
        applyFxMaterials(root, id);
        templates.set(id, root);
      }),
    );
  })();
  return preloadPromise;
}

export function hasFxModels(): boolean {
  return FX_CHUNK_IDS.every((id) => templates.has(id));
}

/** Clone a preloaded FX chunk. Throws when preload has not finished. */
export function cloneFxChunk(id: FxChunkId): Group {
  const hit = templates.get(id);
  if (!hit) {
    throw new Error(`FX GLB not loaded: ${id}. Call preloadFxModels() before building cars.`);
  }
  const clone = hit.clone(true);
  detachSharedResources(clone);
  const wrap = new Group();
  wrap.name = `fx-${id}`;
  wrap.add(clone);
  return wrap;
}

function applyFxMaterials(root: Object3D, id: FxChunkId): void {
  const look = FX_LOOK[id];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      const std = mat as MeshStandardMaterial & MeshToonMaterial;
      const map = std.map ?? null;
      const toon = comicToon(look.color, {
        emissive: look.emissive,
        emissiveIntensity: look.emissiveIntensity,
        map: map ?? undefined,
      });
      toon.name = std.name || id;
      if (map) {
        toon.color.setRGB(1, 1, 1);
        toon.needsUpdate = true;
      }
      return toon;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
  });
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

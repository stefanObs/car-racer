/**
 * Käferkraft nose / head variants (garage cosmetics — no flat stickers).
 * Sticker ids: none | flames(skull+horns) | bolt(bird/Bidr) | star(dog/Hund).
 */
import {
  Box3,
  Group,
  Mesh,
  Vector3,
  type MeshToonMaterial,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { comicToon } from "./comicMaterials";

export type BuggyNoseId = "none" | "skull" | "bird" | "dog";

const noseTemplates = new Map<"bird" | "dog", Group>();
let preloadPromise: Promise<void> | null = null;

const NOSE_URLS = {
  bird: "/models/props/buggy-bird.glb",
  dog: "/models/props/buggy-dog.glb",
} as const;

export function buggyNoseFromSticker(sticker: string): BuggyNoseId {
  if (sticker === "bolt" || sticker === "lightning" || sticker === "bird") return "bird";
  if (sticker === "star" || sticker === "dog") return "dog";
  if (sticker === "flames" || sticker === "skull") return "skull";
  return "none";
}

/** Load bird/dog nose GLBs once (call with car preload). */
export function preloadBuggyNoses(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      (Object.keys(NOSE_URLS) as (keyof typeof NOSE_URLS)[]).map(async (id) => {
        const gltf = await loader.loadAsync(NOSE_URLS[id]);
        const root = gltf.scene;
        root.traverse((obj) => {
          const mesh = obj as Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const next = mats.map((m) => {
            const name = ((m as MeshToonMaterial)?.name ?? "").toLowerCase();
            const hex = name.includes("eye")
              ? 0xf2261e
              : name.includes("dark")
                ? 0x262628
                : name.includes("light")
                  ? 0xecebe8
                  : 0xe0dcd4;
            const toon = comicToon(hex);
            toon.name = (m as MeshToonMaterial)?.name ?? "Body";
            return toon;
          });
          mesh.material = next.length === 1 ? next[0]! : next;
        });
        // Face buggy forward (-X). Bird model is Y-up with wings in XZ.
        if (id === "bird") {
          root.rotation.set(0, Math.PI, 0);
        } else {
          root.rotation.y = Math.PI / 2;
        }
        noseTemplates.set(id, root);
      }),
    );
  })();
  return preloadPromise;
}

export function hasBuggyNose(id: "bird" | "dog"): boolean {
  return noseTemplates.has(id);
}

/** Swap front head: skull+horns together; bird/dog GLB props; none = bare bumper. */
export function applyBuggyNoseVariant(root: Object3D, sticker: string): void {
  const variant = buggyNoseFromSticker(sticker);
  const prev = root.getObjectByName("buggyNoseVariant");
  if (prev) prev.removeFromParent();

  const skullParts = findSkullParts(root);
  const showStockSkull = variant === "skull";
  for (const m of skullParts) m.visible = showStockSkull;

  if (variant === "skull" || variant === "none") return;

  const propId = variant === "bird" ? "bird" : "dog";
  const template = noseTemplates.get(propId);
  if (!template) {
    console.warn(`Buggy nose GLB not loaded: ${propId}. Call preloadBuggyNoses().`);
    return;
  }

  root.updateMatrixWorld(true);
  const nose = template.clone(true);
  nose.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => m.clone());
    else if (mesh.material) mesh.material = mesh.material.clone();
  });
  nose.name = "buggyNoseVariant";
  const anchor = noseAnchorLocal(root, skullParts);
  nose.position.copy(anchor);
  // Slightly forward of the skull center so the prop clears the front tubes.
  nose.position.x -= 0.18;
  nose.position.y = Math.max(anchor.y - 0.05, 0.06);
  nose.scale.setScalar(propId === "bird" ? 0.95 : 1.05);
  root.add(nose);
  root.userData.buggyNoseApplied = propId;
}

function findSkullParts(root: Object3D): Mesh[] {
  const skullParts: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isSkullFace = false;
    let isDark = false;
    for (const m of mats) {
      const n = ((m as MeshToonMaterial)?.name ?? mesh.name ?? "").toLowerCase();
      if (n.includes("skull") || n.includes("eyered") || (n.includes("eye") && !n.includes("grey"))) {
        isSkullFace = true;
      }
      if (n === "dark" || n.includes("dark")) isDark = true;
    }
    if (isSkullFace) {
      skullParts.push(mesh);
      return;
    }
    if (isDark && isFrontHornMesh(mesh)) skullParts.push(mesh);
  });
  return skullParts;
}

/** Dark horn shards sit at local X ≈ -1.2 with tip above the skull. */
function isFrontHornMesh(mesh: Mesh): boolean {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox;
  if (!b) return false;
  return b.max.x < -1.0 && b.max.y > 0.2;
}

/** Skull/nose point in `root` local space (matrix-safe). */
export function noseAnchorLocal(root: Object3D, skullParts: Mesh[]): Vector3 {
  root.updateMatrixWorld(true);
  const box = new Box3();
  if (skullParts.length > 0) {
    for (const m of skullParts) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) {
        const b = m.geometry.boundingBox.clone();
        b.applyMatrix4(m.matrixWorld);
        box.union(b);
      } else {
        box.expandByObject(m);
      }
    }
  } else {
    box.setFromObject(root);
    const size = new Vector3();
    box.getSize(size);
    const c = new Vector3();
    box.getCenter(c);
    c.x = box.min.x + size.x * 0.08;
    root.worldToLocal(c);
    return c;
  }
  const world = new Vector3();
  box.getCenter(world);
  return root.worldToLocal(world);
}

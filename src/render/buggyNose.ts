/**
 * Käferkraft nose / head variants (garage cosmetics — no flat stickers).
 * Sticker ids: none | flames(skull+horns) | bolt(bird/Vogel) | star(dog/Hund).
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

/** Tripo bake already faces −X and sits on y=0 at bumper-ornament size. */
export const DOG_HEAD_SCALE = 1;
export const DOG_HEAD_YAW = 0;
export const DOG_HEAD_CONTACT_X = -0.02;
export const DOG_HEAD_CONTACT_Y = -0.01;

const noseTemplates = new Map<"bird" | "dog" | "skull", Group>();
let preloadPromise: Promise<void> | null = null;

const NOSE_URLS = {
  bird: "/models/props/buggy-bird.glb",
  dog: "/models/props/buggy-dog.glb",
  skull: "/models/props/buggy-skull.glb",
} as const;

export function buggyNoseFromSticker(sticker: string): BuggyNoseId {
  if (sticker === "bolt" || sticker === "lightning" || sticker === "bird") return "bird";
  if (sticker === "star" || sticker === "dog") return "dog";
  if (sticker === "flames" || sticker === "skull") return "skull";
  return "none";
}

/** Load skull/bird/dog nose GLBs once (call with car preload). */
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
            const std = m as MeshToonMaterial & { map?: unknown };
            const hex = name.includes("skull")
              ? 0xf2ead8
              : name.includes("eye")
                ? 0xf2261e
                : name.includes("beak")
                  ? 0xeb7a1e
                  : name.includes("dark")
                    ? 0x262628
                    : name.includes("light")
                      ? 0xecebe8
                      : 0xffffff;
            const toon = comicToon(hex);
            toon.name = (m as MeshToonMaterial)?.name ?? (id === "skull" ? "Skull" : "Body");
            // Keep Tripo albedo + UVs — do not planar-atlas (stretches the mesh look).
            if (std.map) {
              toon.map = std.map as never;
              toon.needsUpdate = true;
            }
            return toon;
          });
          mesh.material = next.length === 1 ? next[0]! : next;
        });
        // Bake aims faces at buggy forward (−X); extra yaw is identity.
        root.rotation.y = id === "dog" ? DOG_HEAD_YAW : 0;
        noseTemplates.set(id, root);
      }),
    );
  })();
  return preloadPromise;
}

export function hasBuggyNose(id: "bird" | "dog" | "skull"): boolean {
  return noseTemplates.has(id);
}

/** Swap front head: skull / bird / dog GLB props; none = bare bumper. */
export function applyBuggyNoseVariant(root: Object3D, sticker: string): void {
  const variant = buggyNoseFromSticker(sticker);
  const prev = root.getObjectByName("buggyNoseVariant");
  if (prev) prev.removeFromParent();

  // Hide leftover GetGLB skull if a source mesh still has one.
  for (const m of findSkullParts(root)) m.visible = false;

  if (variant === "none") return;

  const propId = variant;
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
  const perch = bumperHeadlightPerchLocal(root);
  nose.position.copy(perch);
  if (propId === "dog") {
    nose.scale.setScalar(DOG_HEAD_SCALE);
    nose.position.x += DOG_HEAD_CONTACT_X * DOG_HEAD_SCALE;
    nose.position.y += DOG_HEAD_CONTACT_Y * DOG_HEAD_SCALE;
  } else {
    nose.scale.setScalar(propId === "skull" ? 1.12 : 1.05);
  }
  root.add(nose);
  root.userData.buggyNoseApplied = propId;
}

/**
 * Feet on the thin bumper tube that runs between left/right headlights.
 * Käferkraft has several BodyPaint Z-tubes on the nose — pick the one whose
 * top is nearest the bumper lamp midlines (not a lower lip / skid bar).
 */
export function bumperHeadlightPerchLocal(root: Object3D): Vector3 {
  root.updateMatrixWorld(true);

  const lampCenters: Vector3[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const isLamp = mats.some((m) => {
      const n = ((m as MeshToonMaterial)?.name ?? "").toLowerCase();
      return n.includes("headlight") || n.includes("eyered");
    });
    if (!isLamp) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    if (!b) return;
    const world = b.clone().applyMatrix4(mesh.matrixWorld);
    const c = new Vector3();
    world.getCenter(c);
    root.worldToLocal(c);
    if (c.y > 0.55 || c.x > 0) return;
    lampCenters.push(c);
  });

  const lampY =
    lampCenters.length > 0
      ? lampCenters.reduce((s, c) => s + c.y, 0) / lampCenters.length
      : 0;
  const lampX =
    lampCenters.length > 0
      ? lampCenters.reduce((s, c) => s + c.x, 0) / lampCenters.length
      : -1.3;

  type Bar = { x: number; yTop: number; paint: boolean };
  const bars: Bar[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    if (!b) return;
    const world = b.clone().applyMatrix4(mesh.matrixWorld);
    const size = new Vector3();
    world.getSize(size);
    const centerWorld = new Vector3();
    world.getCenter(centerWorld);
    const topWorld = new Vector3(centerWorld.x, world.max.y, centerWorld.z);
    root.worldToLocal(centerWorld);
    root.worldToLocal(topWorld);
    // Thin Z-tube on the nose (exclude thick Dark cage).
    if (
      centerWorld.x < 0 &&
      size.z > 0.35 &&
      size.y < 0.18 &&
      size.x < 0.18
    ) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const paint = mats.some((m) => ((m as MeshToonMaterial)?.name ?? "").toLowerCase().includes("body"));
      bars.push({ x: centerWorld.x, yTop: topWorld.y, paint });
    }
  });

  if (bars.length > 0) {
    // Prefer BodyPaint tube whose top is nearest bumper-lamp height
    // (= bar between headlights; not a lower skid lip further forward).
    bars.sort((a, b) => {
      const paintBias = Number(b.paint) - Number(a.paint);
      if (paintBias !== 0) return paintBias;
      return Math.abs(a.yTop - lampY) - Math.abs(b.yTop - lampY);
    });
    const bar = bars[0]!;
    return new Vector3(bar.x, bar.yTop, 0);
  }

  if (lampCenters.length >= 2) {
    return new Vector3(lampX, lampY - 0.05, 0);
  }

  const hull = new Box3();
  let found = false;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    if (!b) return;
    const world = b.clone().applyMatrix4(mesh.matrixWorld);
    if (!found) {
      hull.copy(world);
      found = true;
    } else hull.union(world);
  });
  if (found) {
    const localMin = hull.min.clone();
    const localMax = hull.max.clone();
    root.worldToLocal(localMin);
    root.worldToLocal(localMax);
    const minX = Math.min(localMin.x, localMax.x);
    const minY = Math.min(localMin.y, localMax.y);
    const maxY = Math.max(localMin.y, localMax.y);
    return new Vector3(minX + 0.08, minY + (maxY - minY) * 0.28, 0);
  }
  return new Vector3(-1.55, 0.22, 0);
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
      // EyeRed / Headlight lamps stay on the car — only Skull mesh + front horns toggle.
      if (n.includes("skull")) isSkullFace = true;
      if (n === "dark" || n.includes("dark")) isDark = true;
    }
    if (isSkullFace) {
      skullParts.push(mesh);
      return;
    }
    if (isDark && isBuggySkullHornMesh(mesh)) skullParts.push(mesh);
  });
  return skullParts;
}

/** True when a material belongs to the skull cosmetic (not bumper headlights). */
export function isBuggySkullCosmeticName(materialOrMeshName: string): boolean {
  const n = materialOrMeshName.toLowerCase();
  if (n.includes("headlight") || n.includes("eyered")) return false;
  if (n.includes("skull")) return true; // Skull + SkullHorn
  return false;
}

/** Twin extruded horns from the comic horn sheet (left + right of bumper center). */
export function isBuggySkullHornMesh(mesh: Mesh): boolean {
  if (!mesh.geometry) return false;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox;
  if (!b) return false;
  const sy = b.max.y - b.min.y;
  const sz = b.max.z - b.min.z;
  return b.max.x < -1.0 && b.min.x > -1.45 && b.max.y > 0.15 && sy > 0.2 && sz > 0.45;
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

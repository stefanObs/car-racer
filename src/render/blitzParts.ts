/**
 * Blitz equipped-Teile visuals (CONCEPT §6.3). Meshes visualize kit parts only —
 * stats stay in mergeStats. Paint/stickers remain cosmetic.
 */
import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  type MeshToonMaterial,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { CarId } from "../data/cars";
import type { PartId } from "../data/parts";
import { comicToon } from "./comicMaterials";

export const BLITZ_PARTS_GROUP = "blitzParts";
export const BLITZ_CABIN_GLASS = "blitzCabinGlass";
/** Große Räder — stance lift only (no fake shared wheel overlays). */
export const BLITZ_WHEEL_LIFT = 0.09;
export const BLITZ_SUSPENSION_LIFT = 0.06;

/** Parts that ship a small Tripo add-on GLB (not transform-only). */
export const BLITZ_PART_MESH_IDS = [
  "rear_spoiler",
  "big_engine",
  "nitro_kit",
  "spike_bumper",
  "offroad_suspension",
  "reinforced_frame",
  "lightweight_body",
] as const;

export type BlitzPartMeshId = (typeof BLITZ_PART_MESH_IDS)[number];

export type BlitzPartAnchor = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
};

/**
 * Local offsets on the Blitz clone (nose +Z, cabin −Z, sit y=0).
 * Length ~3.7m (z ±1.85), width ~1.77m, height ~1.04m.
 */
export const BLITZ_PART_PLACEMENT: Record<BlitzPartMeshId, BlitzPartAnchor[]> = {
  // Original GT wing extracted from the pre-wing-free Blitz bake (deck mount).
  rear_spoiler: [{ x: 0, y: 0.78, z: -1.55, yaw: 0, scale: 1.05 }],
  // Tall hood scoop on the hood peak — intakes face +Z (nose); mesh is authored aft-tall.
  big_engine: [{ x: 0, y: 0.52, z: 1.42, yaw: Math.PI, scale: 0.68 }],
  nitro_kit: [{ x: 0, y: 0.08, z: -1.7, yaw: 0, scale: 1 }],
  spike_bumper: [{ x: 0, y: 0.06, z: 1.7, yaw: 0, scale: 1.12 }],
  offroad_suspension: [
    { x: 0.7, y: 0.06, z: 1.05, yaw: 0, scale: 0.7 },
    { x: -0.7, y: 0.06, z: 1.05, yaw: Math.PI, scale: 0.7 },
    { x: 0.7, y: 0.06, z: -1.08, yaw: 0, scale: 0.7 },
    { x: -0.7, y: 0.06, z: -1.08, yaw: Math.PI, scale: 0.7 },
  ],
  // One Tripo kit: sill plates + rear half-cage as a single readable add-on.
  reinforced_frame: [{ x: 0, y: 0.22, z: -0.15, yaw: 0, scale: 1.05 }],
  lightweight_body: [
    { x: 0, y: 0.58, z: 0.38, yaw: 0, scale: 1.65 },
    { x: 0.82, y: 0.42, z: 0.12, yaw: Math.PI / 2, scale: 1.2 },
    { x: -0.82, y: 0.42, z: 0.12, yaw: -Math.PI / 2, scale: 1.2 },
  ],
};

const PART_URLS: Record<BlitzPartMeshId, string> = {
  rear_spoiler: "/models/parts/blitz-rear_spoiler.glb",
  big_engine: "/models/parts/blitz-big_engine.glb",
  nitro_kit: "/models/parts/blitz-nitro_kit.glb",
  spike_bumper: "/models/parts/blitz-spike_bumper.glb",
  offroad_suspension: "/models/parts/blitz-offroad_suspension.glb",
  reinforced_frame: "/models/parts/blitz-reinforced_frame.glb",
  lightweight_body: "/models/parts/blitz-lightweight_body.glb",
};

const templates = new Map<BlitzPartMeshId, Group>();
let preloadPromise: Promise<void> | null = null;

export function blitzPartObjectName(id: BlitzPartMeshId, copy = 0): string {
  return copy === 0 ? `blitzPart-${id}` : `blitzPart-${id}-${copy}`;
}

/** Include equipped Teile so garage Ausrüsten rebuilds the showcase car. */
export function garageLookCacheKey(look: {
  modelId: string;
  paint: string;
  sticker: string;
  equippedParts?: readonly string[];
}): string {
  const parts = [...(look.equippedParts ?? [])].sort().join(",");
  return `${look.modelId}|${look.paint}|${look.sticker}|${parts}`;
}

export function isBlitzPartMeshId(id: string): id is BlitzPartMeshId {
  return (BLITZ_PART_MESH_IDS as readonly string[]).includes(id);
}

/** Wheel-spin overlays removed — keep helpers only for paint/name checks if needed. */
export function isBlitzWheelObject(obj: Object3D): boolean {
  if (obj.userData.isWheel === true || obj.userData.spinWheel === true) return true;
  if (obj.name.startsWith("WheelSpin_")) return true;
  const n = obj.name.toLowerCase();
  return n.includes("wheel") || n.includes("tire") || n.includes("rim");
}

export function registerBlitzPartTemplate(id: BlitzPartMeshId, root: Group): void {
  templates.set(id, root);
}

export function hasBlitzPartMesh(id: BlitzPartMeshId): boolean {
  return templates.has(id);
}

export function clearBlitzPartTemplates(): void {
  templates.clear();
  preloadPromise = null;
}

export function preloadBlitzParts(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      BLITZ_PART_MESH_IDS.map(async (id) => {
        try {
          const gltf = await loader.loadAsync(PART_URLS[id]);
          const root = gltf.scene;
          toonifyPart(root, materialNameForPart(id));
          templates.set(id, root);
        } catch (err) {
          console.warn(`Blitz part GLB not loaded: ${id}`, err);
        }
      }),
    );
  })();
  return preloadPromise;
}

function materialNameForPart(id: BlitzPartMeshId): string {
  if (id === "rear_spoiler") return "Spoiler";
  if (id === "nitro_kit") return "NitroKit";
  if (id === "spike_bumper") return "Spike";
  if (id === "offroad_suspension") return "Spring";
  if (id === "reinforced_frame") return "Grey";
  return "Carbon";
}

function toonifyPart(root: Object3D, fallbackName: string): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((m) => {
      const std = m as MeshToonMaterial & { map?: unknown; name?: string };
      const toon = comicToon(0xffffff);
      toon.name = std.name || fallbackName;
      if (std.map) {
        toon.map = std.map as never;
        toon.needsUpdate = true;
      }
      return toon;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
  });
}

function clonePartTemplate(template: Group): Group {
  const clone = template.clone(true);
  clone.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => m.clone());
    else if (mesh.material) mesh.material = mesh.material.clone();
  });
  return clone;
}

function applyRideLift(root: Object3D, lift: number): void {
  const baseY = typeof root.userData.blitzSitY === "number" ? root.userData.blitzSitY : root.position.y;
  root.userData.blitzSitY = baseY;
  root.position.y = baseY + lift;
}

/** Stance lift for Große Räder / Gelände — no fake shared wheel overlays. */
export function blitzStanceLift(equippedParts: readonly PartId[]): number {
  let lift = 0;
  if (equippedParts.includes("big_wheels")) lift += BLITZ_WHEEL_LIFT;
  if (equippedParts.includes("offroad_suspension")) lift += BLITZ_SUSPENSION_LIFT;
  return lift;
}

/** Attach / hide Blitz part meshes from `kit.equippedParts`. No-op on other cars. */
export function applyEquippedPartVisuals(
  root: Object3D,
  carId: CarId,
  equippedParts: readonly PartId[],
): void {
  if (carId !== "blitz") {
    root.getObjectByName(BLITZ_PARTS_GROUP)?.removeFromParent();
    root.getObjectByName(BLITZ_CABIN_GLASS)?.removeFromParent();
    return;
  }
  applyBlitzParts(root, equippedParts);
}

/** Opaque comic cabin glass so the Tripo windshield hole does not read as open. */
export function sealBlitzCabinGlass(root: Object3D): void {
  root.getObjectByName(BLITZ_CABIN_GLASS)?.removeFromParent();
  const g = new Group();
  g.name = BLITZ_CABIN_GLASS;
  g.userData.blitzCabinGlass = true;

  const glassMat = () => {
    const m = new MeshBasicMaterial({
      color: 0x2c3642,
      side: DoubleSide,
    });
    m.name = "Glass";
    return m;
  };

  // Raked windshield plate — fills the open cabin without a thick outline “armor” look.
  const windshield = new Mesh(new PlaneGeometry(1.15, 0.48), glassMat());
  windshield.name = "blitzWindshield";
  windshield.position.set(0, 0.88, 0.38);
  windshield.rotation.x = -0.95;
  g.add(windshield);

  for (const side of [-1, 1] as const) {
    const sideGlass = new Mesh(new PlaneGeometry(0.7, 0.36), glassMat());
    sideGlass.name = side < 0 ? "blitzSideGlassL" : "blitzSideGlassR";
    sideGlass.position.set(side * 0.79, 0.8, -0.08);
    sideGlass.rotation.y = side * (Math.PI / 2);
    g.add(sideGlass);
  }

  root.add(g);
}

export function applyBlitzParts(root: Object3D, equippedParts: readonly PartId[]): void {
  root.getObjectByName(BLITZ_PARTS_GROUP)?.removeFromParent();
  sealBlitzCabinGlass(root);

  const equipped = new Set(equippedParts);
  applyRideLift(root, blitzStanceLift(equippedParts));

  const group = new Group();
  group.name = BLITZ_PARTS_GROUP;
  group.userData.blitzPart = true;

  for (const id of BLITZ_PART_MESH_IDS) {
    if (!equipped.has(id)) continue;
    const template = templates.get(id);
    if (!template) continue;
    const anchors = BLITZ_PART_PLACEMENT[id];
    anchors.forEach((anchor, copy) => {
      const inst = clonePartTemplate(template);
      inst.name = blitzPartObjectName(id, copy);
      inst.userData.blitzPart = id;
      inst.position.set(anchor.x, anchor.y, anchor.z);
      inst.rotation.y = anchor.yaw;
      inst.scale.setScalar(anchor.scale);
      group.add(inst);
    });
  }

  if (group.children.length > 0) root.add(group);
}

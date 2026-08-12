/**
 * Equipped-Teile visuals for every car (CONCEPT §6.3 + parts-look sheets).
 * Tripo add-on GLBs (Blitz kits) mount on all classes with surface snap;
 * procedural builders are fallback only. Meshes are cosmetic — stats stay in mergeStats.
 */
import {
  Box3,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
  type MeshToonMaterial,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { CarId } from "../data/cars";
import type { PartId } from "../data/parts";
import {
  buildBrakeUnit,
  buildCoilSpring,
  buildHoodScoop,
  buildLightweightBody,
  buildNitroKit,
  buildRearEngineBlock,
  buildRearSpoiler,
  buildReinforcedFrame,
  buildSpikeBumper,
  buildWheelBulkHint,
  caliperColorFor,
  markPartUserData,
  springColorFor,
} from "./carPartBuilders";
import { comicToon } from "./comicMaterials";

export const CAR_PARTS_GROUP = "carParts";
/** @deprecated alias — Blitz cabin glass seal */
export const BLITZ_PARTS_GROUP = CAR_PARTS_GROUP;
export const BLITZ_CABIN_GLASS = "blitzCabinGlass";

export const WHEEL_LIFT = 0.09;
export const SUSPENSION_LIFT = 0.06;
export const BLITZ_WHEEL_LIFT = WHEEL_LIFT;
export const BLITZ_SUSPENSION_LIFT = SUSPENSION_LIFT;

/** Parts that ship a Tripo (or extracted) add-on GLB under /models/parts/. */
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

/** All Teile that produce a visual change when equipped. */
export const VISUAL_PART_IDS = [
  ...BLITZ_PART_MESH_IDS,
  "better_brakes",
  "big_wheels",
] as const satisfies readonly PartId[];

export type PartAnchor = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /**
   * Sit part bottom on body surface at (x,z). Default depends on mount call.
   * Prefer false for bumpers / frames / wheel-well springs.
   */
  snap?: boolean;
  /** Extra clearance after surface snap (default 0.02). */
  sitGap?: number;
  /** XZ sample radius for surface Y (default 0.4). */
  snapRadius?: number;
};

export type BlitzPartAnchor = PartAnchor;

/**
 * Local offsets on the car clone child (nose +Z for most cars).
 * Käferkraft child is still nose −X (parent yaw π/2) — see KAEFERKRAFT layout.
 */
export const BLITZ_PART_PLACEMENT: Record<BlitzPartMeshId, PartAnchor[]> = {
  // Extracted original wing — fixed pose, no surface snap.
  rear_spoiler: [{ x: 0, y: 0.78, z: -1.55, yaw: 0, scale: 1.05, snap: false }],
  big_engine: [{ x: 0, y: 0.52, z: 1.42, yaw: Math.PI, scale: 0.68, sitGap: 0.01 }],
  nitro_kit: [{ x: 0, y: 0.08, z: -1.7, yaw: 0, scale: 1, snap: false }],
  spike_bumper: [{ x: 0, y: 0.06, z: 1.7, yaw: 0, scale: 1.12, snap: false }],
  offroad_suspension: [
    { x: 0.7, y: 0.06, z: 1.05, yaw: 0, scale: 0.7, snap: false },
    { x: -0.7, y: 0.06, z: 1.05, yaw: Math.PI, scale: 0.7, snap: false },
    { x: 0.7, y: 0.06, z: -1.08, yaw: 0, scale: 0.7, snap: false },
    { x: -0.7, y: 0.06, z: -1.08, yaw: Math.PI, scale: 0.7, snap: false },
  ],
  reinforced_frame: [{ x: 0, y: 0.22, z: -0.15, yaw: 0, scale: 1.05, snap: false }],
  lightweight_body: [
    { x: 0, y: 0.58, z: 0.38, yaw: 0, scale: 1.65, sitGap: 0.015 },
    { x: 0.82, y: 0.42, z: 0.12, yaw: Math.PI / 2, scale: 1.2, sitGap: 0.015 },
    { x: -0.82, y: 0.42, z: 0.12, yaw: -Math.PI / 2, scale: 1.2, sitGap: 0.015 },
  ],
};

type CarVisualLayout = {
  wheelLift: number;
  suspensionLift: number;
  brakes: PartAnchor[];
  springs: PartAnchor[];
  wheelHints: PartAnchor[];
  big_engine: { anchors: PartAnchor[]; build: () => Group; preferGlb?: boolean };
  spike_bumper: { anchors: PartAnchor[]; build: () => Group; preferGlb?: boolean };
  reinforced_frame: { anchors: PartAnchor[]; build: () => Group; preferGlb?: boolean };
  lightweight_body: { anchors: PartAnchor[]; build: () => Group; preferGlb?: boolean };
  nitro_kit: { anchors: PartAnchor[]; build: () => Group; preferGlb?: boolean };
  rear_spoiler: { anchors: PartAnchor[]; build: () => Group; preferGlb?: boolean };
};

function layoutBlitz(): CarVisualLayout {
  return {
    wheelLift: WHEEL_LIFT,
    suspensionLift: SUSPENSION_LIFT,
    brakes: [
      { x: 0.72, y: 0.28, z: 1.15, yaw: 0, scale: 0.85, snap: false },
      { x: -0.72, y: 0.28, z: 1.15, yaw: Math.PI, scale: 0.85, snap: false },
      { x: 0.72, y: 0.28, z: -1.15, yaw: 0, scale: 0.85, snap: false },
      { x: -0.72, y: 0.28, z: -1.15, yaw: Math.PI, scale: 0.85, snap: false },
    ],
    springs: BLITZ_PART_PLACEMENT.offroad_suspension,
    wheelHints: [
      { x: 0.78, y: 0.32, z: 1.15, yaw: 0, scale: 1, snap: false },
      { x: -0.78, y: 0.32, z: 1.15, yaw: 0, scale: 1, snap: false },
      { x: 0.78, y: 0.32, z: -1.15, yaw: 0, scale: 1, snap: false },
      { x: -0.78, y: 0.32, z: -1.15, yaw: 0, scale: 1, snap: false },
    ],
    big_engine: {
      anchors: BLITZ_PART_PLACEMENT.big_engine,
      build: () => buildHoodScoop("triple"),
    },
    spike_bumper: {
      anchors: BLITZ_PART_PLACEMENT.spike_bumper,
      build: () => buildSpikeBumper(6, 1.25),
    },
    reinforced_frame: {
      anchors: BLITZ_PART_PLACEMENT.reinforced_frame,
      build: () => buildReinforcedFrame("sport"),
    },
    lightweight_body: {
      anchors: BLITZ_PART_PLACEMENT.lightweight_body,
      build: () => buildLightweightBody("vents"),
    },
    nitro_kit: {
      anchors: BLITZ_PART_PLACEMENT.nitro_kit,
      build: () => buildNitroKit("rear_pair"),
    },
    rear_spoiler: {
      anchors: BLITZ_PART_PLACEMENT.rear_spoiler,
      build: () => buildRearSpoiler(),
    },
  };
}

function layoutBison(): CarVisualLayout {
  return {
    wheelLift: 0.1,
    suspensionLift: 0.1,
    brakes: [
      { x: 0.7, y: 0.38, z: 1.25, yaw: 0, scale: 0.95, snap: false },
      { x: -0.7, y: 0.38, z: 1.25, yaw: Math.PI, scale: 0.95, snap: false },
      { x: 0.7, y: 0.38, z: -1.15, yaw: 0, scale: 0.95, snap: false },
      { x: -0.7, y: 0.38, z: -1.15, yaw: Math.PI, scale: 0.95, snap: false },
    ],
    springs: [
      { x: 0.65, y: 0.12, z: 1.2, yaw: 0, scale: 0.85, snap: false },
      { x: -0.65, y: 0.12, z: 1.2, yaw: 0, scale: 0.85, snap: false },
      { x: 0.65, y: 0.12, z: -1.1, yaw: 0, scale: 0.85, snap: false },
      { x: -0.65, y: 0.12, z: -1.1, yaw: 0, scale: 0.85, snap: false },
    ],
    wheelHints: [
      { x: 0.78, y: 0.42, z: 1.25, yaw: 0, scale: 1.15, snap: false },
      { x: -0.78, y: 0.42, z: 1.25, yaw: 0, scale: 1.15, snap: false },
      { x: 0.78, y: 0.42, z: -1.15, yaw: 0, scale: 1.15, snap: false },
      { x: -0.78, y: 0.42, z: -1.15, yaw: 0, scale: 1.15, snap: false },
    ],
    big_engine: {
      anchors: [{ x: 0, y: 0.95, z: 0.85, yaw: Math.PI, scale: 0.95, sitGap: 0.02 }],
      build: () => buildHoodScoop("block"),
    },
    spike_bumper: {
      anchors: [{ x: 0, y: 0.22, z: 1.85, yaw: 0, scale: 1.2, snap: false }],
      build: () => buildSpikeBumper(4, 1.35),
    },
    reinforced_frame: {
      anchors: [{ x: 0, y: 0.35, z: -0.55, yaw: 0, scale: 1.15, snap: false }],
      build: () => buildReinforcedFrame("pickup"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.95, z: 0.5, yaw: 0, scale: 1.35, sitGap: 0.02 }],
      build: () => buildLightweightBody("hood_bed"),
    },
    nitro_kit: {
      // Bed floor (not cab roof) — narrow snap so sample hits the bed deck.
      anchors: [{ x: 0, y: 0.55, z: -1.35, yaw: 0, scale: 1.05, sitGap: 0.02, snapRadius: 0.28 }],
      build: () => buildNitroKit("bed"),
    },
    rear_spoiler: {
      anchors: [{ x: 0, y: 1.35, z: -1.75, yaw: 0, scale: 1.15, sitGap: 0.02 }],
      build: () => buildRearSpoiler(),
    },
  };
}

/** Child local: nose −X, width ±Z (parent yaw π/2 → world +Z). */
function layoutKaeferkraft(): CarVisualLayout {
  return {
    wheelLift: 0.08,
    suspensionLift: 0.1,
    brakes: [
      { x: -1.05, y: 0.42, z: 0.7, yaw: Math.PI / 2, scale: 0.9, snap: false },
      { x: -1.05, y: 0.42, z: -0.7, yaw: -Math.PI / 2, scale: 0.9, snap: false },
      { x: 1.0, y: 0.42, z: 0.7, yaw: Math.PI / 2, scale: 0.9, snap: false },
      { x: 1.0, y: 0.42, z: -0.7, yaw: -Math.PI / 2, scale: 0.9, snap: false },
    ],
    springs: [
      { x: -1.0, y: 0.15, z: 0.65, yaw: 0, scale: 0.9, snap: false },
      { x: -1.0, y: 0.15, z: -0.65, yaw: 0, scale: 0.9, snap: false },
      { x: 0.95, y: 0.15, z: 0.65, yaw: 0, scale: 0.9, snap: false },
      { x: 0.95, y: 0.15, z: -0.65, yaw: 0, scale: 0.9, snap: false },
    ],
    wheelHints: [
      { x: -1.1, y: 0.45, z: 0.78, yaw: Math.PI / 2, scale: 1.2, snap: false },
      { x: -1.1, y: 0.45, z: -0.78, yaw: Math.PI / 2, scale: 1.2, snap: false },
      { x: 1.05, y: 0.45, z: 0.78, yaw: Math.PI / 2, scale: 1.2, snap: false },
      { x: 1.05, y: 0.45, z: -0.78, yaw: Math.PI / 2, scale: 1.2, snap: false },
    ],
    big_engine: {
      // Look sheet: rear engine block behind seats — Tripo scoop does not fit.
      anchors: [{ x: 0.95, y: 0.55, z: 0, yaw: -Math.PI / 2, scale: 0.95, snap: false }],
      build: () => buildRearEngineBlock(),
      preferGlb: false,
    },
    spike_bumper: {
      anchors: [{ x: -1.55, y: 0.28, z: 0, yaw: -Math.PI / 2, scale: 1, snap: false }],
      build: () => buildSpikeBumper(4, 1.15),
    },
    reinforced_frame: {
      anchors: [{ x: 0.15, y: 0.2, z: 0, yaw: Math.PI / 2, scale: 0.95, snap: false }],
      build: () => buildReinforcedFrame("buggy"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.5, z: 0, yaw: Math.PI / 2, scale: 1.1, sitGap: 0.02 }],
      build: () => buildLightweightBody("holes"),
    },
    nitro_kit: {
      anchors: [{ x: 1.15, y: 0.7, z: 0, yaw: -Math.PI / 2, scale: 0.95, sitGap: 0.02 }],
      build: () => buildNitroKit("rear_rack"),
    },
    rear_spoiler: {
      anchors: [{ x: 1.25, y: 1.35, z: 0, yaw: -Math.PI / 2, scale: 0.95, sitGap: 0.02 }],
      build: () => buildRearSpoiler(),
    },
  };
}

function layoutDonner(): CarVisualLayout {
  return {
    wheelLift: 0.08,
    suspensionLift: 0.09,
    brakes: [
      { x: 0.85, y: 0.4, z: 1.35, yaw: 0, scale: 0.9, snap: false },
      { x: -0.85, y: 0.4, z: 1.35, yaw: Math.PI, scale: 0.9, snap: false },
      { x: 0.95, y: 0.45, z: -1.15, yaw: 0, scale: 1, snap: false },
      { x: -0.95, y: 0.45, z: -1.15, yaw: Math.PI, scale: 1, snap: false },
    ],
    springs: [
      { x: 0.8, y: 0.15, z: 1.3, yaw: 0, scale: 0.85, snap: false },
      { x: -0.8, y: 0.15, z: 1.3, yaw: 0, scale: 0.85, snap: false },
      { x: 0.9, y: 0.18, z: -1.1, yaw: 0, scale: 0.95, snap: false },
      { x: -0.9, y: 0.18, z: -1.1, yaw: 0, scale: 0.95, snap: false },
    ],
    wheelHints: [
      { x: 0.95, y: 0.42, z: 1.35, yaw: 0, scale: 1.05, snap: false },
      { x: -0.95, y: 0.42, z: 1.35, yaw: 0, scale: 1.05, snap: false },
      { x: 1.05, y: 0.5, z: -1.15, yaw: 0, scale: 1.25, snap: false },
      { x: -1.05, y: 0.5, z: -1.15, yaw: 0, scale: 1.25, snap: false },
    ],
    big_engine: {
      anchors: [{ x: 0, y: 0.85, z: 0.95, yaw: Math.PI, scale: 0.95, sitGap: 0.02 }],
      build: () => buildHoodScoop("blower"),
    },
    spike_bumper: {
      anchors: [{ x: 0, y: 0.25, z: 1.85, yaw: 0, scale: 1.15, snap: false }],
      build: () => buildSpikeBumper(5, 1.4),
    },
    reinforced_frame: {
      anchors: [{ x: 0, y: 0.25, z: -0.2, yaw: 0, scale: 1.1, snap: false }],
      build: () => buildReinforcedFrame("hotrod"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.7, z: -0.1, yaw: 0, scale: 1.2, sitGap: 0.02 }],
      build: () => buildLightweightBody("holes"),
    },
    nitro_kit: {
      anchors: [{ x: 0.95, y: 0.55, z: -0.35, yaw: Math.PI / 2, scale: 1, sitGap: 0.02 }],
      build: () => buildNitroKit("side"),
    },
    rear_spoiler: {
      anchors: [{ x: 0, y: 1.15, z: -1.65, yaw: 0, scale: 1.1, sitGap: 0.02 }],
      build: () => buildRearSpoiler(),
    },
  };
}

function layoutBunker(): CarVisualLayout {
  return {
    wheelLift: 0.1,
    suspensionLift: 0.12,
    brakes: [
      { x: 0.85, y: 0.48, z: 1.25, yaw: 0, scale: 1, snap: false },
      { x: -0.85, y: 0.48, z: 1.25, yaw: Math.PI, scale: 1, snap: false },
      { x: 0.85, y: 0.48, z: -1.2, yaw: 0, scale: 1, snap: false },
      { x: -0.85, y: 0.48, z: -1.2, yaw: Math.PI, scale: 1, snap: false },
    ],
    springs: [
      { x: 0.8, y: 0.2, z: 1.2, yaw: 0, scale: 1, snap: false },
      { x: -0.8, y: 0.2, z: 1.2, yaw: 0, scale: 1, snap: false },
      { x: 0.8, y: 0.2, z: -1.15, yaw: 0, scale: 1, snap: false },
      { x: -0.8, y: 0.2, z: -1.15, yaw: 0, scale: 1, snap: false },
    ],
    wheelHints: [
      { x: 0.95, y: 0.55, z: 1.25, yaw: 0, scale: 1.25, snap: false },
      { x: -0.95, y: 0.55, z: 1.25, yaw: 0, scale: 1.25, snap: false },
      { x: 0.95, y: 0.55, z: -1.2, yaw: 0, scale: 1.25, snap: false },
      { x: -0.95, y: 0.55, z: -1.2, yaw: 0, scale: 1.25, snap: false },
    ],
    big_engine: {
      anchors: [{ x: 0, y: 1.35, z: 0.55, yaw: Math.PI, scale: 1.05, sitGap: 0.025 }],
      build: () => buildHoodScoop("block"),
    },
    spike_bumper: {
      anchors: [{ x: 0, y: 0.4, z: 1.9, yaw: 0, scale: 1.3, snap: false }],
      build: () => buildSpikeBumper(5, 1.55),
    },
    reinforced_frame: {
      anchors: [{ x: 0, y: 0.4, z: -0.1, yaw: 0, scale: 1.2, snap: false }],
      build: () => buildReinforcedFrame("armor"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.9, z: -0.4, yaw: 0, scale: 1.35, sitGap: 0.025 }],
      build: () => buildLightweightBody("holes"),
    },
    nitro_kit: {
      anchors: [{ x: -0.85, y: 0.85, z: -1.35, yaw: -Math.PI / 2, scale: 1.1, sitGap: 0.02 }],
      build: () => buildNitroKit("side"),
    },
    rear_spoiler: {
      anchors: [{ x: 0, y: 1.95, z: -1.55, yaw: 0, scale: 1.2, sitGap: 0.025 }],
      build: () => buildRearSpoiler(),
    },
  };
}

export const CAR_PART_LAYOUTS: Record<CarId, CarVisualLayout> = {
  blitz: layoutBlitz(),
  bison: layoutBison(),
  kaeferkraft: layoutKaeferkraft(),
  donnerbuechse: layoutDonner(),
  bunker: layoutBunker(),
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

export function blitzPartObjectName(id: string, copy = 0): string {
  return copy === 0 ? `carPart-${id}` : `carPart-${id}-${copy}`;
}

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

export function isCarWheelObject(obj: Object3D): boolean {
  if (obj.userData.isWheel === true || obj.userData.spinWheel === true) return true;
  if (obj.name.startsWith("WheelSpin_")) return true;
  const n = obj.name.toLowerCase();
  return n.includes("wheel") || n.includes("tire") || n.includes("rim");
}

/** @deprecated */
export const isBlitzWheelObject = isCarWheelObject;

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

export function preloadCarParts(): Promise<void> {
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
          console.warn(`Part GLB not loaded: ${id}`, err);
        }
      }),
    );
  })();
  return preloadPromise;
}

/** @deprecated use preloadCarParts */
export const preloadBlitzParts = preloadCarParts;

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
  const baseY =
    typeof root.userData.carPartsSitY === "number"
      ? root.userData.carPartsSitY
      : typeof root.userData.blitzSitY === "number"
        ? root.userData.blitzSitY
        : root.position.y;
  root.userData.carPartsSitY = baseY;
  root.userData.blitzSitY = baseY;
  root.position.y = baseY + lift;
}

export function carStanceLift(carId: CarId, equippedParts: readonly PartId[]): number {
  const layout = CAR_PART_LAYOUTS[carId];
  let lift = 0;
  if (equippedParts.includes("big_wheels")) lift += layout.wheelLift;
  if (equippedParts.includes("offroad_suspension")) lift += layout.suspensionLift;
  return lift;
}

/** @deprecated */
export function blitzStanceLift(equippedParts: readonly PartId[]): number {
  return carStanceLift("blitz", equippedParts);
}

function skipForSurfaceSample(obj: Object3D): boolean {
  let p: Object3D | null = obj;
  while (p) {
    if (
      p.name === CAR_PARTS_GROUP ||
      p.name === "blitzParts" ||
      p.name === BLITZ_CABIN_GLASS ||
      p.userData.carParts === true ||
      p.userData.blitzCabinGlass === true ||
      p.userData.carPartId
    ) {
      return true;
    }
    p = p.parent;
  }
  return isCarWheelObject(obj);
}

/**
 * Max body Y near (x,z) in `root` local space — sits scoops/wings on hood/deck.
 */
export function sampleBodySurfaceY(
  root: Object3D,
  x: number,
  z: number,
  radius = 0.4,
): number | null {
  root.updateMatrixWorld(true);
  const invRoot = new Matrix4().copy(root.matrixWorld).invert();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const r2 = radius * radius;
  let best: number | null = null;

  root.traverse((obj) => {
    if (skipForSurfaceSample(obj)) return;
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.attributes.position;
    if (!pos) return;
    const index = mesh.geometry.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    const mw = mesh.matrixWorld;

    for (let t = 0; t < triCount; t++) {
      let i0: number;
      let i1: number;
      let i2: number;
      if (index) {
        i0 = index.getX(t * 3);
        i1 = index.getX(t * 3 + 1);
        i2 = index.getX(t * 3 + 2);
      } else {
        i0 = t * 3;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }
      a.fromBufferAttribute(pos, i0).applyMatrix4(mw).applyMatrix4(invRoot);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mw).applyMatrix4(invRoot);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mw).applyMatrix4(invRoot);
      const cx = (a.x + b.x + c.x) / 3;
      const cz = (a.z + b.z + c.z) / 3;
      const dx = cx - x;
      const dz = cz - z;
      if (dx * dx + dz * dz > r2) continue;
      const y = Math.max(a.y, b.y, c.y);
      if (best === null || y > best) best = y;
    }
  });

  return best;
}

function placeAnchored(
  group: Group,
  bodyRoot: Object3D,
  partId: string,
  anchors: PartAnchor[],
  factory: () => Group,
  defaultSnap: boolean,
): void {
  anchors.forEach((anchor, copy) => {
    const inst = factory();
    inst.name = blitzPartObjectName(partId, copy);
    markPartUserData(inst, partId);
    inst.rotation.y = anchor.yaw;
    inst.scale.setScalar(anchor.scale);
    inst.position.set(anchor.x, 0, anchor.z);
    group.add(inst);

    const doSnap = anchor.snap ?? defaultSnap;
    let y = anchor.y;
    if (doSnap) {
      group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(inst);
      const bottom = box.min.y;
      const surf = sampleBodySurfaceY(
        bodyRoot,
        anchor.x,
        anchor.z,
        anchor.snapRadius ?? 0.4,
      );
      if (surf != null && Number.isFinite(surf)) {
        y = surf - bottom + (anchor.sitGap ?? 0.02);
      }
    }
    inst.position.set(anchor.x, y, anchor.z);
  });
}

/** Prefer Tripo/extracted GLB when preloaded; else procedural. Hood/deck parts snap to body. */
function mountGlbOrProc(
  group: Group,
  bodyRoot: Object3D,
  id: BlitzPartMeshId,
  anchors: PartAnchor[],
  procedural: () => Group,
  defaultSnap: boolean,
  preferGlb = true,
): void {
  const template = preferGlb ? templates.get(id) : undefined;
  if (template) {
    placeAnchored(group, bodyRoot, id, anchors, () => clonePartTemplate(template), defaultSnap);
    return;
  }
  placeAnchored(group, bodyRoot, id, anchors, procedural, defaultSnap);
}

/** @deprecated No-op — Tripo Blitz glass is kept; opaque plane seal removed. */
export function sealBlitzCabinGlass(root: Object3D): void {
  root.getObjectByName(BLITZ_CABIN_GLASS)?.removeFromParent();
}

/** Attach / hide part meshes from `kit.equippedParts` for any car. */
export function applyEquippedPartVisuals(
  root: Object3D,
  carId: CarId,
  equippedParts: readonly PartId[],
): void {
  root.getObjectByName(CAR_PARTS_GROUP)?.removeFromParent();
  root.getObjectByName("blitzParts")?.removeFromParent();
  // Prefer Tripo cabin glass — strip any leftover opaque plane seal.
  root.getObjectByName(BLITZ_CABIN_GLASS)?.removeFromParent();

  const layout = CAR_PART_LAYOUTS[carId];
  const equipped = new Set(equippedParts);
  applyRideLift(root, carStanceLift(carId, equippedParts));

  const group = new Group();
  group.name = CAR_PARTS_GROUP;
  group.userData.carParts = true;

  if (equipped.has("big_engine")) {
    mountGlbOrProc(
      group,
      root,
      "big_engine",
      layout.big_engine.anchors,
      layout.big_engine.build,
      true,
      layout.big_engine.preferGlb !== false,
    );
  }
  if (equipped.has("spike_bumper")) {
    mountGlbOrProc(
      group,
      root,
      "spike_bumper",
      layout.spike_bumper.anchors,
      layout.spike_bumper.build,
      false,
      layout.spike_bumper.preferGlb !== false,
    );
  }
  if (equipped.has("reinforced_frame")) {
    mountGlbOrProc(
      group,
      root,
      "reinforced_frame",
      layout.reinforced_frame.anchors,
      layout.reinforced_frame.build,
      false,
      layout.reinforced_frame.preferGlb !== false,
    );
  }
  if (equipped.has("lightweight_body")) {
    mountGlbOrProc(
      group,
      root,
      "lightweight_body",
      layout.lightweight_body.anchors,
      layout.lightweight_body.build,
      true,
      layout.lightweight_body.preferGlb !== false,
    );
  }
  if (equipped.has("nitro_kit")) {
    mountGlbOrProc(
      group,
      root,
      "nitro_kit",
      layout.nitro_kit.anchors,
      layout.nitro_kit.build,
      true,
      layout.nitro_kit.preferGlb !== false,
    );
  }
  if (equipped.has("rear_spoiler")) {
    mountGlbOrProc(
      group,
      root,
      "rear_spoiler",
      layout.rear_spoiler.anchors,
      layout.rear_spoiler.build,
      true,
      layout.rear_spoiler.preferGlb !== false,
    );
  }
  if (equipped.has("offroad_suspension")) {
    const springCol = springColorFor(carId);
    mountGlbOrProc(
      group,
      root,
      "offroad_suspension",
      layout.springs,
      () => buildCoilSpring(springCol),
      false,
    );
  }
  if (equipped.has("better_brakes")) {
    const col = caliperColorFor(carId);
    placeAnchored(group, root, "better_brakes", layout.brakes, () => buildBrakeUnit(col), false);
  }
  if (equipped.has("big_wheels")) {
    placeAnchored(group, root, "big_wheels", layout.wheelHints, () => buildWheelBulkHint(), false);
  }

  if (group.children.length > 0) root.add(group);
}

/** @deprecated Blitz-only name — use applyEquippedPartVisuals */
export function applyBlitzParts(root: Object3D, equippedParts: readonly PartId[]): void {
  applyEquippedPartVisuals(root, "blitz", equippedParts);
}

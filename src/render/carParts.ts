/**
 * Equipped-Teile visuals for every car (CONCEPT §6.3 + parts-look sheets).
 * Meshes are cosmetic only — stats stay in mergeStats.
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

/** Parts that may ship a Blitz Tripo add-on GLB. */
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
};

export type BlitzPartAnchor = PartAnchor;

/**
 * Local offsets on the car clone child (nose +Z for most cars).
 * Käferkraft child is still nose −X (parent yaw π/2) — see KAEFERKRAFT layout.
 */
export const BLITZ_PART_PLACEMENT: Record<BlitzPartMeshId, PartAnchor[]> = {
  rear_spoiler: [{ x: 0, y: 0.78, z: -1.55, yaw: 0, scale: 1.05 }],
  big_engine: [{ x: 0, y: 0.52, z: 1.42, yaw: Math.PI, scale: 0.68 }],
  nitro_kit: [{ x: 0, y: 0.08, z: -1.7, yaw: 0, scale: 1 }],
  spike_bumper: [{ x: 0, y: 0.06, z: 1.7, yaw: 0, scale: 1.12 }],
  offroad_suspension: [
    { x: 0.7, y: 0.06, z: 1.05, yaw: 0, scale: 0.7 },
    { x: -0.7, y: 0.06, z: 1.05, yaw: Math.PI, scale: 0.7 },
    { x: 0.7, y: 0.06, z: -1.08, yaw: 0, scale: 0.7 },
    { x: -0.7, y: 0.06, z: -1.08, yaw: Math.PI, scale: 0.7 },
  ],
  reinforced_frame: [{ x: 0, y: 0.22, z: -0.15, yaw: 0, scale: 1.05 }],
  lightweight_body: [
    { x: 0, y: 0.58, z: 0.38, yaw: 0, scale: 1.65 },
    { x: 0.82, y: 0.42, z: 0.12, yaw: Math.PI / 2, scale: 1.2 },
    { x: -0.82, y: 0.42, z: 0.12, yaw: -Math.PI / 2, scale: 1.2 },
  ],
};

type CarVisualLayout = {
  wheelLift: number;
  suspensionLift: number;
  /** Prefer Blitz Tripo GLB when preloaded (Blitz only). */
  useBlitzGlb: boolean;
  brakes: PartAnchor[];
  springs: PartAnchor[];
  wheelHints: PartAnchor[];
  big_engine: { anchors: PartAnchor[]; build: () => Group };
  spike_bumper: { anchors: PartAnchor[]; build: () => Group };
  reinforced_frame: { anchors: PartAnchor[]; build: () => Group };
  lightweight_body: { anchors: PartAnchor[]; build: () => Group };
  nitro_kit: { anchors: PartAnchor[]; build: () => Group };
  rear_spoiler: { anchors: PartAnchor[]; build: () => Group };
};

function layoutBlitz(): CarVisualLayout {
  return {
    wheelLift: WHEEL_LIFT,
    suspensionLift: SUSPENSION_LIFT,
    useBlitzGlb: true,
    brakes: [
      { x: 0.72, y: 0.28, z: 1.15, yaw: 0, scale: 0.85 },
      { x: -0.72, y: 0.28, z: 1.15, yaw: Math.PI, scale: 0.85 },
      { x: 0.72, y: 0.28, z: -1.15, yaw: 0, scale: 0.85 },
      { x: -0.72, y: 0.28, z: -1.15, yaw: Math.PI, scale: 0.85 },
    ],
    springs: BLITZ_PART_PLACEMENT.offroad_suspension,
    wheelHints: [
      { x: 0.78, y: 0.32, z: 1.15, yaw: 0, scale: 1 },
      { x: -0.78, y: 0.32, z: 1.15, yaw: 0, scale: 1 },
      { x: 0.78, y: 0.32, z: -1.15, yaw: 0, scale: 1 },
      { x: -0.78, y: 0.32, z: -1.15, yaw: 0, scale: 1 },
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
      anchors: [{ x: 0, y: 0.62, z: 0.55, yaw: 0, scale: 1 }],
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
    useBlitzGlb: false,
    brakes: [
      { x: 0.7, y: 0.38, z: 1.25, yaw: 0, scale: 0.95 },
      { x: -0.7, y: 0.38, z: 1.25, yaw: Math.PI, scale: 0.95 },
      { x: 0.7, y: 0.38, z: -1.15, yaw: 0, scale: 0.95 },
      { x: -0.7, y: 0.38, z: -1.15, yaw: Math.PI, scale: 0.95 },
    ],
    springs: [
      { x: 0.65, y: 0.12, z: 1.2, yaw: 0, scale: 0.85 },
      { x: -0.65, y: 0.12, z: 1.2, yaw: 0, scale: 0.85 },
      { x: 0.65, y: 0.12, z: -1.1, yaw: 0, scale: 0.85 },
      { x: -0.65, y: 0.12, z: -1.1, yaw: 0, scale: 0.85 },
    ],
    wheelHints: [
      { x: 0.78, y: 0.42, z: 1.25, yaw: 0, scale: 1.15 },
      { x: -0.78, y: 0.42, z: 1.25, yaw: 0, scale: 1.15 },
      { x: 0.78, y: 0.42, z: -1.15, yaw: 0, scale: 1.15 },
      { x: -0.78, y: 0.42, z: -1.15, yaw: 0, scale: 1.15 },
    ],
    big_engine: {
      anchors: [{ x: 0, y: 0.95, z: 0.85, yaw: 0, scale: 1.05 }],
      build: () => buildHoodScoop("block"),
    },
    spike_bumper: {
      anchors: [{ x: 0, y: 0.22, z: 1.85, yaw: 0, scale: 1.15 }],
      build: () => buildSpikeBumper(4, 1.35),
    },
    reinforced_frame: {
      anchors: [{ x: 0, y: 0.35, z: -0.55, yaw: 0, scale: 1 }],
      build: () => buildReinforcedFrame("pickup"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.95, z: 0.5, yaw: 0, scale: 1 }],
      build: () => buildLightweightBody("hood_bed"),
    },
    nitro_kit: {
      anchors: [{ x: 0, y: 0.55, z: -0.35, yaw: 0, scale: 1 }],
      build: () => buildNitroKit("bed"),
    },
    rear_spoiler: {
      anchors: [{ x: 0, y: 1.35, z: -1.75, yaw: 0, scale: 1.1 }],
      build: () => buildRearSpoiler(),
    },
  };
}

/** Child local: nose −X, width ±Z (parent yaw π/2 → world +Z). */
function layoutKaeferkraft(): CarVisualLayout {
  return {
    wheelLift: 0.08,
    suspensionLift: 0.1,
    useBlitzGlb: false,
    brakes: [
      { x: -1.05, y: 0.42, z: 0.7, yaw: Math.PI / 2, scale: 0.9 },
      { x: -1.05, y: 0.42, z: -0.7, yaw: -Math.PI / 2, scale: 0.9 },
      { x: 1.0, y: 0.42, z: 0.7, yaw: Math.PI / 2, scale: 0.9 },
      { x: 1.0, y: 0.42, z: -0.7, yaw: -Math.PI / 2, scale: 0.9 },
    ],
    springs: [
      { x: -1.0, y: 0.15, z: 0.65, yaw: 0, scale: 0.9 },
      { x: -1.0, y: 0.15, z: -0.65, yaw: 0, scale: 0.9 },
      { x: 0.95, y: 0.15, z: 0.65, yaw: 0, scale: 0.9 },
      { x: 0.95, y: 0.15, z: -0.65, yaw: 0, scale: 0.9 },
    ],
    wheelHints: [
      { x: -1.1, y: 0.45, z: 0.78, yaw: Math.PI / 2, scale: 1.2 },
      { x: -1.1, y: 0.45, z: -0.78, yaw: Math.PI / 2, scale: 1.2 },
      { x: 1.05, y: 0.45, z: 0.78, yaw: Math.PI / 2, scale: 1.2 },
      { x: 1.05, y: 0.45, z: -0.78, yaw: Math.PI / 2, scale: 1.2 },
    ],
    big_engine: {
      // Rear engine behind seats (look sheet)
      anchors: [{ x: 0.95, y: 0.55, z: 0, yaw: -Math.PI / 2, scale: 0.95 }],
      build: () => buildRearEngineBlock(),
    },
    spike_bumper: {
      anchors: [{ x: -1.55, y: 0.28, z: 0, yaw: -Math.PI / 2, scale: 1 }],
      build: () => buildSpikeBumper(4, 1.15),
    },
    reinforced_frame: {
      anchors: [{ x: 0.15, y: 0.2, z: 0, yaw: Math.PI / 2, scale: 1 }],
      build: () => buildReinforcedFrame("buggy"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.5, z: 0, yaw: Math.PI / 2, scale: 1 }],
      build: () => buildLightweightBody("holes"),
    },
    nitro_kit: {
      anchors: [{ x: 1.15, y: 0.7, z: 0, yaw: -Math.PI / 2, scale: 1 }],
      build: () => buildNitroKit("rear_rack"),
    },
    rear_spoiler: {
      anchors: [{ x: 1.25, y: 1.35, z: 0, yaw: -Math.PI / 2, scale: 1 }],
      build: () => buildRearSpoiler(),
    },
  };
}

function layoutDonner(): CarVisualLayout {
  return {
    wheelLift: 0.08,
    suspensionLift: 0.09,
    useBlitzGlb: false,
    brakes: [
      { x: 0.85, y: 0.4, z: 1.35, yaw: 0, scale: 0.9 },
      { x: -0.85, y: 0.4, z: 1.35, yaw: Math.PI, scale: 0.9 },
      { x: 0.95, y: 0.45, z: -1.15, yaw: 0, scale: 1 },
      { x: -0.95, y: 0.45, z: -1.15, yaw: Math.PI, scale: 1 },
    ],
    springs: [
      { x: 0.8, y: 0.15, z: 1.3, yaw: 0, scale: 0.85 },
      { x: -0.8, y: 0.15, z: 1.3, yaw: 0, scale: 0.85 },
      { x: 0.9, y: 0.18, z: -1.1, yaw: 0, scale: 0.95 },
      { x: -0.9, y: 0.18, z: -1.1, yaw: 0, scale: 0.95 },
    ],
    wheelHints: [
      { x: 0.95, y: 0.42, z: 1.35, yaw: 0, scale: 1.05 },
      { x: -0.95, y: 0.42, z: 1.35, yaw: 0, scale: 1.05 },
      { x: 1.05, y: 0.5, z: -1.15, yaw: 0, scale: 1.25 },
      { x: -1.05, y: 0.5, z: -1.15, yaw: 0, scale: 1.25 },
    ],
    big_engine: {
      anchors: [{ x: 0, y: 0.85, z: 0.95, yaw: 0, scale: 1.05 }],
      build: () => buildHoodScoop("blower"),
    },
    spike_bumper: {
      anchors: [{ x: 0, y: 0.25, z: 1.85, yaw: 0, scale: 1.1 }],
      build: () => buildSpikeBumper(5, 1.4),
    },
    reinforced_frame: {
      anchors: [{ x: 0, y: 0.25, z: -0.2, yaw: 0, scale: 1.05 }],
      build: () => buildReinforcedFrame("hotrod"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.7, z: -0.1, yaw: 0, scale: 1.1 }],
      build: () => buildLightweightBody("holes"),
    },
    nitro_kit: {
      anchors: [{ x: 0.95, y: 0.55, z: -0.35, yaw: 0, scale: 1 }],
      build: () => buildNitroKit("side"),
    },
    rear_spoiler: {
      anchors: [{ x: 0, y: 1.15, z: -1.65, yaw: 0, scale: 1.15 }],
      build: () => buildRearSpoiler(),
    },
  };
}

function layoutBunker(): CarVisualLayout {
  return {
    wheelLift: 0.1,
    suspensionLift: 0.12,
    useBlitzGlb: false,
    brakes: [
      { x: 0.85, y: 0.48, z: 1.25, yaw: 0, scale: 1 },
      { x: -0.85, y: 0.48, z: 1.25, yaw: Math.PI, scale: 1 },
      { x: 0.85, y: 0.48, z: -1.2, yaw: 0, scale: 1 },
      { x: -0.85, y: 0.48, z: -1.2, yaw: Math.PI, scale: 1 },
    ],
    springs: [
      { x: 0.8, y: 0.2, z: 1.2, yaw: 0, scale: 1 },
      { x: -0.8, y: 0.2, z: 1.2, yaw: 0, scale: 1 },
      { x: 0.8, y: 0.2, z: -1.15, yaw: 0, scale: 1 },
      { x: -0.8, y: 0.2, z: -1.15, yaw: 0, scale: 1 },
    ],
    wheelHints: [
      { x: 0.95, y: 0.55, z: 1.25, yaw: 0, scale: 1.25 },
      { x: -0.95, y: 0.55, z: 1.25, yaw: 0, scale: 1.25 },
      { x: 0.95, y: 0.55, z: -1.2, yaw: 0, scale: 1.25 },
      { x: -0.95, y: 0.55, z: -1.2, yaw: 0, scale: 1.25 },
    ],
    big_engine: {
      anchors: [{ x: 0, y: 1.35, z: 0.55, yaw: 0, scale: 1.1 }],
      build: () => buildHoodScoop("block"),
    },
    spike_bumper: {
      anchors: [{ x: 0, y: 0.4, z: 1.9, yaw: 0, scale: 1.25 }],
      build: () => buildSpikeBumper(5, 1.55),
    },
    reinforced_frame: {
      anchors: [{ x: 0, y: 0.4, z: -0.1, yaw: 0, scale: 1.05 }],
      build: () => buildReinforcedFrame("armor"),
    },
    lightweight_body: {
      anchors: [{ x: 0, y: 0.9, z: -0.4, yaw: 0, scale: 1.15 }],
      build: () => buildLightweightBody("holes"),
    },
    nitro_kit: {
      anchors: [{ x: -0.85, y: 0.85, z: -1.35, yaw: 0, scale: 1.1 }],
      build: () => buildNitroKit("side"),
    },
    rear_spoiler: {
      anchors: [{ x: 0, y: 1.95, z: -1.55, yaw: 0, scale: 1.15 }],
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

function placeAnchored(group: Group, partId: string, anchors: PartAnchor[], factory: () => Group): void {
  anchors.forEach((anchor, copy) => {
    const inst = factory();
    inst.name = blitzPartObjectName(partId, copy);
    markPartUserData(inst, partId);
    inst.position.set(anchor.x, anchor.y, anchor.z);
    inst.rotation.y = anchor.yaw;
    inst.scale.setScalar(anchor.scale);
    group.add(inst);
  });
}

function mountGlbOrProc(
  group: Group,
  id: BlitzPartMeshId,
  anchors: PartAnchor[],
  preferGlb: boolean,
  procedural: () => Group,
): void {
  const template = preferGlb ? templates.get(id) : undefined;
  if (template) {
    placeAnchored(group, id, anchors, () => clonePartTemplate(template));
    return;
  }
  placeAnchored(group, id, anchors, procedural);
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

/** Attach / hide part meshes from `kit.equippedParts` for any car. */
export function applyEquippedPartVisuals(
  root: Object3D,
  carId: CarId,
  equippedParts: readonly PartId[],
): void {
  root.getObjectByName(CAR_PARTS_GROUP)?.removeFromParent();
  root.getObjectByName("blitzParts")?.removeFromParent();

  if (carId === "blitz") sealBlitzCabinGlass(root);
  else root.getObjectByName(BLITZ_CABIN_GLASS)?.removeFromParent();

  const layout = CAR_PART_LAYOUTS[carId];
  const equipped = new Set(equippedParts);
  applyRideLift(root, carStanceLift(carId, equippedParts));

  const group = new Group();
  group.name = CAR_PARTS_GROUP;
  group.userData.carParts = true;

  if (equipped.has("big_engine")) {
    mountGlbOrProc(
      group,
      "big_engine",
      layout.big_engine.anchors,
      layout.useBlitzGlb,
      layout.big_engine.build,
    );
  }
  if (equipped.has("spike_bumper")) {
    mountGlbOrProc(
      group,
      "spike_bumper",
      layout.spike_bumper.anchors,
      layout.useBlitzGlb,
      layout.spike_bumper.build,
    );
  }
  if (equipped.has("reinforced_frame")) {
    mountGlbOrProc(
      group,
      "reinforced_frame",
      layout.reinforced_frame.anchors,
      layout.useBlitzGlb,
      layout.reinforced_frame.build,
    );
  }
  if (equipped.has("lightweight_body")) {
    mountGlbOrProc(
      group,
      "lightweight_body",
      layout.lightweight_body.anchors,
      layout.useBlitzGlb,
      layout.lightweight_body.build,
    );
  }
  if (equipped.has("nitro_kit")) {
    mountGlbOrProc(
      group,
      "nitro_kit",
      layout.nitro_kit.anchors,
      layout.useBlitzGlb,
      layout.nitro_kit.build,
    );
  }
  if (equipped.has("rear_spoiler")) {
    mountGlbOrProc(
      group,
      "rear_spoiler",
      layout.rear_spoiler.anchors,
      layout.useBlitzGlb,
      layout.rear_spoiler.build,
    );
  }
  if (equipped.has("offroad_suspension")) {
    const springCol = springColorFor(carId);
    if (layout.useBlitzGlb && templates.has("offroad_suspension")) {
      mountGlbOrProc(
        group,
        "offroad_suspension",
        layout.springs,
        true,
        () => buildCoilSpring(springCol),
      );
    } else {
      placeAnchored(group, "offroad_suspension", layout.springs, () => buildCoilSpring(springCol));
    }
  }
  if (equipped.has("better_brakes")) {
    const col = caliperColorFor(carId);
    placeAnchored(group, "better_brakes", layout.brakes, () => buildBrakeUnit(col));
  }
  if (equipped.has("big_wheels")) {
    placeAnchored(group, "big_wheels", layout.wheelHints, () => buildWheelBulkHint());
  }

  if (group.children.length > 0) root.add(group);
}

/** @deprecated Blitz-only name — use applyEquippedPartVisuals */
export function applyBlitzParts(root: Object3D, equippedParts: readonly PartId[]): void {
  applyEquippedPartVisuals(root, "blitz", equippedParts);
}

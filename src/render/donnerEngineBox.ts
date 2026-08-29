import { meshInspectBoxContains, type MeshInspectBox, type MeshInspectVec3 } from "../core/meshInspect";

/**
 * User-painted F6 Kasten around the real Donnerbüchse engine block
 * (not zoomie tails). Mesh-space meters.
 */
export const DONNER_STOCK_ENGINE_BOX: MeshInspectBox = {
  min: { x: -0.755, y: 0.472, z: 0.427 },
  max: { x: 0.568, y: 1.437, z: 1.262 },
  names: [
    "StockEngine / StockEngine_2",
    "BodyPaint / BodyPaint_10",
    "BodyPaint / BodyPaint_2",
    "StockWheel_FL",
    "BodyPaint / BodyPaint_8",
    "BodyPaint / BodyPaint_4",
  ],
};

/** Leftover zoomies / headers the block Kasten missed. Mesh-space meters. */
export const DONNER_STOCK_ENGINE_REMAINDER_BOXES: readonly MeshInspectBox[] = [
  {
    min: { x: 0.647, y: 0.375, z: 0.209 },
    max: { x: 1.056, y: 0.526, z: 0.968 },
    names: [
      "StockEngine / StockEngine_2",
      "BodyPaint / BodyPaint_10",
      "StockEngine / StockEngine_1",
      "BodyPaint / BodyPaint_1",
    ],
  },
  {
    min: { x: 0.305, y: 0.410, z: 0.459 },
    max: { x: 0.854, y: 1.069, z: 1.076 },
    names: ["BodyPaint / BodyPaint_10", "BodyPaint / BodyPaint_2", "StockEngine / StockEngine_2"],
  },
  {
    min: { x: -0.920, y: 0.367, z: 0.439 },
    max: { x: -0.469, y: 0.749, z: 1.049 },
    names: ["StockEngine / StockEngine_2", "BodyPaint / BodyPaint_2", "BodyPaint / BodyPaint_10"],
  },
  {
    min: { x: -0.908, y: 0.293, z: 0.207 },
    max: { x: -0.655, y: 0.989, z: 0.526 },
    names: [
      "StockEngine / StockEngine_2",
      "BodyPaint / BodyPaint_10",
      "StockEngine / StockEngine_1",
      "BodyPaint / BodyPaint_1",
      "BodyPaint / BodyPaint_8",
    ],
  },
  {
    min: { x: -0.897, y: 0.259, z: -0.031 },
    max: { x: -0.665, y: 0.514, z: 0.526 },
    names: [
      "StockEngine / StockEngine_2",
      "BodyPaint / BodyPaint_10",
      "StockEngine / StockEngine_1",
      "BodyPaint / BodyPaint_1",
    ],
  },
  {
    min: { x: 0.678, y: 0.373, z: 0.010 },
    max: { x: 0.960, y: 0.503, z: 0.415 },
    names: [
      "StockEngine / StockEngine_2",
      "BodyPaint / BodyPaint_10",
      "BodyPaint / BodyPaint_1",
      "StockEngine / StockEngine_1",
    ],
  },
  {
    min: { x: 0.649, y: 0.302, z: 0.247 },
    max: { x: 0.945, y: 0.536, z: 0.910 },
    names: [
      "BodyPaint / BodyPaint_8",
      "BodyPaint / BodyPaint_1",
      "BodyPaint / BodyPaint_10",
      "StockEngine / StockEngine_2",
    ],
  },
  {
    min: { x: 0.664, y: 0.284, z: 0.037 },
    max: { x: 0.903, y: 0.365, z: 0.320 },
    names: [
      "BodyPaint / BodyPaint_10",
      "BodyPaint / BodyPaint_1",
      "StockEngine / StockEngine_1",
      "StockEngine / StockEngine_2",
    ],
  },
  {
    min: { x: -1.030, y: 0.204, z: 0.215 },
    max: { x: -0.638, y: 0.569, z: 0.815 },
    names: ["BodyPaint / BodyPaint_10", "BodyPaint / BodyPaint_8", "StockEngine / StockEngine_2"],
  },
  {
    min: { x: 0.313, y: 0.288, z: 0.428 },
    max: { x: 0.900, y: 1.150, z: 0.873 },
    names: ["BodyPaint / BodyPaint_10", "StockEngine / StockEngine_2"],
  },
  {
    min: { x: 0.167, y: 0.458, z: 1.245 },
    max: { x: 0.366, y: 1.012, z: 1.333 },
    names: ["BodyPaint / BodyPaint_10"],
  },
  {
    min: { x: -0.326, y: 0.386, z: 1.169 },
    max: { x: -0.080, y: 0.813, z: 1.300 },
    names: ["BodyPaint / BodyPaint_10", "StockEngine / StockEngine_2"],
  },
  {
    min: { x: -0.906, y: 0.486, z: 1.131 },
    max: { x: -0.777, y: 0.734, z: 1.357 },
    names: ["StockEngine / StockEngine_2", "BodyPaint / BodyPaint_10"],
  },
  {
    min: { x: 0.777, y: 0.263, z: 1.112 },
    max: { x: 1.010, y: 0.600, z: 1.221 },
    names: ["StockEngine / StockEngine_2", "BodyPaint / BodyPaint_10"],
  },
  {
    min: { x: -0.341, y: 1.043, z: 1.292 },
    max: { x: 0.066, y: 1.175, z: 1.342 },
    names: ["BodyPaint / BodyPaint_10", "StockEngine / StockEngine_2"],
  },
];

/** Block + leftover pipes — Motor-aus / remount volume. */
export const DONNER_STOCK_ENGINE_BOXES: readonly MeshInspectBox[] = [
  DONNER_STOCK_ENGINE_BOX,
  ...DONNER_STOCK_ENGINE_REMAINDER_BOXES,
];

export function inDonnerStockEngine(p: MeshInspectVec3, eps = 0): boolean {
  for (const box of DONNER_STOCK_ENGINE_BOXES) {
    if (meshInspectBoxContains(box, p, eps)) return true;
  }
  return false;
}

/** Remaining StockEngine shards sit just outside the painted Kastens. */
export const DONNER_STOCK_ENGINE_HALO = 0.2;

export function inDonnerStockEngineHalo(p: MeshInspectVec3, pad = DONNER_STOCK_ENGINE_HALO): boolean {
  for (const box of DONNER_STOCK_ENGINE_BOXES) {
    if (
      p.x >= box.min.x - pad &&
      p.x <= box.max.x + pad &&
      p.y >= box.min.y - pad &&
      p.y <= box.max.y + pad &&
      p.z >= box.min.z - pad &&
      p.z <= box.max.z + pad
    ) {
      return true;
    }
  }
  return false;
}

export function isDonnerStockEngineObject(obj: { name?: string; parent?: unknown } | null): boolean {
  let p: { name?: string; parent?: unknown } | null | undefined = obj;
  while (p) {
    if ((p.name ?? "") === "StockEngine") return true;
    p = p.parent as { name?: string; parent?: unknown } | null | undefined;
  }
  return false;
}

export const DONNER_ENGINE_BAY_FILL_NAME = "DonnerEngineBayFill";

/** Body-paint block that plugs the hole after Motor-aus. Mesh-space meters. */
export const DONNER_ENGINE_BAY_FILL = {
  x: -0.094,
  y: 0.68,
  z: 0.845,
  sx: 1.12,
  sy: 0.36,
  sz: 0.7,
} as const;

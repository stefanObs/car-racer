import { Group, Mesh } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { OBSTACLE_PROP_BY_TYPE } from "../data/trackModels";
import type { LevelDefinition } from "../track/types";
import { comicToon, withOutline } from "./comicMaterials";
import { cloneTrackProp, hasTrackProp } from "./loadTrackGltf";
import { ComicPalette } from "./palette";

/**
 * On-track props.
 * Solid (bounce): concrete_barrier, tire_stack — tall, clearly blocking.
 * Passable (drive over): uneven rumble strips, oil, ramp (Schanze) — low + high-contrast.
 * Prefer Tripo kit GLBs when preloaded; procedural boxes remain for unit tests without boot.
 */
export function buildLevelObstacles(level: LevelDefinition): Group {
  const root = new Group();
  for (const o of level.obstacles) {
    const [x, z] = o.position;
    const kit = tryTripoObstacle(o.type, x, z, o.radius);
    if (kit) {
      root.add(kit);
      continue;
    }
    switch (o.type) {
      case "concrete_barrier":
        root.add(makeBarrier(x, z, o.radius ?? 1.2));
        break;
      case "tire_stack":
        root.add(makeTireObstacle(x, z));
        break;
      case "uneven":
        root.add(makeRumbleStrip(x, z, o.radius ?? 6));
        break;
      case "ramp":
        root.add(makeRamp(x, z, o.radius ?? 4.5));
        break;
      case "oil":
        root.add(makeOil(x, z, o.radius ?? 2));
        break;
      default:
        break;
    }
  }
  return root;
}

function tryTripoObstacle(type: string, x: number, z: number, radius?: number): Group | null {
  const map = OBSTACLE_PROP_BY_TYPE[type as keyof typeof OBSTACLE_PROP_BY_TYPE];
  if (!map || !hasTrackProp(map.id)) return null;
  const g = cloneTrackProp(map.id);
  if (!g) return null;
  const r = radius ?? map.refRadius;
  const s = Math.max(0.35, r / map.refRadius);
  g.scale.multiplyScalar(s);
  g.position.set(x, 0, z);
  g.userData.obstacle = type;
  return g;
}

function makeBarrier(x: number, z: number, radius: number): Group {
  // Small comic barrier — never the long outer-wall GLB (that read as a wall on the asphalt).
  const g = new Group();
  g.position.set(x, 0, z);
  g.userData.obstacle = "concrete_barrier";
  const w = Math.max(1.6, radius * 2);
  const bar = withOutline(new RoundedBoxGeometry(w, 1.15, 0.55, 2, 0.08), comicToon(ComicPalette.concrete), 0.05);
  bar.position.y = 0.58;
  const stripe = new Mesh(new RoundedBoxGeometry(w * 0.9, 0.2, 0.58, 1, 0.02), comicToon(0xffe066));
  stripe.position.y = 0.75;
  g.add(bar, stripe);
  return g;
}

function makeTireObstacle(x: number, z: number): Group {
  // Compact tire stack prop — not the tiled corner tire-wall module.
  const g = new Group();
  g.position.set(x, 0, z);
  g.userData.obstacle = "tire_stack";
  for (let i = 0; i < 3; i++) {
    const tire = withOutline(
      new RoundedBoxGeometry(1.2, 0.38, 1.2, 3, 0.18),
      comicToon(ComicPalette.tire),
      0.05,
    );
    tire.position.set(0, 0.28 + i * 0.4, (i - 1) * 0.06);
    g.add(tire);
  }
  const accent = new Mesh(new RoundedBoxGeometry(0.25, 0.2, 1.15, 1, 0.04), comicToon(ComicPalette.tireAccent));
  accent.position.set(0, 0.85, 0);
  g.add(accent);
  return g;
}

/** Passable rumble — low height, yellow zebra so kids know to drive over. */
function makeRumbleStrip(x: number, z: number, radius: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  const size = Math.max(4, radius * 1.4);
  const base = withOutline(
    new RoundedBoxGeometry(size, 0.16, size * 0.55, 2, 0.04),
    comicToon(0x4a4f57),
    0.03,
  );
  base.position.y = 0.1;
  g.add(base);
  const stripes = Math.max(4, Math.floor(size / 1.1));
  for (let i = 0; i < stripes; i++) {
    const stripe = new Mesh(
      new RoundedBoxGeometry(size * 0.92, 0.05, 0.35, 1, 0.02),
      comicToon(i % 2 === 0 ? 0xffe066 : 0x1b1b1f),
    );
    stripe.position.set(0, 0.19, (i - (stripes - 1) / 2) * 0.55);
    g.add(stripe);
  }
  return g;
}

/** Passable Schanze — wedge ramp, yellow chevron face. */
function makeRamp(x: number, z: number, radius: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  const len = Math.max(3.2, radius * 1.1);
  const base = withOutline(
    new RoundedBoxGeometry(len * 0.7, 0.22, len, 2, 0.05),
    comicToon(0x8b9098),
    0.04,
  );
  base.position.set(0, 0.2, 0);
  base.rotation.x = -0.28;
  g.add(base);
  const face = withOutline(
    new RoundedBoxGeometry(len * 0.55, 0.08, len * 0.85, 1, 0.03),
    comicToon(ComicPalette.repairSpark),
    0.03,
  );
  face.position.set(0, 0.38, -0.05);
  face.rotation.x = -0.28;
  g.add(face);
  for (let i = 0; i < 3; i++) {
    const chev = new Mesh(
      new RoundedBoxGeometry(0.35, 0.06, 0.55, 1, 0.02),
      comicToon(ComicPalette.outline),
    );
    chev.position.set((i - 1) * 0.55, 0.42, 0.1 - i * 0.15);
    chev.rotation.x = -0.28;
    g.add(chev);
  }
  return g;
}

/** Passable oil — shiny puddle, clear danger marking (not a wall). */
function makeOil(x: number, z: number, radius: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  const puddle = new Mesh(
    new RoundedBoxGeometry(radius * 2, 0.05, radius * 1.4, 1, 0.02),
    comicToon(0x1a1a1f),
  );
  puddle.position.y = 0.16;
  const sheen = new Mesh(
    new RoundedBoxGeometry(radius * 1.2, 0.04, radius * 0.35, 1, 0.02),
    comicToon(0x3db9c7),
  );
  sheen.position.set(0.15, 0.18, 0);
  g.add(puddle, sheen);
  return g;
}

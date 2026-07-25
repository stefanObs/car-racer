import { Group, Mesh } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { LevelDefinition } from "../track/types";
import { comicToon, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

/** On-track props from level.obstacles (visual; physics can hook later). */
export function buildLevelObstacles(level: LevelDefinition): Group {
  const root = new Group();
  for (const o of level.obstacles) {
    const [x, z] = o.position;
    const yaw = 0;
    switch (o.type) {
      case "concrete_barrier":
        root.add(makeBarrier(x, z, yaw, o.radius ?? 1.2));
        break;
      case "tire_stack":
        root.add(makeTireObstacle(x, z, yaw));
        break;
      case "uneven":
        root.add(makeUnevenPatch(x, z, o.radius ?? 6));
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

function makeBarrier(x: number, z: number, yaw: number, radius: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const w = Math.max(1.6, radius * 2);
  const bar = withOutline(new RoundedBoxGeometry(w, 1.1, 0.55, 2, 0.08), comicToon(ComicPalette.concrete), 0.05);
  bar.position.y = 0.55;
  const stripe = new Mesh(new RoundedBoxGeometry(w * 0.9, 0.18, 0.58, 1, 0.02), comicToon(0xffe066));
  stripe.position.y = 0.7;
  g.add(bar, stripe);
  return g;
}

function makeTireObstacle(x: number, z: number, yaw: number): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
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

function makeUnevenPatch(x: number, z: number, radius: number): Mesh {
  const size = Math.max(4, radius * 1.4);
  const patch = withOutline(
    new RoundedBoxGeometry(size, 0.22, size * 0.7, 2, 0.08),
    comicToon(0x5a5f66),
    0.04,
  );
  patch.position.set(x, 0.12, z);
  return patch;
}

function makeOil(x: number, z: number, radius: number): Mesh {
  const oil = new Mesh(
    new RoundedBoxGeometry(radius * 2, 0.04, radius * 1.4, 1, 0.02),
    comicToon(0x1a1a1f),
  );
  oil.position.set(x, 0.16, z);
  return oil;
}

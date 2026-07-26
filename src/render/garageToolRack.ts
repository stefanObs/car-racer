/**
 * Workshop tool rack — Asphalt-Comic 3D tools on a pegboard at arm height.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  TorusGeometry,
} from "three";
import { comicFlat, withOutline } from "./comicMaterials";
import { toolBoardTexture } from "./garageTextures";
import { ComicPalette } from "./palette";

const METAL = 0xd0d4da;
const METAL_DARK = 0x8b9198;

function pegBoardMat() {
  return comicFlat(0xf0d9a8, { map: toolBoardTexture() });
}

/** Open-end wrench — chunky comic silhouette. */
function buildOpenWrench(scale = 1): Group {
  const g = new Group();
  const s = scale;
  const handle = withOutline(new BoxGeometry(0.1 * s, 0.72 * s, 0.08 * s), comicFlat(METAL), 0.02);
  handle.position.y = -0.08 * s;
  // Grip ridges
  for (const dy of [-0.22, -0.1, 0.02] as const) {
    const ridge = withOutline(new BoxGeometry(0.12 * s, 0.04 * s, 0.09 * s), comicFlat(METAL_DARK), 0.012);
    ridge.position.y = dy * s;
    g.add(ridge);
  }
  // C-jaw
  const jaw = withOutline(
    new TorusGeometry(0.13 * s, 0.045 * s, 8, 18, Math.PI * 1.4),
    comicFlat(METAL),
    0.02,
  );
  jaw.rotation.z = Math.PI / 2;
  jaw.position.y = 0.38 * s;
  const cheekL = withOutline(new BoxGeometry(0.06 * s, 0.1 * s, 0.07 * s), comicFlat(METAL), 0.014);
  cheekL.position.set(-0.1 * s, 0.46 * s, 0);
  const cheekR = withOutline(new BoxGeometry(0.06 * s, 0.1 * s, 0.07 * s), comicFlat(METAL), 0.014);
  cheekR.position.set(0.1 * s, 0.46 * s, 0);
  g.add(handle, jaw, cheekL, cheekR);
  return g;
}

/** Screwdriver — bold grip colors, clear tip. */
function buildScrewdriver(grip: number, scale = 1): Group {
  const g = new Group();
  const s = scale;
  const shaft = withOutline(new CylinderGeometry(0.022 * s, 0.022 * s, 0.58 * s, 6), comicFlat(METAL), 0.014);
  shaft.position.y = 0.08 * s;
  const tip = withOutline(new BoxGeometry(0.05 * s, 0.09 * s, 0.025 * s), comicFlat(METAL_DARK), 0.012);
  tip.position.y = 0.4 * s;
  const gripMesh = withOutline(new CylinderGeometry(0.058 * s, 0.065 * s, 0.32 * s, 8), comicFlat(grip), 0.018);
  gripMesh.position.y = -0.3 * s;
  // Comic grip stripe
  const stripe = withOutline(new CylinderGeometry(0.068 * s, 0.068 * s, 0.06 * s, 8), comicFlat(ComicPalette.repairSpark), 0.012);
  stripe.position.y = -0.22 * s;
  const butt = withOutline(new CylinderGeometry(0.07 * s, 0.07 * s, 0.05 * s, 8), comicFlat(ComicPalette.outline), 0.014);
  butt.position.y = -0.48 * s;
  g.add(shaft, tip, gripMesh, stripe, butt);
  return g;
}

/** Claw hammer — wood + steel, thick volumes. */
function buildHammer(scale = 1): Group {
  const g = new Group();
  const s = scale;
  const handle = withOutline(new CylinderGeometry(0.04 * s, 0.048 * s, 0.62 * s, 8), comicFlat(0xc48a4a), 0.018);
  handle.position.y = -0.06 * s;
  const head = withOutline(new BoxGeometry(0.34 * s, 0.14 * s, 0.12 * s), comicFlat(METAL_DARK), 0.02);
  head.position.y = 0.28 * s;
  const claw = withOutline(new BoxGeometry(0.14 * s, 0.07 * s, 0.1 * s), comicFlat(METAL_DARK), 0.016);
  claw.position.set(-0.2 * s, 0.28 * s, 0);
  const face = withOutline(new CylinderGeometry(0.065 * s, 0.065 * s, 0.1 * s, 8), comicFlat(METAL), 0.014);
  face.rotation.z = Math.PI / 2;
  face.position.set(0.18 * s, 0.28 * s, 0);
  g.add(handle, head, claw, face);
  return g;
}

/** Adjustable spanner — yellow adjust knob reads as comic prop. */
function buildSpanner(scale = 1): Group {
  const g = new Group();
  const s = scale;
  const body = withOutline(new BoxGeometry(0.11 * s, 0.58 * s, 0.08 * s), comicFlat(METAL), 0.018);
  body.position.y = -0.02 * s;
  const head = withOutline(new BoxGeometry(0.24 * s, 0.18 * s, 0.09 * s), comicFlat(METAL), 0.018);
  head.position.y = 0.34 * s;
  const jawGap = withOutline(new BoxGeometry(0.09 * s, 0.11 * s, 0.1 * s), comicFlat(ComicPalette.outline), 0.01);
  jawGap.position.y = 0.36 * s;
  const knob = withOutline(new CylinderGeometry(0.045 * s, 0.045 * s, 0.07 * s, 8), comicFlat(ComicPalette.repairSpark), 0.014);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.1 * s, 0.2 * s, 0);
  g.add(body, head, jawGap, knob);
  return g;
}

/**
 * Pegboard + hanging tools at arm height.
 * Local space: board in XY, tools hang toward +Z (into the bay).
 */
export function buildGarageToolRack(): Group {
  const root = new Group();
  root.name = "garageToolBoard";

  const board = withOutline(new BoxGeometry(2.35, 1.2, 0.1), pegBoardMat(), 0.035);
  root.add(board);

  const railTop = withOutline(new BoxGeometry(2.4, 0.09, 0.12), comicFlat(ComicPalette.repairSpark), 0.02);
  railTop.position.set(0, 0.62, 0.03);
  const railBot = withOutline(new BoxGeometry(2.4, 0.09, 0.12), comicFlat(ComicPalette.outline), 0.02);
  railBot.position.set(0, -0.62, 0.03);
  root.add(railTop, railBot);

  // Yellow hook pegs under each tool
  for (const x of [-0.8, -0.2, 0.35, 0.7, 1.05] as const) {
    const peg = withOutline(new CylinderGeometry(0.03, 0.03, 0.1, 6), comicFlat(ComicPalette.repairSpark), 0.01);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(x, 0.42, 0.08);
    root.add(peg);
  }

  const wrench = buildOpenWrench(1.05);
  wrench.position.set(-0.8, -0.05, 0.16);
  wrench.rotation.z = -0.06;

  const spanner = buildSpanner(1.0);
  spanner.position.set(-0.2, -0.08, 0.16);
  spanner.rotation.z = 0.08;

  const driver = buildScrewdriver(0xe03131, 1.0);
  driver.position.set(0.35, -0.1, 0.16);

  const driver2 = buildScrewdriver(0x339af0, 0.88);
  driver2.position.set(0.7, -0.02, 0.16);

  const hammer = buildHammer(0.95);
  hammer.position.set(1.05, -0.12, 0.18);
  hammer.rotation.z = 0.1;

  root.add(wrench, spanner, driver, driver2, hammer);
  return root;
}

/** Loose comic tools for the workbench top. */
export function buildBenchLooseTools(): Group {
  const g = new Group();
  g.name = "garageBenchTools";

  const wrench = buildOpenWrench(0.75);
  wrench.rotation.x = Math.PI / 2;
  wrench.rotation.z = 0.45;
  wrench.position.set(-1.15, 0.09, 0.12);

  const driver = buildScrewdriver(0xe03131, 0.8);
  driver.rotation.x = Math.PI / 2;
  driver.rotation.z = -0.55;
  driver.position.set(-0.3, 0.07, -0.18);

  const hammer = buildHammer(0.72);
  hammer.rotation.x = Math.PI / 2;
  hammer.rotation.z = 1.05;
  hammer.position.set(0.5, 0.11, 0.08);

  const oil = withOutline(new CylinderGeometry(0.14, 0.18, 0.35, 8), comicFlat(0xe03131), 0.02);
  oil.position.set(1.15, 0.2, -0.25);
  const oilCap = withOutline(new CylinderGeometry(0.06, 0.06, 0.08, 8), comicFlat(ComicPalette.outline), 0.015);
  oilCap.position.set(1.15, 0.4, -0.25);
  const oilLabel = withOutline(new BoxGeometry(0.22, 0.14, 0.02), comicFlat(ComicPalette.repairSpark), 0.01);
  oilLabel.position.set(1.15, 0.22, -0.1);

  g.add(wrench, driver, hammer, oil, oilCap, oilLabel);
  return g;
}

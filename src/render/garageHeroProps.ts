/**
 * Comic hero props matching `assets/tripo-concepts/garage-*-concept.png`.
 * Runtime prefers Tripo GLBs via `cloneGarageProp`; these builders are the
 * unit-test fallback when preload has not run.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh } from "three";
import { comicFlat, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

const RED = 0xe03131;
const RED_DARK = 0xb02525;
const YELLOW = ComicPalette.repairSpark;
const INK = ComicPalette.outline;
const STEEL = 0x8b9098;
const STEEL_DARK = 0x5c636a;

function addOutlined(parent: Group, geo: BoxGeometry | CylinderGeometry, color: number, outline = 0.035): Mesh {
  const mesh = withOutline(geo, comicFlat(color), outline);
  parent.add(mesh);
  return mesh;
}

/** Red rolling tool chest — left of the pad. */
export function buildGarageToolChest(): Group {
  const g = new Group();
  g.name = "garageToolChest";
  const body = addOutlined(g, new BoxGeometry(0.95, 1.05, 0.52), RED, 0.04);
  body.position.y = 0.62;
  // Drawers on +X — matches Tripo bake front (local +X).
  for (let i = 0; i < 6; i++) {
    const drawer = new Mesh(new BoxGeometry(0.08, 0.11, 0.42), comicFlat(RED_DARK));
    drawer.position.set(0.24, 0.28 + i * 0.15, 0);
    g.add(drawer);
    const handle = new Mesh(new BoxGeometry(0.04, 0.035, 0.22), comicFlat(INK));
    handle.position.set(0.29, 0.28 + i * 0.15, 0);
    g.add(handle);
  }
  const top = addOutlined(g, new BoxGeometry(0.98, 0.08, 0.55), RED_DARK, 0.03);
  top.position.y = 1.18;
  const bottle = addOutlined(g, new CylinderGeometry(0.05, 0.05, 0.18, 8), 0x339af0, 0.02);
  bottle.position.set(-0.22, 1.32, 0);
  const batt = addOutlined(g, new BoxGeometry(0.28, 0.12, 0.18), 0x2f9e44, 0.02);
  batt.position.set(0.18, 1.28, 0.02);
  for (const x of [-0.32, 0.32] as const) {
    for (const z of [-0.16, 0.16] as const) {
      const wheel = new Mesh(new CylinderGeometry(0.07, 0.07, 0.06, 10), comicFlat(INK));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.07, z);
      g.add(wheel);
    }
  }
  return g;
}

/** Twin red gas bottles on a small rack. */
export function buildGarageGasBottles(): Group {
  const g = new Group();
  g.name = "garageGasBottles";
  const rack = addOutlined(g, new BoxGeometry(0.72, 0.08, 0.38), STEEL_DARK, 0.03);
  rack.position.y = 0.06;
  for (const x of [-0.16, 0.16] as const) {
    const tank = addOutlined(g, new CylinderGeometry(0.12, 0.13, 1.05, 12), RED, 0.04);
    tank.position.set(x, 0.6, 0);
    const band = new Mesh(new CylinderGeometry(0.135, 0.135, 0.1, 12), comicFlat(YELLOW));
    band.position.set(x, 0.55, 0);
    g.add(band);
    const cap = addOutlined(g, new CylinderGeometry(0.05, 0.06, 0.12, 8), INK, 0.02);
    cap.position.set(x, 1.18, 0);
    const valve = new Mesh(new BoxGeometry(0.14, 0.04, 0.04), comicFlat(STEEL));
    valve.position.set(x + 0.08, 1.22, 0);
    g.add(valve);
  }
  return g;
}

/** Yellow engine hoist / cherry picker. */
export function buildGarageHoist(): Group {
  const g = new Group();
  g.name = "garageHoist";
  const base = addOutlined(g, new BoxGeometry(1.15, 0.1, 0.7), STEEL_DARK, 0.035);
  base.position.y = 0.08;
  const mast = addOutlined(g, new BoxGeometry(0.12, 1.55, 0.12), YELLOW, 0.04);
  mast.position.set(-0.35, 0.88, 0);
  const arm = addOutlined(g, new BoxGeometry(1.35, 0.1, 0.1), YELLOW, 0.035);
  arm.position.set(0.28, 1.58, 0);
  const brace = addOutlined(g, new BoxGeometry(0.08, 0.7, 0.08), YELLOW, 0.03);
  brace.position.set(-0.05, 1.22, 0);
  brace.rotation.z = 0.45;
  const hook = addOutlined(g, new CylinderGeometry(0.04, 0.04, 0.28, 8), INK, 0.02);
  hook.position.set(0.88, 1.38, 0);
  for (const x of [-0.42, 0.42] as const) {
    for (const z of [-0.22, 0.22] as const) {
      const wheel = new Mesh(new CylinderGeometry(0.08, 0.08, 0.07, 10), comicFlat(INK));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.08, z);
      g.add(wheel);
    }
  }
  return g;
}

/**
 * Spin + front-steer for authored StockWheel_* (Bison, Käferkraft).
 * Geometry is thin along local X (axle); roll = spinner.rotation.x, steer = yaw on front only.
 */
import { Box3, Group, Object3D, Vector3 } from "three";
import {
  isStockWheelRoot,
  STOCK_WHEEL_PREFIX,
  type WheelCorner,
} from "./stockWheels";

export type WheelMount = {
  /** Yaw pivot — front axle turns with steer. */
  steer: Group;
  /** Roll spinner (local X = axle). */
  spinner: Group;
  radius: number;
  isFront: boolean;
};

const _size = new Vector3();
const _box = new Box3();

/** Max front-wheel yaw (rad) at full stick. */
export const MAX_STEER_YAW = 0.42;

/** Gentle garage showcase roll (m/s equivalent). */
export const GARAGE_IDLE_WHEEL_SPEED = 2.6;

export function mountCarWheels(carRoot: Object3D): WheelMount[] {
  const existing = collectSpinMounts(carRoot);
  if (existing.length === 4) {
    publishSpinWheels(existing);
    return existing;
  }

  const stock = collectStockWheelRoots(carRoot);
  if (stock.length !== 4) return [];

  const mounts: WheelMount[] = [];
  for (const wheel of stock) {
    const corner = cornerFromStockName(wheel.name);
    if (!corner) continue;
    const isFront = corner === "FL" || corner === "FR";
    const parent = wheel.parent;
    if (!parent) continue;

    const radius = radiusOf(wheel);
    const { steer, spinner } = makeWheelRig(corner, wheel.position, isFront, radius);

    parent.add(steer);
    // Bake hub (incl. any Große-Räder drop) into the steer pivot; mesh sits at local origin.
    carRoot.updateMatrixWorld(true);
    spinner.attach(wheel);
    wheel.position.set(0, 0, 0);
    delete wheel.userData.stockWheelBaseY;

    mounts.push({ steer, spinner, radius, isFront });
  }

  if (mounts.length !== 4) return [];
  publishSpinWheels(mounts);
  return mounts;
}

export function spinCarWheels(wheels: WheelMount[], speed: number, dt: number, steer = 0): void {
  const yaw = Math.max(-MAX_STEER_YAW, Math.min(MAX_STEER_YAW, steer * MAX_STEER_YAW));
  for (const w of wheels) {
    w.spinner.rotation.x += (speed * dt) / Math.max(w.radius, 0.08);
    w.steer.rotation.y = w.isFront ? yaw : 0;
  }
}

/** Map heading change → clamped steer (−1..1) when no stick sample is available. */
export function steerFromHeadingDelta(prevHeading: number, heading: number): number {
  let d = heading - prevHeading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.max(-1, Math.min(1, d * 8));
}

export function collectSpinMounts(root: Object3D): WheelMount[] {
  const mounts: WheelMount[] = [];
  root.traverse((obj) => {
    if (!obj.name.startsWith("WheelSpin_")) return;
    const steer = namedAncestor(obj, "WheelSteer_");
    if (!steer) return;
    const corner = obj.name.slice("WheelSpin_".length) as WheelCorner;
    const isFront = corner === "FL" || corner === "FR";
    const radius =
      typeof obj.userData.wheelRadius === "number" ? obj.userData.wheelRadius : radiusOf(obj);
    mounts.push({ steer, spinner: obj as Group, radius, isFront });
  });
  return mounts;
}

function collectStockWheelRoots(root: Object3D): Object3D[] {
  const out: Object3D[] = [];
  root.traverse((obj) => {
    if (!isStockWheelRoot(obj)) return;
    if (isUnderWheelRig(obj)) return;
    out.push(obj);
  });
  return out;
}

function cornerFromStockName(name: string): WheelCorner | null {
  if (!name.startsWith(STOCK_WHEEL_PREFIX)) return null;
  const c = name.slice(STOCK_WHEEL_PREFIX.length);
  if (c === "FL" || c === "FR" || c === "RL" || c === "RR") return c;
  return null;
}

function makeWheelRig(
  corner: WheelCorner,
  local: { x: number; y: number; z: number },
  isFront: boolean,
  radius: number,
): { steer: Group; spinner: Group } {
  const steer = new Group();
  steer.name = `WheelSteer_${corner}`;
  steer.position.set(local.x, local.y, local.z);
  steer.userData.isWheel = true;

  const spinner = new Group();
  spinner.name = `WheelSpin_${corner}`;
  spinner.userData.wheelRadius = radius;
  spinner.userData.isFront = isFront;
  spinner.userData.isWheel = true;
  spinner.userData.spinWheel = true;

  steer.add(spinner);
  return { steer, spinner };
}

function radiusOf(obj: Object3D): number {
  if (typeof obj.userData.wheelRadius === "number") return obj.userData.wheelRadius;
  _box.setFromObject(obj);
  _box.getSize(_size);
  return Math.max(_size.y, _size.z, 0.16) * 0.5;
}

function namedAncestor(obj: Object3D, prefix: string): Group | null {
  let p: Object3D | null = obj.parent;
  while (p) {
    if (p.name.startsWith(prefix)) return p as Group;
    p = p.parent;
  }
  return null;
}

function isUnderWheelRig(obj: Object3D): boolean {
  let p: Object3D | null = obj.parent;
  while (p) {
    if (p.name.startsWith("WheelSteer_") || p.name.startsWith("WheelSpin_")) return true;
    p = p.parent;
  }
  return false;
}

function publishSpinWheels(mounts: WheelMount[]): void {
  const g = globalThis as unknown as { __spinWheels?: WheelMount[] };
  const prev = (g.__spinWheels ?? []).filter((w) => w.spinner.parent);
  g.__spinWheels = [...prev, ...mounts];
}

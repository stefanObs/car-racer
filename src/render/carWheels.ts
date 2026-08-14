/**
 * Spin + front-steer for authored StockWheel_* (Bison, Käferkraft, …).
 * Axle = thinnest local AABB axis (Bison X, Käferkraft Z after bake).
 */
import { Box3, Group, Object3D, Vector3 } from "three";
import {
  isStockWheelRoot,
  STOCK_WHEEL_PREFIX,
  type WheelCorner,
} from "./stockWheels";

export type SpinAxis = 0 | 1 | 2;

export type WheelMount = {
  /** Yaw pivot — front axle turns with steer. */
  steer: Group;
  /** Roll spinner (local axle). */
  spinner: Group;
  radius: number;
  isFront: boolean;
  /** Local axle: 0=x, 1=y, 2=z. */
  axis: SpinAxis;
};

const _size = new Vector3();
const _box = new Box3();

/** Max front-wheel yaw (rad) at full stick. */
export const MAX_STEER_YAW = 0.42;

/**
 * Visual steer vs stick: positive stick (left) yaws wheels the other way in
 * Three.js Y-up, so we negate.
 */
export function steerYawFromInput(steer: number): number {
  return Math.max(-MAX_STEER_YAW, Math.min(MAX_STEER_YAW, -steer * MAX_STEER_YAW));
}

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

    const { axis, radius } = wheelMetrics(wheel);
    const { steer, spinner } = makeWheelRig(corner, wheel.position, isFront, radius, axis);

    parent.add(steer);
    // Bake hub (incl. any Große-Räder drop) into the steer pivot; mesh sits at local origin.
    carRoot.updateMatrixWorld(true);
    spinner.attach(wheel);
    wheel.position.set(0, 0, 0);
    delete wheel.userData.stockWheelBaseY;

    mounts.push({ steer, spinner, radius, isFront, axis });
  }

  if (mounts.length !== 4) return [];
  publishSpinWheels(mounts);
  return mounts;
}

export function spinCarWheels(wheels: WheelMount[], speed: number, dt: number, steer = 0): void {
  const yaw = steerYawFromInput(steer);
  for (const w of wheels) {
    const dAng = (speed * dt) / Math.max(w.radius, 0.08);
    if (w.axis === 0) w.spinner.rotation.x += dAng;
    else if (w.axis === 1) w.spinner.rotation.y += dAng;
    else w.spinner.rotation.z += dAng;
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
    const axis =
      typeof obj.userData.spinAxis === "number" ? (obj.userData.spinAxis as SpinAxis) : wheelMetrics(obj).axis;
    const radius =
      typeof obj.userData.wheelRadius === "number" ? obj.userData.wheelRadius : wheelMetrics(obj).radius;
    mounts.push({ steer, spinner: obj as Group, radius, isFront, axis });
  });
  return mounts;
}

/** Thinnest local AABB axis = axle; radius = half the larger of the other two. */
export function wheelMetrics(obj: Object3D): { axis: SpinAxis; radius: number } {
  _box.setFromObject(obj);
  _box.getSize(_size);
  const x = Math.max(_size.x, 1e-4);
  const y = Math.max(_size.y, 1e-4);
  const z = Math.max(_size.z, 1e-4);
  let axis: SpinAxis = 0;
  if (x <= y && x <= z) axis = 0;
  else if (y <= x && y <= z) axis = 1;
  else axis = 2;
  const a = axis === 0 ? y : x;
  const b = axis === 2 ? y : z;
  const radius = Math.max(a, b, 0.16) * 0.5;
  return { axis, radius };
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
  axis: SpinAxis,
): { steer: Group; spinner: Group } {
  const steer = new Group();
  steer.name = `WheelSteer_${corner}`;
  steer.position.set(local.x, local.y, local.z);
  steer.userData.isWheel = true;

  const spinner = new Group();
  spinner.name = `WheelSpin_${corner}`;
  spinner.userData.wheelRadius = radius;
  spinner.userData.spinAxis = axis;
  spinner.userData.isFront = isFront;
  spinner.userData.isWheel = true;
  spinner.userData.spinWheel = true;

  steer.add(spinner);
  return { steer, spinner };
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

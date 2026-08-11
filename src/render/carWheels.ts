/**
 * Spinning comic wheels. Prefers native Tire/Wheel meshes; otherwise instances
 * a shared Tripo wheel at four detected hubs (covers painted-on tires).
 */
import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  Vector3,
  type Material,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { type CarId } from "../data/cars";
import { comicToon } from "./comicMaterials";
import { ComicPalette } from "./palette";

/** Shared comic-wheel radius (meters). Hot rod keeps fatter rears. */
export type CarWheelFit = {
  radius: number;
  rearRadius?: number;
};

export const CAR_WHEEL_FIT: Record<CarId, CarWheelFit> = {
  blitz: { radius: 0.32 },
  bison: { radius: 0.36 },
  kaeferkraft: { radius: 0.38 },
  donnerbuechse: { radius: 0.26, rearRadius: 0.48 },
  bunker: { radius: 0.42 },
};

export function wheelFitFor(carId: CarId): CarWheelFit {
  return CAR_WHEEL_FIT[carId];
}

export const COMIC_WHEEL_URL = "/models/props/comic-wheel.glb";
export const GARAGE_IDLE_WHEEL_SPEED = 2.6;

const CORNER_NAMES = ["FL", "FR", "RL", "RR"] as const;

export type WheelMount = {
  /** Yaw pivot (front steer). */
  steer: Group;
  /** Roll spinner (local X = axle after align). */
  spinner: Group;
  radius: number;
  isFront: boolean;
};

const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();
const _world = new Vector3();

let templateRoot: Group | null = null;
let preloadPromise: Promise<void> | null = null;

export function preloadComicWheel(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    try {
      const gltf = await new GLTFLoader().loadAsync(COMIC_WHEEL_URL);
      templateRoot = prepareWheelTemplate(gltf.scene);
    } catch {
      templateRoot = makeProceduralComicWheel();
    }
  })();
  return preloadPromise;
}

export function comicWheelTemplate(): Group {
  if (!templateRoot) templateRoot = makeProceduralComicWheel();
  return templateRoot;
}

/** Unit tests / missing GLB — axle along X, hub at origin, radius 1. */
export function makeProceduralComicWheel(): Group {
  const root = new Group();
  root.name = "Wheel";
  const tire = new Mesh(
    new CylinderGeometry(1, 1, 0.36, 20),
    comicToon(ComicPalette.tire),
  );
  tire.rotation.z = Math.PI / 2;
  tire.name = "Tire";
  nameTireMaterial(tire);
  const stripe = new Mesh(
    new CylinderGeometry(1.03, 1.03, 0.1, 20),
    comicToon(ComicPalette.tireAccent),
  );
  stripe.rotation.z = Math.PI / 2;
  stripe.name = "TireStripe";
  nameTireMaterial(stripe);
  const rim = new Mesh(new CylinderGeometry(0.62, 0.62, 0.38, 16), comicToon(0xdce2e8));
  rim.rotation.z = Math.PI / 2;
  rim.name = "WheelRim";
  nameTireMaterial(rim);
  const hub = new Mesh(new CylinderGeometry(0.18, 0.18, 0.4, 12), comicToon(ComicPalette.tireAccent));
  hub.rotation.z = Math.PI / 2;
  hub.name = "WheelHub";
  nameTireMaterial(hub);
  root.add(tire, stripe, rim, hub);
  for (let i = 0; i < 5; i++) {
    const spoke = new Mesh(new BoxGeometry(0.06, 0.9, 0.08), comicToon(0xdce2e8));
    spoke.rotation.x = (i / 5) * Math.PI;
    spoke.name = "WheelSpoke";
    nameTireMaterial(spoke);
    root.add(spoke);
  }
  root.userData.wheelRadius = 1;
  root.userData.comicWheel = true;
  return root;
}

export function mountCarWheels(carRoot: Object3D, carId: CarId): WheelMount[] {
  const existing = collectSpinMounts(carRoot);
  const mounts =
    existing.length === 4
      ? existing
      : (() => {
          carRoot.updateMatrixWorld(true);
          const carBox = new Box3().setFromObject(carRoot);
          const carSize = carBox.getSize(new Vector3());
          const carCenter = carBox.getCenter(new Vector3());
          const native = nativeTireMeshes(carRoot);
          const nativeHubs = native.length >= 4 ? clusterMeshHubs(native, 4) : null;
          if (nativeHubs && hubsLookLikeWheels(nativeHubs, carSize)) {
            return mountNativeWheels(carRoot, carId, nativeHubs);
          }
          return mountSharedWheels(carRoot, carId, detectHubPositions(carRoot), carBox, carSize, carCenter);
        })();
  for (const w of mounts) attachAutoRoll(w.spinner, w.radius);
  registerDevWheels(mounts);
  return mounts;
}

export function spinCarWheels(wheels: WheelMount[], speed: number, dt: number, steer = 0): void {
  const yaw = Math.max(-0.42, Math.min(0.42, steer * 0.42));
  for (const w of wheels) {
    w.spinner.userData.manualSpin = true;
    w.spinner.rotation.x += (speed * dt) / Math.max(w.radius, 0.08);
    w.steer.rotation.y = w.isFront ? yaw : 0;
  }
}

export function collectSpinMounts(root: Object3D): WheelMount[] {
  const found: WheelMount[] = [];
  root.traverse((obj) => {
    if (!obj.name.startsWith("WheelSpin_")) return;
    const steer = namedAncestor(obj, "WheelSteer_");
    if (!steer) return;
    const isFront = obj.name.endsWith("_FL") || obj.name.endsWith("_FR");
    found.push({
      steer,
      spinner: obj as Group,
      radius: Number(obj.userData.wheelRadius) || 0.32,
      isFront,
    });
  });
  return found;
}

function namedAncestor(obj: Object3D, prefix: string): Group | null {
  let p: Object3D | null = obj.parent;
  while (p) {
    if (p.name.startsWith(prefix) && p instanceof Group) return p;
    p = p.parent;
  }
  return null;
}

export function steerFromHeadingDelta(prevHeading: number, heading: number): number {
  let d = heading - prevHeading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.max(-1, Math.min(1, d * 16));
}

function prepareWheelTemplate(scene: Object3D): Group {
  const wrap = new Group();
  wrap.name = "Wheel";
  wrap.add(scene);
  wrap.updateMatrixWorld(true);
  _box.setFromObject(wrap);
  _box.getSize(_size);
  _box.getCenter(_center);
  scene.position.x -= _center.x;
  scene.position.y -= _center.y;
  scene.position.z -= _center.z;
  const axle = thinnestAxis(_size);
  if (axle === 1) wrap.rotation.z = -Math.PI / 2;
  else if (axle === 2) wrap.rotation.y = Math.PI / 2;
  wrap.updateMatrixWorld(true);
  _box.setFromObject(wrap);
  _box.getSize(_size);
  const radius = Math.max(_size.y, _size.z) * 0.5;
  wrap.userData.wheelRadius = radius > 0.01 ? radius : 0.5;
  wrap.userData.comicWheel = true;
  wrap.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      const std = mat as Material & { map?: unknown; color?: { r: number; g: number; b: number } };
      const mapped = Boolean(std?.map);
      const toon = comicToon(mapped ? 0xffffff : ComicPalette.tire);
      toon.name = "Tire";
      if (mapped) {
        toon.map = std.map as never;
        toon.needsUpdate = true;
      }
      return toon;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
    if (!mesh.name || mesh.name.startsWith("tripo")) mesh.name = "Tire";
    mesh.userData.comicWheel = true;
  });
  return wrap;
}

function thinnestAxis(size: Vector3): 0 | 1 | 2 {
  if (size.x <= size.y && size.x <= size.z) return 0;
  if (size.y <= size.x && size.y <= size.z) return 1;
  return 2;
}

function nameTireMaterial(mesh: Mesh): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) {
    if (mat) mat.name = "Tire";
  }
}

function nativeTireMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.userData.comicWheel || mesh.userData.outlineShell) return;
    if (isUnderWheelNode(mesh)) return;
    if (!isTireNamed(mesh)) return;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const r = mesh.geometry.boundingSphere?.radius ?? 0;
    if (r < 0.06) return;
    out.push(mesh);
  });
  return out;
}

function isUnderWheelNode(obj: Object3D): boolean {
  let p: Object3D | null = obj;
  while (p) {
    if (p.name.startsWith("WheelSteer_") || p.name.startsWith("WheelSpin_")) return true;
    p = p.parent;
  }
  return false;
}

function isTireNamed(mesh: Mesh): boolean {
  const matName = (
    Array.isArray(mesh.material)
      ? mesh.material.map((m: Material) => m?.name ?? "").join(" ")
      : ((mesh.material as Material | undefined)?.name ?? "")
  ).toLowerCase();
  const blob = `${mesh.name} ${mesh.parent?.name ?? ""} ${matName}`.toLowerCase();
  return blob.includes("tire") || blob.includes("wheel") || blob.includes("rubber");
}

type HubCluster = { center: Vector3; meshes: Mesh[]; radius: number };

function clusterMeshHubs(meshes: Mesh[], k: number): HubCluster[] {
  const pts = meshes.map((m) => {
    _box.setFromObject(m);
    return _box.getCenter(new Vector3());
  });
  const cents = seedCornersFromPoints(pts);
  const assign = new Array<number>(pts.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = xzDist2(pts[i]!, cents[c]!);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    for (let c = 0; c < k; c++) {
      let x = 0;
      let y = 0;
      let z = 0;
      let n = 0;
      for (let i = 0; i < pts.length; i++) {
        if (assign[i] !== c) continue;
        x += pts[i]!.x;
        y += pts[i]!.y;
        z += pts[i]!.z;
        n++;
      }
      if (n) cents[c]!.set(x / n, y / n, z / n);
    }
  }
  return cents.map((center, c) => {
    const group = meshes.filter((_, i) => assign[i] === c);
    let radius = 0.2;
    for (const mesh of group) {
      _box.setFromObject(mesh);
      radius = Math.max(radius, (_box.max.y - _box.min.y) * 0.5, (_box.max.z - _box.min.z) * 0.35);
    }
    return { center, meshes: group, radius };
  });
}

function gatherHubExtras(root: Object3D, hub: HubCluster): Mesh[] {
  const extra: Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (hub.meshes.includes(mesh)) return;
    if (mesh.userData.comicWheel || mesh.userData.outlineShell) return;
    if (isUnderWheelNode(mesh)) return;
    _box.setFromObject(mesh);
    const c = _box.getCenter(new Vector3());
    if (c.distanceTo(hub.center) > hub.radius * 1.25) return;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const r = mesh.geometry.boundingSphere?.radius ?? 0;
    if (r > hub.radius * 1.1) return;
    extra.push(mesh);
  });
  return extra;
}

function hubsLookLikeWheels(hubs: HubCluster[], carSize: Vector3): boolean {
  if (hubs.length !== 4) return false;
  if (hubs.some((h) => h.meshes.length === 0)) return false;
  const xs = hubs.map((h) => h.center.x).sort((a, b) => a - b);
  const zs = hubs.map((h) => h.center.z).sort((a, b) => a - b);
  const track = xs[3]! - xs[0]!;
  const base = zs[3]! - zs[0]!;
  const span = Math.max(carSize.x, carSize.z);
  return track > span * 0.18 && base > span * 0.18;
}

function detectHubPositions(root: Object3D): Vector3[] {
  const samples = sampleLowVertices(root);
  if (samples.length < 16) return bboxCornerHubs(root);
  const cents = kmeans4(samples);
  if (!centroidsAreSpread(cents, samples)) return bboxCornerHubs(root);
  return cents;
}

function sampleLowVertices(root: Object3D): Vector3[] {
  _box.setFromObject(root);
  _box.getSize(_size);
  _box.getCenter(_center);
  const yCut = _box.min.y + _size.y * 0.28;
  const widthAlongX = _size.x < _size.z;
  const halfTrack = Math.max(widthAlongX ? _size.x : _size.z, 1e-4) * 0.5;
  const pts: Vector3[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.userData.comicWheel || mesh.userData.outlineShell) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 2200));
    for (let i = 0; i < pos.count; i += step) {
      _world.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (_world.y > yCut) continue;
      const lateral = widthAlongX ? Math.abs(_world.x - _center.x) : Math.abs(_world.z - _center.z);
      if (lateral < halfTrack * 0.32) continue;
      pts.push(_world.clone());
    }
  });
  return pts;
}

function kmeans4(pts: Vector3[]): Vector3[] {
  const cents = seedCornersFromPoints(pts);
  for (let iter = 0; iter < 10; iter++) {
    const buckets: Vector3[][] = [[], [], [], []];
    for (const p of pts) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < 4; i++) {
        const d = xzDist2(p, cents[i]!);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      buckets[best]!.push(p);
    }
    for (let i = 0; i < 4; i++) {
      const b = buckets[i]!;
      if (!b.length) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      for (const p of b) {
        x += p.x;
        y += p.y;
        z += p.z;
      }
      cents[i]!.set(x / b.length, y / b.length, z / b.length);
    }
  }
  return cents;
}

function seedCornersFromPoints(pts: Vector3[]): Vector3[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let y = 0;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
    y += p.y;
  }
  y /= Math.max(pts.length, 1);
  const mx = (minX + maxX) / 2;
  const mz = (minZ + maxZ) / 2;
  return [
    new Vector3((minX + mx) / 2, y, (maxZ + mz) / 2),
    new Vector3((maxX + mx) / 2, y, (maxZ + mz) / 2),
    new Vector3((minX + mx) / 2, y, (minZ + mz) / 2),
    new Vector3((maxX + mx) / 2, y, (minZ + mz) / 2),
  ];
}

function centroidsAreSpread(cents: Vector3[], pts: Vector3[]): boolean {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 0.2);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (cents[i]!.distanceTo(cents[j]!) < span * 0.12) return false;
    }
  }
  const left = cents.filter((c) => c.x < (minX + maxX) / 2).length;
  const front = cents.filter((c) => c.z > (minZ + maxZ) / 2).length;
  return left === 2 && front === 2;
}

function bboxCornerHubs(root: Object3D): Vector3[] {
  _box.setFromObject(root);
  _box.getSize(_size);
  const y = _box.min.y + Math.min(_size.y * 0.22, 0.45);
  const insetX = _size.x * 0.12;
  const insetZ = _size.z * 0.14;
  const x0 = _box.min.x + insetX;
  const x1 = _box.max.x - insetX;
  const z0 = _box.min.z + insetZ;
  const z1 = _box.max.z - insetZ;
  return [
    new Vector3(x0, y, z1),
    new Vector3(x1, y, z1),
    new Vector3(x0, y, z0),
    new Vector3(x1, y, z0),
  ];
}

function mountNativeWheels(carRoot: Object3D, carId: CarId, hubs: HubCluster[]): WheelMount[] {
  carRoot.updateMatrixWorld(true);
  const carSize = new Box3().setFromObject(carRoot).getSize(new Vector3());
  const labeled = labelCorners(
    hubs.map((h) => h.center),
    carSize,
  );
  const fit = wheelFitFor(carId);
  const mounts: WheelMount[] = [];
  for (let i = 0; i < 4; i++) {
    const hub = hubs.find((h) => h.center === labeled[i]!.pos) ?? hubs[i]!;
    const isFront = i < 2;
    const radius = hub.radius || (isFront ? fit.radius : (fit.rearRadius ?? fit.radius));
    const local = worldToLocal(carRoot, hub.center);
    const { steer, spinner } = makeWheelRig(CORNER_NAMES[i]!, local, isFront, radius, false);
    carRoot.add(steer);
    const extras = gatherHubExtras(carRoot, hub);
    for (const mesh of [...hub.meshes, ...extras]) {
      spinner.attach(mesh);
      markWheelMesh(mesh);
    }
    mounts.push({ steer, spinner, radius, isFront });
  }
  return mounts;
}

function mountSharedWheels(
  carRoot: Object3D,
  carId: CarId,
  hubs: Vector3[],
  carBox: Box3,
  carSize: Vector3,
  carCenter: Vector3,
): WheelMount[] {
  const labeled = labelCorners(hubs, carSize);
  const fit = wheelFitFor(carId);
  const template = comicWheelTemplate();
  const templateR = Number(template.userData.wheelRadius) || 1;
  const lengthAlongZ = carSize.z >= carSize.x;
  const mounts: WheelMount[] = [];
  for (let i = 0; i < 4; i++) {
    const isFront = i < 2;
    const radius = isFront ? fit.radius : (fit.rearRadius ?? fit.radius);
    const world = labeled[i]!.pos.clone();
    world.y = Math.max(world.y, carBox.min.y + radius * 0.85);
    const side = world.x >= carCenter.x ? 1 : -1;
    world.x += side * radius * 0.06;
    const local = worldToLocal(carRoot, world);
    const { steer, spinner } = makeWheelRig(CORNER_NAMES[i]!, local, isFront, radius, !lengthAlongZ);
    const inst = template.clone(true);
    inst.scale.setScalar(radius / templateR);
    inst.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) markWheelMesh(mesh);
    });
    spinner.add(inst);
    carRoot.add(steer);
    mounts.push({ steer, spinner, radius, isFront });
  }
  return mounts;
}

function makeWheelRig(
  corner: (typeof CORNER_NAMES)[number],
  local: Vector3,
  isFront: boolean,
  radius: number,
  alignYaw90: boolean,
): { steer: Group; spinner: Group } {
  const steer = new Group();
  steer.name = `WheelSteer_${corner}`;
  steer.position.copy(local);
  const align = new Group();
  align.name = `WheelAlign_${corner}`;
  if (alignYaw90) align.rotation.y = Math.PI / 2;
  const spinner = new Group();
  spinner.name = `WheelSpin_${corner}`;
  spinner.userData.wheelRadius = radius;
  spinner.userData.isFront = isFront;
  spinner.userData.isWheel = true;
  spinner.userData.spinWheel = true;
  steer.userData.isWheel = true;
  steer.add(align);
  align.add(spinner);
  return { steer, spinner };
}

/** Roll from world travel so spin works even if RaceRenderer omits spinCarWheels. */
function attachAutoRoll(spinner: Group, radius: number): void {
  if (spinner.userData.autoRoll) return;
  spinner.userData.autoRoll = true;
  const last = new Vector3(Number.NaN, Number.NaN, Number.NaN);
  const tmp = new Vector3();
  let lastT = 0;
  const r = Math.max(radius, 0.08);
  const roll = (): void => {
    const now = performance.now();
    spinner.getWorldPosition(tmp);
    if (spinner.userData.manualSpin) {
      last.copy(tmp);
      lastT = now;
      return;
    }
    if (!Number.isFinite(last.x)) {
      last.copy(tmp);
      lastT = now;
      return;
    }
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (dt < 1e-4) return;
    const dist = last.distanceTo(tmp);
    last.copy(tmp);
    if (dist > 8) return;
    spinner.rotation.x += dist / r;
  };
  let hooked = false;
  spinner.traverse((obj) => {
    const mesh = obj as Mesh;
    if (hooked || !mesh.isMesh) return;
    hooked = true;
    mesh.userData.wheelRollHook = true;
    mesh.onBeforeRender = roll;
  });
}

function registerDevWheels(mounts: WheelMount[]): void {
  if (!import.meta.env.DEV) return;
  const g = globalThis as unknown as { __spinWheels?: WheelMount[] };
  const prev = (g.__spinWheels ?? []).filter((w) => w.spinner.parent);
  g.__spinWheels = [...prev, ...mounts];
}

function labelCorners(
  hubs: Vector3[],
  carSize: Vector3,
): Array<{ name: (typeof CORNER_NAMES)[number]; pos: Vector3 }> {
  const alongZ = carSize.z >= carSize.x;
  const sorted = [...hubs];
  const frontness = (p: Vector3) => (alongZ ? p.z : p.x);
  const leftness = (p: Vector3) => (alongZ ? -p.x : p.z);
  sorted.sort((a, b) => frontness(b) - frontness(a) || leftness(b) - leftness(a));
  const front = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const rear = sorted.slice(2).sort((a, b) => a.x - b.x);
  return [
    { name: "FL", pos: front[0]! },
    { name: "FR", pos: front[1]! },
    { name: "RL", pos: rear[0]! },
    { name: "RR", pos: rear[1]! },
  ];
}

function worldToLocal(root: Object3D, world: Vector3): Vector3 {
  return root.worldToLocal(world.clone());
}

function markWheelMesh(mesh: Mesh): void {
  mesh.userData.comicWheel = true;
  if (!/tire|wheel|rubber/i.test(mesh.name)) mesh.name = "Tire";
  nameTireMaterial(mesh);
}

function xzDist2(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

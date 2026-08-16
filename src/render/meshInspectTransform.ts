import { Euler, Plane, Quaternion, Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";
import {
  MESH_INSPECT_ROTATE_PX,
  MESH_INSPECT_SCALE_MAX,
  MESH_INSPECT_SCALE_MIN,
  MESH_INSPECT_SCALE_PX,
  type MeshInspectDragMode,
  type MeshInspectSelection,
} from "../core/meshInspect";

const HOME_KEY = "meshInspectHome";

const _plane = new Plane();
const _ray = new Raycaster();
const _from = new Vector3();
const _to = new Vector3();
const _world = new Vector3();
const _camDir = new Vector3();
const _startMesh = new Vector3();
const _endMesh = new Vector3();
const _axis = new Vector3();
const _origin = new Vector3();
const _qWorld = new Quaternion();
const _qSpace = new Quaternion();
const _euler = new Euler();

export function findObjectByUuid(root: Object3D, uuid: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((obj) => {
    if (found || obj.uuid !== uuid) return;
    found = obj;
  });
  return found;
}

export function isObjectUnder(root: Object3D, uuid: string): boolean {
  if (root.uuid === uuid) return true;
  let found = false;
  root.traverse((obj) => {
    if (found || obj.uuid !== uuid) return;
    found = true;
  });
  return found;
}

export function meshSpaceOrigin(obj: Object3D, space: Object3D, target = new Vector3()): Vector3 {
  space.updateMatrixWorld(true);
  obj.updateMatrixWorld(true);
  obj.getWorldPosition(_world);
  return space.worldToLocal(target.copy(_world));
}

export function selectionPose(obj: Object3D, space: Object3D, name: string): MeshInspectSelection {
  const origin = meshSpaceOrigin(obj, space);
  space.updateMatrixWorld(true);
  obj.updateMatrixWorld(true);
  obj.getWorldQuaternion(_qWorld);
  space.getWorldQuaternion(_qSpace);
  _euler.setFromQuaternion(_qSpace.invert().multiply(_qWorld), "YXZ");
  return {
    name,
    id: obj.uuid,
    x: origin.x,
    y: origin.y,
    z: origin.z,
    kind: "object",
    yaw: (_euler.y * 180) / Math.PI,
    pitch: (_euler.x * 180) / Math.PI,
    roll: (_euler.z * 180) / Math.PI,
    sx: obj.scale.x,
    sy: obj.scale.y,
    sz: obj.scale.z,
  };
}

type HomePose = { position: Vector3; quaternion: Quaternion; scale: Vector3 };

export function rememberMeshInspectHome(obj: Object3D): void {
  if (obj.userData[HOME_KEY]) return;
  obj.userData[HOME_KEY] = {
    position: obj.position.clone(),
    quaternion: obj.quaternion.clone(),
    scale: obj.scale.clone(),
  } satisfies HomePose;
}

export function restoreMeshInspectHome(obj: Object3D): boolean {
  const home = obj.userData[HOME_KEY] as HomePose | undefined;
  if (!home) return false;
  obj.position.copy(home.position);
  obj.quaternion.copy(home.quaternion);
  if (home.scale) obj.scale.copy(home.scale);
  return true;
}

export function meshInspectStoredHome(obj: Object3D): {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
} | null {
  return (obj.userData[HOME_KEY] as HomePose | undefined) ?? null;
}

export function poseSnapFromLocal(
  obj: Object3D,
  space: Object3D,
  localPos: Vector3,
  localQuat: Quaternion,
  localScale: Vector3,
): MeshInspectSelection {
  const parent = obj.parent;
  space.updateMatrixWorld(true);
  if (parent) {
    parent.updateMatrixWorld(true);
    parent.localToWorld(_world.copy(localPos));
    parent.getWorldQuaternion(_qWorld);
    _qWorld.multiply(localQuat);
  } else {
    _world.copy(localPos);
    _qWorld.copy(localQuat);
  }
  space.worldToLocal(_startMesh.copy(_world));
  space.getWorldQuaternion(_qSpace);
  _euler.setFromQuaternion(_qSpace.invert().multiply(_qWorld), "YXZ");
  return {
    name: obj.name,
    id: obj.uuid,
    x: _startMesh.x,
    y: _startMesh.y,
    z: _startMesh.z,
    kind: "object",
    yaw: (_euler.y * 180) / Math.PI,
    pitch: (_euler.x * 180) / Math.PI,
    roll: (_euler.z * 180) / Math.PI,
    sx: localScale.x,
    sy: localScale.y,
    sz: localScale.z,
  };
}

export function applyWorldDeltaToObject(obj: Object3D, worldDelta: Vector3): void {
  rememberMeshInspectHome(obj);
  obj.updateMatrixWorld(true);
  obj.getWorldPosition(_world);
  _world.add(worldDelta);
  const parent = obj.parent;
  if (parent) {
    parent.updateMatrixWorld(true);
    parent.worldToLocal(_world);
  }
  obj.position.copy(_world);
}

export function applyMeshSpaceDelta(obj: Object3D, space: Object3D, dx: number, dy: number, dz: number): void {
  rememberMeshInspectHome(obj);
  const origin = meshSpaceOrigin(obj, space, _startMesh);
  origin.x += dx;
  origin.y += dy;
  origin.z += dz;
  space.updateMatrixWorld(true);
  space.localToWorld(_world.copy(origin));
  const parent = obj.parent;
  if (parent) {
    parent.updateMatrixWorld(true);
    parent.worldToLocal(_world);
  }
  obj.position.copy(_world);
}

export function cameraPlaneWorldDelta(
  camera: Camera,
  fromNdc: Vector2,
  toNdc: Vector2,
  planePointWorld: Vector3,
): Vector3 {
  camera.updateMatrixWorld(true);
  camera.getWorldDirection(_camDir);
  _plane.setFromNormalAndCoplanarPoint(_camDir, planePointWorld);
  _ray.setFromCamera(fromNdc, camera);
  if (!_ray.ray.intersectPlane(_plane, _from)) return new Vector3();
  _ray.setFromCamera(toNdc, camera);
  if (!_ray.ray.intersectPlane(_plane, _to)) return new Vector3();
  return _to.clone().sub(_from);
}

export function constrainWorldDeltaInMeshSpace(
  space: Object3D,
  worldOrigin: Vector3,
  worldDelta: Vector3,
  mode: MeshInspectDragMode,
): Vector3 {
  if (mode === "free") return worldDelta;
  space.updateMatrixWorld(true);
  space.worldToLocal(_startMesh.copy(worldOrigin));
  space.worldToLocal(_endMesh.copy(worldOrigin).add(worldDelta));
  if (mode === "keepY") _endMesh.y = _startMesh.y;
  else {
    _endMesh.x = _startMesh.x;
    _endMesh.z = _startMesh.z;
  }
  const endWorld = space.localToWorld(_endMesh);
  return endWorld.sub(worldOrigin);
}

export function applyMeshSpaceRotation(obj: Object3D, space: Object3D, yaw: number, pitch = 0): void {
  rememberMeshInspectHome(obj);
  space.updateMatrixWorld(true);
  space.localToWorld(_origin.set(0, 0, 0));
  if (yaw) {
    space.localToWorld(_axis.set(0, 1, 0)).sub(_origin).normalize();
    obj.rotateOnWorldAxis(_axis, yaw);
  }
  if (pitch) {
    space.localToWorld(_axis.set(1, 0, 0)).sub(_origin).normalize();
    obj.rotateOnWorldAxis(_axis, pitch);
  }
}

export function applyViewDragRotation(
  obj: Object3D,
  space: Object3D,
  dxPx: number,
  dyPx: number,
  mode: MeshInspectDragMode,
): void {
  let yaw = -dxPx * MESH_INSPECT_ROTATE_PX;
  let pitch = -dyPx * MESH_INSPECT_ROTATE_PX;
  if (mode === "keepY") pitch = 0;
  if (mode === "onlyY") yaw = 0;
  applyMeshSpaceRotation(obj, space, yaw, pitch);
}

function clampScaleComponent(n: number): number {
  if (!Number.isFinite(n) || n === 0) return MESH_INSPECT_SCALE_MIN;
  const sign = n < 0 ? -1 : 1;
  return sign * Math.min(MESH_INSPECT_SCALE_MAX, Math.max(MESH_INSPECT_SCALE_MIN, Math.abs(n)));
}

export function clampObjectScale(obj: Object3D): void {
  obj.scale.set(
    clampScaleComponent(obj.scale.x),
    clampScaleComponent(obj.scale.y),
    clampScaleComponent(obj.scale.z),
  );
}

/** Multiply all axes — keeps the current ratio. */
export function applyUniformScale(obj: Object3D, factor: number): void {
  rememberMeshInspectHome(obj);
  if (!Number.isFinite(factor) || factor === 0) return;
  obj.scale.multiplyScalar(factor);
  clampObjectScale(obj);
}

export function applyViewDragScale(
  obj: Object3D,
  dxPx: number,
  dyPx: number,
  mode: MeshInspectDragMode,
  uniform: boolean,
): void {
  rememberMeshInspectHome(obj);
  if (uniform) {
    applyUniformScale(obj, Math.exp((dxPx - dyPx) * MESH_INSPECT_SCALE_PX));
    return;
  }
  const fx = Math.exp(dxPx * MESH_INSPECT_SCALE_PX);
  const fy = Math.exp(-dyPx * MESH_INSPECT_SCALE_PX);
  if (mode === "keepY") {
    obj.scale.x *= fx;
    obj.scale.z *= fx;
  } else if (mode === "onlyY") {
    obj.scale.y *= fy;
  } else {
    obj.scale.x *= fx;
    obj.scale.y *= fy;
    obj.scale.z *= fx;
  }
  clampObjectScale(obj);
}

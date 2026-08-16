import { Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";
import type { MeshInspectDragMode, MeshInspectSelection } from "../core/meshInspect";

const HOME_KEY = "meshInspectHome";

const _plane = new Plane();
const _ray = new Raycaster();
const _from = new Vector3();
const _to = new Vector3();
const _world = new Vector3();
const _camDir = new Vector3();
const _startMesh = new Vector3();
const _endMesh = new Vector3();

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
  return { name, id: obj.uuid, x: origin.x, y: origin.y, z: origin.z };
}

export function rememberMeshInspectHome(obj: Object3D): void {
  if (obj.userData[HOME_KEY]) return;
  obj.userData[HOME_KEY] = obj.position.clone();
}

export function restoreMeshInspectHome(obj: Object3D): boolean {
  const home = obj.userData[HOME_KEY] as Vector3 | undefined;
  if (!home) return false;
  obj.position.copy(home);
  return true;
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

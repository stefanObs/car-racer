import { Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";
import type { MeshInspectHit } from "../core/meshInspect";
import { isUnderCarFx } from "./garageSit";

export const MESH_INSPECT_BG = 0x1e88e5;

const _ndc = new Vector2();
const _local = new Vector3();
const _raycaster = new Raycaster();

const SKIP_NAMES = new Set(["", "Scene", "Node", "carGroundBlob", "RootNode"]);

/** Authored GLB scene (mesh-space meters). Skips the `gltf-{id}` wrap and garage scale. */
export function carMeshSpaceRoot(carRoot: Object3D): Object3D {
  const wrap = carRoot.children.find((c) => c.name.startsWith("gltf-"));
  if (wrap?.children[0]) return wrap.children[0];
  for (const child of carRoot.children) {
    if (child.name === "carGroundBlob") continue;
    if (child.userData.tripoFx) continue;
    return child;
  }
  return carRoot;
}

export function meshInspectPartName(obj: Object3D, carRoot: Object3D): string {
  let p: Object3D | null = obj;
  while (p) {
    const name = p.name?.trim() ?? "";
    if (name && !SKIP_NAMES.has(name) && !name.startsWith("WheelSpin_") && !name.startsWith("WheelSteer_")) {
      return name;
    }
    if (p === carRoot) break;
    p = p.parent;
  }
  return carRoot.name?.trim() || "car";
}

export function pointerToNdc(
  clientX: number,
  clientY: number,
  canvas: { getBoundingClientRect: () => DOMRect },
): Vector2 {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(r.width, 1);
  const h = Math.max(r.height, 1);
  _ndc.set(((clientX - r.left) / w) * 2 - 1, -((clientY - r.top) / h) * 2 + 1);
  return _ndc;
}

/**
 * All named parts along the pick ray, nearest first.
 * Coordinates are car mesh space (cheat-sheet meters).
 */
export function pickMeshInspectHits(
  carRoot: Object3D,
  camera: Camera,
  clientX: number,
  clientY: number,
  canvas: { getBoundingClientRect: () => DOMRect },
): MeshInspectHit[] {
  carRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  _raycaster.setFromCamera(pointerToNdc(clientX, clientY, canvas), camera);
  const hits = _raycaster.intersectObject(carRoot, true);
  const space = carMeshSpaceRoot(carRoot);
  const seen = new Set<string>();
  const out: MeshInspectHit[] = [];
  for (const hit of hits) {
    const obj = hit.object;
    if (!obj.visible) continue;
    if (isUnderCarFx(obj)) continue;
    if (obj.name === "carGroundBlob") continue;
    const name = meshInspectPartName(obj, carRoot);
    if (seen.has(name)) continue;
    seen.add(name);
    space.worldToLocal(_local.copy(hit.point));
    out.push({ name, x: _local.x, y: _local.y, z: _local.z });
  }
  return out;
}

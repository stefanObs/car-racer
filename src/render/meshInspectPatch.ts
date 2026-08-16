import { BufferAttribute, Mesh, type Object3D } from "three";
import type { CarId } from "../data/cars";
import { CAR_MODELS } from "../data/carModels";
import {
  carPartIdFromObjectName,
  formatMeshInspectPatch,
  MESH_INSPECT_PATCH_VERT_CAP,
  meshInspectPoseChanged,
  type MeshInspectPatch,
  type MeshInspectPatchNode,
  type MeshInspectPatchVert,
  type MeshInspectPoseSnap,
} from "../core/meshInspect";
import { partGlbUrl, type BlitzPartMeshId } from "./carParts";
import {
  carMeshSpaceRoot,
  isMeshInspectSkipped,
  meshInspectHitName,
  meshInspectNodePath,
} from "./meshInspectPick";
import { meshInspectStoredHome, poseSnapFromLocal, selectionPose } from "./meshInspectTransform";

function snapOf(sel: {
  x: number;
  y: number;
  z: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}): MeshInspectPoseSnap {
  return {
    x: sel.x,
    y: sel.y,
    z: sel.z,
    yaw: sel.yaw ?? 0,
    pitch: sel.pitch ?? 0,
    roll: sel.roll ?? 0,
    sx: sel.sx ?? 1,
    sy: sel.sy ?? 1,
    sz: sel.sz ?? 1,
  };
}

function sameNameIndex(obj: Object3D): number | undefined {
  const parent = obj.parent;
  if (!parent) return undefined;
  const same = parent.children.filter((child) => child.name === obj.name);
  if (same.length < 2) return undefined;
  return same.indexOf(obj);
}

function patchTarget(
  carId: CarId,
  obj: Object3D,
  carRoot: Object3D,
): Pick<MeshInspectPatchNode, "file" | "apply" | "partId"> {
  const path = meshInspectNodePath(obj, carRoot);
  const rootName = path.split(" / ")[0] ?? obj.name;
  const partId = carPartIdFromObjectName(rootName) ?? carPartIdFromObjectName(obj.name);
  const carFile = `public${CAR_MODELS[carId].url}`;
  if (!partId) return { file: carFile, apply: "glb-node" };
  const partFile = `public${partGlbUrl(carId, partId as BlitzPartMeshId)}`;
  if (obj.name.startsWith("carPart-")) return { file: "src/render/carParts.ts", apply: "mount", partId };
  return { file: partFile, apply: "glb-node", partId };
}

function changedVerts(mesh: Mesh): { listed: MeshInspectPatchVert[]; total: number } | null {
  const home = mesh.userData.meshInspectGeoHome as Float32Array | undefined;
  const pos = mesh.geometry.getAttribute("position");
  if (!home || !(pos instanceof BufferAttribute)) return null;
  const arr = pos.array as Float32Array;
  const listed: MeshInspectPatchVert[] = [];
  let total = 0;
  const n = Math.min(home.length, arr.length);
  for (let i = 0; i + 2 < n; i += 3) {
    if (
      Math.abs(home[i]! - arr[i]!) <= 1e-5 &&
      Math.abs(home[i + 1]! - arr[i + 1]!) <= 1e-5 &&
      Math.abs(home[i + 2]! - arr[i + 2]!) <= 1e-5
    ) {
      continue;
    }
    total += 1;
    if (listed.length < MESH_INSPECT_PATCH_VERT_CAP) {
      listed.push({ i: i / 3, x: arr[i]!, y: arr[i + 1]!, z: arr[i + 2]! });
    }
  }
  if (total === 0) return null;
  return { listed, total };
}

export function collectMeshInspectPatch(carRoot: Object3D, carId: CarId): MeshInspectPatch {
  const space = carMeshSpaceRoot(carRoot);
  const nodes: MeshInspectPatchNode[] = [];
  carRoot.traverse((obj) => {
    if (isMeshInspectSkipped(obj)) return;
    const home = meshInspectStoredHome(obj);
    const mesh = obj instanceof Mesh ? obj : null;
    const geo = mesh ? changedVerts(mesh) : null;
    if (!home && !geo) return;
    const to = snapOf(selectionPose(obj, space, meshInspectHitName(obj, carRoot)));
    const from = home
      ? snapOf(poseSnapFromLocal(obj, space, home.position, home.quaternion, home.scale))
      : to;
    if (!meshInspectPoseChanged(from, to) && !geo) return;
    const target = patchTarget(carId, obj, carRoot);
    const node: MeshInspectPatchNode = {
      name: meshInspectHitName(obj, carRoot),
      path: meshInspectNodePath(obj, carRoot),
      ...target,
      from,
      to,
    };
    const idx = sameNameIndex(obj);
    if (typeof idx === "number") node.sameNameIndex = idx;
    if (geo) {
      node.verts = geo.listed;
      if (geo.total > geo.listed.length) node.vertsTruncated = geo.total;
    }
    nodes.push(node);
  });
  return { car: carId, nodes };
}

export function meshInspectPatchText(carRoot: Object3D, carId: CarId): string | null {
  const patch = collectMeshInspectPatch(carRoot, carId);
  if (patch.nodes.length === 0) return null;
  return formatMeshInspectPatch(patch);
}

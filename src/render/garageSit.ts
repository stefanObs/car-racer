import { Box3, Object3D, Vector3, type Mesh } from "three";
import { wheelContactMinY } from "./stockWheels";

/** True if this node or an ancestor is FX (should not affect sit / orbit pivot). */
export function isUnderCarFx(obj: Object3D): boolean {
  let p: Object3D | null = obj;
  while (p) {
    if (p.name.startsWith("fx-") || p.userData.tripoFx) return true;
    p = p.parent;
  }
  return false;
}

function isFaintShadowBlob(mesh: Mesh): boolean {
  if (!mesh.material || !("opacity" in mesh.material)) return false;
  const m = mesh.material as { transparent?: boolean; opacity?: number };
  return !!m.transparent && (m.opacity ?? 1) < 0.5;
}

/** World AABB of visible non-FX meshes (orbit pivot center / sit geometry). */
export function carBodyWorldBox(root: Object3D): Box3 {
  root.updateMatrixWorld(true);
  const box = new Box3();
  let found = false;
  root.traverse((obj) => {
    if (!obj.visible || isUnderCarFx(obj)) return;
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (isFaintShadowBlob(mesh)) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    const world = bb.clone().applyMatrix4(mesh.matrixWorld);
    if (!found) {
      box.copy(world);
      found = true;
    } else {
      box.union(world);
    }
  });
  if (!found) box.setFromObject(root);
  return box;
}

/** Clearance above pad deck when planting the showcase car. */
export const GARAGE_PAD_SIT_CLEARANCE = 0;

/**
 * World Y used to plant the showcase car on the pad.
 * StockWheel meshes when present; otherwise the lowest body AABB (excludes FX + shadow blob).
 *
 * Do not use sparse underside raycasts here: on single-mesh cars (Blitz) they often miss
 * tire treads, hit a higher underbody, and leave treads buried under the opaque pad deck —
 * cel outlines then read as a floating car.
 */
export function garageShowcaseContactMinY(root: Object3D): number {
  const wheels = wheelContactMinY(root);
  if (wheels != null) return wheels;
  const minY = carBodyWorldBox(root).min.y;
  return Number.isFinite(minY) ? minY : 0;
}

/** Delta to add to `pivot.position.y` / root so tire contact meets the pad deck. */
export function garagePadContactSnapDelta(
  carRoot: Object3D,
  deckY: number,
  clearance = GARAGE_PAD_SIT_CLEARANCE,
): number {
  carRoot.updateMatrixWorld(true);
  const contact = garageShowcaseContactMinY(carRoot);
  if (!Number.isFinite(contact)) return 0;
  return deckY + clearance - contact;
}

export function carBodyWorldCenter(root: Object3D, out = new Vector3()): Vector3 {
  return carBodyWorldBox(root).getCenter(out);
}

const _blobWorld = new Vector3();

/**
 * Pin the soft contact shadow to the pad deck. Default local Y sits near the car
 * origin and reads as a detached hover blob once tires are planted correctly.
 */
export function seatGarageGroundBlob(carRoot: Object3D, deckY: number, epsilon = 0.008): void {
  const blob = carRoot.getObjectByName("carGroundBlob");
  if (!blob) return;
  carRoot.updateMatrixWorld(true);
  blob.getWorldPosition(_blobWorld);
  const scaleY = Math.max(1e-6, carRoot.scale.y);
  blob.position.y += (deckY + epsilon - _blobWorld.y) / scaleY;
}

import { Group, Object3D, Vector3 } from "three";

/**
 * Parent `car` under an orbit pivot at `center` without changing its world pose.
 * Must use `attach` — setting `position` from `worldToLocal` breaks scaled cars
 * (tires float above the garage pad).
 */
export function mountGarageOrbitPivot(parent: Object3D, car: Object3D, center: Vector3): Group {
  const pivot = new Group();
  pivot.name = "garageOrbitPivot";
  pivot.rotation.order = "YXZ";
  pivot.position.copy(center);
  parent.add(pivot);
  pivot.attach(car);
  return pivot;
}

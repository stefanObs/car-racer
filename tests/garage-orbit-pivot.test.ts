import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { mountGarageOrbitPivot } from "../src/render/garageOrbitPivot";

describe("mountGarageOrbitPivot", () => {
  it("keeps scaled car world height when parenting to the orbit pivot", () => {
    const bay = new Group();
    const car = new Mesh(new BoxGeometry(2, 1, 4), new MeshBasicMaterial());
    car.scale.setScalar(1.35);
    car.position.set(1.5, 0.7, 0);
    bay.add(car);
    car.updateMatrixWorld(true);

    const before = new Box3().setFromObject(car);
    const center = before.getCenter(new Vector3());
    const pivot = mountGarageOrbitPivot(bay, car, center);
    pivot.updateMatrixWorld(true);

    const after = new Box3().setFromObject(car);
    expect(after.min.y).toBeCloseTo(before.min.y, 5);
    expect(after.max.y).toBeCloseTo(before.max.y, 5);
    expect(pivot.position.y).toBeCloseTo(center.y, 5);
    expect(car.parent).toBe(pivot);
  });
});

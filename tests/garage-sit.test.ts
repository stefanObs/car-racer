import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import {
  carBodyWorldBox,
  garagePadContactSnapDelta,
  garageShowcaseContactMinY,
  GARAGE_PAD_SIT_CLEARANCE,
  isUnderCarFx,
  seatGarageGroundBlob,
} from "../src/render/garageSit";

describe("garage sit helpers", () => {
  it("ignores fx-* ancestors when classifying body meshes", () => {
    const fx = new Group();
    fx.name = "fx-sparks";
    const spark = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial());
    fx.add(spark);
    expect(isUnderCarFx(spark)).toBe(true);
    expect(isUnderCarFx(new Mesh(new BoxGeometry(), new MeshBasicMaterial()))).toBe(false);
  });

  it("excludes fx meshes from the body world box", () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(2, 1, 4), new MeshBasicMaterial());
    body.position.y = 0.5;
    root.add(body);
    const fx = new Group();
    fx.name = "fx-sparks";
    const spark = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    spark.position.y = -2;
    fx.add(spark);
    root.add(fx);
    root.updateMatrixWorld(true);

    const box = carBodyWorldBox(root);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(1, 5);
  });

  it("excludes faint shadow blobs from sit contact", () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(2, 1, 4), new MeshBasicMaterial());
    body.position.y = 0.5;
    root.add(body);
    const blob = new Mesh(
      new BoxGeometry(2, 0.02, 2),
      new MeshBasicMaterial({ transparent: true, opacity: 0.32 }),
    );
    blob.position.y = -1;
    root.add(blob);
    root.updateMatrixWorld(true);

    expect(garageShowcaseContactMinY(root)).toBeCloseTo(0, 5);
  });

  it("plants on the lowest body AABB (not a higher underbody-only sample)", () => {
    expect(GARAGE_PAD_SIT_CLEARANCE).toBe(0);
    const root = new Group();
    // Chassis floor (higher) + outboard tire blocks (lower) — like Blitz Root mesh.
    const floor = new Mesh(new BoxGeometry(1.2, 0.2, 3), new MeshBasicMaterial());
    floor.position.y = 0.55;
    root.add(floor);
    for (const [x, z] of [
      [-0.9, 1.2],
      [0.9, 1.2],
      [-0.9, -1.2],
      [0.9, -1.2],
    ] as const) {
      const tire = new Mesh(new BoxGeometry(0.35, 0.4, 0.35), new MeshBasicMaterial());
      tire.position.set(x, 0.2, z);
      root.add(tire);
    }
    root.updateMatrixWorld(true);

    expect(garageShowcaseContactMinY(root)).toBeCloseTo(0, 4);
    expect(garagePadContactSnapDelta(root, 0.34)).toBeCloseTo(0.34, 4);
  });

  it("pins carGroundBlob to the pad deck", () => {
    const root = new Group();
    root.scale.setScalar(1.35);
    root.position.y = 0.5;
    const blob = new Mesh(
      new BoxGeometry(1, 0.01, 1),
      new MeshBasicMaterial({ transparent: true, opacity: 0.32 }),
    );
    blob.name = "carGroundBlob";
    blob.position.y = 0.03;
    root.add(blob);
    root.updateMatrixWorld(true);

    seatGarageGroundBlob(root, 0.34, 0.008);
    root.updateMatrixWorld(true);
    const world = new Vector3();
    blob.getWorldPosition(world);
    expect(world.y).toBeCloseTo(0.348, 3);
  });
});

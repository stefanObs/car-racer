import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector2, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  applyMeshSpaceDelta,
  applyMeshSpaceRotation,
  applyWorldDeltaToObject,
  cameraPlaneWorldDelta,
  constrainWorldDeltaInMeshSpace,
  isObjectUnder,
  meshSpaceOrigin,
  rememberMeshInspectHome,
  restoreMeshInspectHome,
} from "../src/render/meshInspectTransform";

describe("mesh inspect transform", () => {
  it("moves a child in mesh space and restores the home pose", () => {
    const space = new Group();
    space.name = "BakeRoot";
    const part = new Group();
    part.name = "carPart-reinforced_frame";
    const pole = new Mesh(new BoxGeometry(0.1, 0.1, 1), new MeshBasicMaterial());
    pole.name = "Waist";
    pole.position.set(-0.5, 1, 0.4);
    part.add(pole);
    space.add(part);
    space.updateMatrixWorld(true);

    rememberMeshInspectHome(pole);
    applyMeshSpaceDelta(pole, space, 0.1, -0.2, 0.05);
    const moved = meshSpaceOrigin(pole, space);
    expect(moved.x).toBeCloseTo(-0.4, 5);
    expect(moved.y).toBeCloseTo(0.8, 5);
    expect(moved.z).toBeCloseTo(0.45, 5);
    expect(restoreMeshInspectHome(pole)).toBe(true);
    const home = meshSpaceOrigin(pole, space);
    expect(home.x).toBeCloseTo(-0.5, 5);
    expect(home.y).toBeCloseTo(1, 5);
    expect(home.z).toBeCloseTo(0.4, 5);
  });

  it("treats a child uuid as under its parent group", () => {
    const part = new Group();
    const a = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const b = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    part.add(a);
    expect(isObjectUnder(part, a.uuid)).toBe(true);
    expect(isObjectUnder(part, b.uuid)).toBe(false);
    expect(isObjectUnder(a, a.uuid)).toBe(true);
  });

  it("keeps mesh Y when constraining a world delta to the floor plane", () => {
    const space = new Group();
    space.updateMatrixWorld(true);
    const origin = new Vector3(1, 2, 3);
    const delta = constrainWorldDeltaInMeshSpace(space, origin, new Vector3(0.4, 0.9, -0.2), "keepY");
    expect(delta.x).toBeCloseTo(0.4, 5);
    expect(delta.y).toBeCloseTo(0, 5);
    expect(delta.z).toBeCloseTo(-0.2, 5);
    const lift = constrainWorldDeltaInMeshSpace(space, origin, new Vector3(0.4, 0.9, -0.2), "onlyY");
    expect(lift.x).toBeCloseTo(0, 5);
    expect(lift.y).toBeCloseTo(0.9, 5);
    expect(lift.z).toBeCloseTo(0, 5);
  });

  it("applies a camera-plane drag as a world delta on the object", () => {
    const cam = new PerspectiveCamera(50, 1, 0.1, 50);
    cam.position.set(0, 0, 8);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    const obj = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    obj.position.set(0, 0, 0);
    obj.updateMatrixWorld(true);
    const worldDelta = cameraPlaneWorldDelta(cam, new Vector2(0, 0), new Vector2(0.2, 0), obj.position.clone());
    expect(worldDelta.length()).toBeGreaterThan(0);
    applyWorldDeltaToObject(obj, worldDelta);
    expect(obj.position.length()).toBeGreaterThan(0);
  });

  it("yaws the whole mesh around mesh-space Y and restores rotation", () => {
    const space = new Group();
    const pole = new Mesh(new BoxGeometry(0.1, 0.1, 1), new MeshBasicMaterial());
    pole.rotation.order = "YXZ";
    space.add(pole);
    space.updateMatrixWorld(true);
    rememberMeshInspectHome(pole);
    applyMeshSpaceRotation(pole, space, Math.PI / 2, 0);
    expect(Math.abs(pole.quaternion.y)).toBeGreaterThan(0.5);
    expect(restoreMeshInspectHome(pole)).toBe(true);
    expect(pole.quaternion.y).toBeCloseTo(0, 5);
  });
});

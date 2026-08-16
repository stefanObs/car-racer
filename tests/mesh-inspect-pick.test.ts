import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { carMeshSpaceRoot, meshInspectPartName, pickMeshInspectHits } from "../src/render/meshInspectPick";

function fakeCanvas(w = 200, h = 200) {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }),
  };
}

function carWithParts(): { root: Group; camera: PerspectiveCamera } {
  const bake = new Group();
  bake.name = "BakeRoot";
  const body = new Mesh(new BoxGeometry(2, 1, 4), new MeshBasicMaterial());
  body.name = "BodyPaint";
  const wheelMesh = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), new MeshBasicMaterial());
  const steer = new Group();
  steer.name = "WheelSteer_FL";
  const spin = new Group();
  spin.name = "WheelSpin_FL";
  const wheel = new Group();
  wheel.name = "StockWheel_FL";
  wheel.position.set(-0.7, 0.3, 1);
  wheel.add(wheelMesh);
  spin.add(wheel);
  steer.add(spin);
  bake.add(body, steer);
  const wrap = new Group();
  wrap.name = "gltf-blitz";
  wrap.add(bake);
  const root = new Group();
  root.add(wrap);
  root.updateMatrixWorld(true);

  const camera = new PerspectiveCamera(50, 1, 0.1, 50);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return { root, camera };
}

describe("mesh inspect picking", () => {
  it("uses the authored GLB child as mesh space", () => {
    const { root } = carWithParts();
    expect(carMeshSpaceRoot(root).name).toBe("BakeRoot");
  });

  it("skips WheelSteer/WheelSpin wrappers for the part name", () => {
    const { root } = carWithParts();
    const wheelMesh = root.getObjectByName("StockWheel_FL")!.children[0]!;
    expect(meshInspectPartName(wheelMesh, root)).toBe("StockWheel_FL");
  });

  it("returns every named part along the ray, nearest first", () => {
    const { root, camera } = carWithParts();
    const hits = pickMeshInspectHits(root, camera, 100, 100, fakeCanvas());
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((h) => h.name === "BodyPaint")).toBe(true);
    const names = hits.map((h) => h.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

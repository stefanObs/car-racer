import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import {
  carMeshSpaceRoot,
  isInkRgb,
  isReddishRgb,
  meshInspectMarkerHex,
  meshInspectPartName,
  pickFillRgbFromPatch,
  MESH_INSPECT_MARKER_BLUE,
  MESH_INSPECT_MARKER_RED,
  pickMeshInspectHits,
} from "../src/render/meshInspectPick";

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
    const hits = pickMeshInspectHits(root, camera, 100, 100, fakeCanvas()).hits;
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((h) => h.name === "BodyPaint")).toBe(true);
    const names = hits.map((h) => h.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("places a marker at the nearest hit and turns it blue on red paint", () => {
    const { root, camera } = carWithParts();
    const body = root.getObjectByName("BodyPaint") as Mesh;
    (body.material as MeshBasicMaterial).color.setHex(0xe03131);
    const picked = pickMeshInspectHits(root, camera, 100, 100, fakeCanvas());
    expect(picked.marker).toBeTruthy();
    expect(picked.marker!.onRed).toBe(true);
    expect(meshInspectMarkerHex(224, 49, 49)).toBe(MESH_INSPECT_MARKER_BLUE);
    expect(meshInspectMarkerHex(30, 30, 30)).toBe(MESH_INSPECT_MARKER_RED);
    expect(isReddishRgb(224, 49, 49)).toBe(true);
    expect(isReddishRgb(40, 40, 40)).toBe(false);
  });

  it("skips comic ink and unused atlas texels when classifying the pick color", () => {
    const w = 32;
    const h = 32;
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 12;
      data[i + 1] = 12;
      data[i + 2] = 12;
      data[i + 3] = 255;
    }
    const paintAt = (x: number, y: number): void => {
      const i = (y * w + x) * 4;
      data[i] = 224;
      data[i + 1] = 49;
      data[i + 2] = 49;
    };
    for (let y = 10; y <= 14; y++) {
      for (let x = 10; x <= 14; x++) paintAt(x, y);
    }
    expect(isInkRgb(12, 12, 12)).toBe(true);
    const fromInk = pickFillRgbFromPatch(data, w, h, 8, 8);
    expect(isReddishRgb(fromInk.r, fromInk.g, fromInk.b)).toBe(true);
    const allInk = pickFillRgbFromPatch(new Uint8Array(8 * 8 * 4), 8, 8, 4, 4);
    expect(isReddishRgb(allInk.r, allInk.g, allInk.b)).toBe(false);
    expect(meshInspectMarkerHex(fromInk.r, fromInk.g, fromInk.b)).toBe(MESH_INSPECT_MARKER_BLUE);
  });
});

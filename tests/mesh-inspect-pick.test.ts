import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, SphereGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { GARAGE_PAINTS } from "../src/data/cosmetics";
import {
  carMeshSpaceRoot,
  isGreenishRgb,
  isInkRgb,
  isReddishRgb,
  meshInspectBackgroundHex,
  meshInspectHitName,
  meshInspectMarkerHex,
  meshInspectPartName,
  meshInspectSelectableParent,
  pickFillRgbFromPatch,
  listMeshInspectCatalog,
  MESH_INSPECT_BG,
  MESH_INSPECT_BG_ON_GREEN,
  MESH_INSPECT_MARKER_BLUE,
  MESH_INSPECT_MARKER_RADIUS,
  MESH_INSPECT_MARKER_RED,
  pickMeshInspectBoxHandle,
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
  const part = new Group();
  part.name = "carPart-reinforced_frame";
  const waistNear = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), new MeshBasicMaterial());
  waistNear.name = "Waist";
  waistNear.position.set(-0.7, 0, 2.2);
  const waistFar = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), new MeshBasicMaterial());
  waistFar.name = "Waist";
  waistFar.position.set(0.7, 0, 2.2);
  part.add(waistNear, waistFar);
  bake.add(body, steer, part);
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
  it("lists nested and hidden named parts that a pick ray cannot see", () => {
    const { root } = carWithParts();
    const engine = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), new MeshBasicMaterial());
    engine.name = "StockEngine";
    engine.visible = false;
    root.getObjectByName("BakeRoot")!.add(engine);
    const catalog = listMeshInspectCatalog(root);
    const names = catalog.map((e) => e.name);
    expect(names).toContain("BodyPaint");
    expect(names).toContain("StockEngine");
    expect(names).toContain("carPart-reinforced_frame");
    expect(names).toContain("Waist");
    expect(names).toContain("StockWheel_FL");
    expect(names).not.toContain("WheelSteer_FL");
    expect(names).not.toContain("WheelSpin_FL");
    const part = catalog.find((e) => e.name === "carPart-reinforced_frame");
    const waist = catalog.find((e) => e.name === "Waist");
    expect(part?.depth).toBe(0);
    expect(waist?.depth).toBe(1);
    expect(waist?.id).not.toBe(part?.id);
  });

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
  });

  it("keeps same-named submeshes as separate selectable hits", () => {
    const { root, camera } = carWithParts();
    const left = new Vector3(-0.7, 0, 2.2).project(camera);
    const right = new Vector3(0.7, 0, 2.2).project(camera);
    const toClient = (ndc: Vector3) => ({
      x: (ndc.x * 0.5 + 0.5) * 200,
      y: (-ndc.y * 0.5 + 0.5) * 200,
    });
    const leftHit = pickMeshInspectHits(root, camera, toClient(left).x, toClient(left).y, fakeCanvas()).hits[0];
    const rightHit = pickMeshInspectHits(root, camera, toClient(right).x, toClient(right).y, fakeCanvas()).hits[0];
    expect(leftHit?.name).toContain("Waist");
    expect(rightHit?.name).toContain("Waist");
    expect(leftHit?.id).not.toBe(rightHit?.id);
    expect(leftHit?.parentId).toBe(rightHit?.parentId);
    const near = root.getObjectByName("carPart-reinforced_frame")!.children[0]!;
    expect(meshInspectHitName(near, root)).toBe("carPart-reinforced_frame / Waist");
    expect(meshInspectSelectableParent(near, root)?.name).toBe("carPart-reinforced_frame");
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

  it("keeps the pick marker at a quarter of the original 0.07 m radius", () => {
    expect(MESH_INSPECT_MARKER_RADIUS).toBeCloseTo(0.0175, 6);
  });

  it("uses a green F5 void unless the car paint is green, then violet", () => {
    expect(meshInspectBackgroundHex("#e03131")).toBe(MESH_INSPECT_BG);
    expect(meshInspectBackgroundHex("#339af0")).toBe(MESH_INSPECT_BG);
    expect(meshInspectBackgroundHex("#12b886")).toBe(MESH_INSPECT_BG_ON_GREEN);
    expect(meshInspectBackgroundHex("#2f9e44")).toBe(MESH_INSPECT_BG_ON_GREEN);
    expect(isGreenishRgb(18, 184, 134)).toBe(true);
    expect(isGreenishRgb(224, 49, 49)).toBe(false);
    const greens = GARAGE_PAINTS.filter((p) => meshInspectBackgroundHex(p) === MESH_INSPECT_BG_ON_GREEN);
    expect(greens).toEqual(["#12b886", "#2f9e44"]);
  });

  it("picks a Kasten edge dot by screen proximity when the ray misses the sphere", () => {
    const handles = new Group();
    const mesh = new Mesh(new SphereGeometry(0.001, 4, 4), new MeshBasicMaterial());
    mesh.name = "meshInspectBoxHandle-x-minY-minZ";
    mesh.userData.boxEdge = "x-minY-minZ";
    handles.add(mesh);
    handles.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(50, 1, 0.1, 50);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const ndc = new Vector3(0, 0, 0).project(camera);
    const x = (ndc.x * 0.5 + 0.5) * 200;
    const y = (-ndc.y * 0.5 + 0.5) * 200;
    const near = pickMeshInspectBoxHandle(handles, camera, x + 12, y + 8, fakeCanvas());
    expect(near?.id).toBe("x-minY-minZ");
    const far = pickMeshInspectBoxHandle(handles, camera, x + 80, y + 80, fakeCanvas());
    expect(far).toBeNull();
  });
});

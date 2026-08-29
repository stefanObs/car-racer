import {
  BoxGeometry,
  BufferAttribute,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import { meshInspectBoxContains } from "../src/core/meshInspect";
import {
  DONNER_ENGINE_BAY_FILL,
  DONNER_ENGINE_BAY_FILL_NAME,
  DONNER_STOCK_ENGINE_BOX,
  DONNER_STOCK_ENGINE_BOXES,
  DONNER_STOCK_ENGINE_REMAINDER_BOXES,
  inDonnerStockEngine,
  inDonnerStockEngineHalo,
  isDonnerStockEngineObject,
} from "../src/render/donnerEngineBox";
import { buildDonnerEngineBayFill } from "../src/render/carPartBuilders";
import {
  hideFacesInMeshSpaceBox,
  meshHasHiddenFaces,
  restoreHiddenMeshFaces,
} from "../src/render/hideMeshSpaceBox";
import { carMeshSpaceRoot } from "../src/render/meshInspectPick";

function wrappedCar(parts: Mesh[]): Group {
  const bake = new Group();
  bake.name = "BakeRoot";
  for (const mesh of parts) bake.add(mesh);
  const wrap = new Group();
  wrap.name = "gltf-donnerbuechse";
  wrap.add(bake);
  const root = new Group();
  root.add(wrap);
  root.updateMatrixWorld(true);
  return root;
}

function triangleCount(mesh: Mesh): number {
  const idx = mesh.geometry.getIndex();
  if (idx) return Math.floor(idx.count / 3);
  const pos = mesh.geometry.getAttribute("position");
  return Math.floor((pos?.count ?? 0) / 3);
}

function interleavePosition(geo: BoxGeometry): void {
  const pos = geo.getAttribute("position");
  const packed = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    packed[i * 3] = pos.getX(i);
    packed[i * 3 + 1] = pos.getY(i);
    packed[i * 3 + 2] = pos.getZ(i);
  }
  geo.setAttribute("position", new InterleavedBufferAttribute(new InterleavedBuffer(packed, 3), 3, 0));
}

describe("hide mesh-space box", () => {
  it("locks the Donner engine Kasten the player painted", () => {
    expect(DONNER_STOCK_ENGINE_BOX.min).toEqual({ x: -0.755, y: 0.472, z: 0.427 });
    expect(DONNER_STOCK_ENGINE_BOX.max).toEqual({ x: 0.568, y: 1.437, z: 1.262 });
    expect(meshInspectBoxContains(DONNER_STOCK_ENGINE_BOX, { x: -0.093, y: 0.955, z: 0.845 })).toBe(true);
    expect(meshInspectBoxContains(DONNER_STOCK_ENGINE_BOX, { x: 0, y: 0.1, z: 0 })).toBe(false);
  });

  it("adds leftover zoomie Kastens so Motor-aus can hide the whole old engine", () => {
    expect(DONNER_STOCK_ENGINE_REMAINDER_BOXES).toHaveLength(15);
    expect(DONNER_STOCK_ENGINE_BOXES).toHaveLength(16);
    expect(DONNER_STOCK_ENGINE_REMAINDER_BOXES.map((b) => [b.min, b.max])).toEqual([
      [{ x: 0.647, y: 0.375, z: 0.209 }, { x: 1.056, y: 0.526, z: 0.968 }],
      [{ x: 0.305, y: 0.410, z: 0.459 }, { x: 0.854, y: 1.069, z: 1.076 }],
      [{ x: -0.92, y: 0.367, z: 0.439 }, { x: -0.469, y: 0.749, z: 1.049 }],
      [{ x: -0.908, y: 0.293, z: 0.207 }, { x: -0.655, y: 0.989, z: 0.526 }],
      [{ x: -0.897, y: 0.259, z: -0.031 }, { x: -0.665, y: 0.514, z: 0.526 }],
      [{ x: 0.678, y: 0.373, z: 0.01 }, { x: 0.96, y: 0.503, z: 0.415 }],
      [{ x: 0.649, y: 0.302, z: 0.247 }, { x: 0.945, y: 0.536, z: 0.91 }],
      [{ x: 0.664, y: 0.284, z: 0.037 }, { x: 0.903, y: 0.365, z: 0.32 }],
      [{ x: -1.03, y: 0.204, z: 0.215 }, { x: -0.638, y: 0.569, z: 0.815 }],
      [{ x: 0.313, y: 0.288, z: 0.428 }, { x: 0.9, y: 1.15, z: 0.873 }],
      [{ x: 0.167, y: 0.458, z: 1.245 }, { x: 0.366, y: 1.012, z: 1.333 }],
      [{ x: -0.326, y: 0.386, z: 1.169 }, { x: -0.08, y: 0.813, z: 1.3 }],
      [{ x: -0.906, y: 0.486, z: 1.131 }, { x: -0.777, y: 0.734, z: 1.357 }],
      [{ x: 0.777, y: 0.263, z: 1.112 }, { x: 1.01, y: 0.6, z: 1.221 }],
      [{ x: -0.341, y: 1.043, z: 1.292 }, { x: 0.066, y: 1.175, z: 1.342 }],
    ]);
    const leftover = { x: 0.851, y: 0.45, z: 0.588 };
    expect(meshInspectBoxContains(DONNER_STOCK_ENGINE_BOX, leftover)).toBe(false);
    expect(inDonnerStockEngine(leftover)).toBe(true);
    const lowerPipe = { x: 0.783, y: 0.325, z: 0.178 };
    expect(meshInspectBoxContains(DONNER_STOCK_ENGINE_BOX, lowerPipe)).toBe(false);
    expect(inDonnerStockEngine(lowerPipe)).toBe(true);
  });

  it("hides a BodyPaint shard that sits fully inside the engine Kasten", () => {
    const body = new Mesh(new BoxGeometry(1.2, 0.9, 0.8), new MeshBasicMaterial());
    body.name = "BodyPaint";
    body.position.set(-0.093, 0.955, 0.845);
    const root = wrappedCar([body]);
    const hidden = hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOX);
    expect(hidden.meshes).toBe(1);
    expect(body.visible).toBe(false);
    expect(meshHasHiddenFaces(body)).toBe(true);
    expect(restoreHiddenMeshFaces(root)).toBe(1);
    expect(body.visible).toBe(true);
    expect(meshHasHiddenFaces(body)).toBe(false);
  });

  it("punches overlapping faces on a long mesh (not fully inside) with interleaved POSITION", () => {
    const geo = new BoxGeometry(1.2, 0.9, 1.2);
    interleavePosition(geo);
    expect(geo.getAttribute("position")).toBeInstanceOf(InterleavedBufferAttribute);
    expect(geo.getAttribute("position")).not.toBeInstanceOf(BufferAttribute);

    const body = new Mesh(geo, new MeshBasicMaterial());
    body.name = "BodyPaint";
    body.position.set(-0.093, 0.955, 0.845);
    const root = wrappedCar([body]);
    const before = triangleCount(body);
    const hidden = hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOX);
    expect(body.visible).toBe(true);
    expect(hidden.faces).toBeGreaterThan(0);
    expect(hidden.faces).toBeLessThan(before);
    expect(triangleCount(body)).toBe(before - hidden.faces);
  });

  it("does not punch StockWheel_* even when the Kasten overlaps a hub", () => {
    const wheel = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshBasicMaterial());
    wheel.name = "StockWheel_FL";
    wheel.position.set(-0.7, 0.6, 0.8);
    const root = wrappedCar([wheel]);
    const before = triangleCount(wheel);
    const hidden = hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOX);
    expect(hidden.faces).toBe(0);
    expect(hidden.meshes).toBe(0);
    expect(triangleCount(wheel)).toBe(before);
    expect(wheel.visible).toBe(true);
  });

  it("hides a leftover pipe shard that sits outside the block Kasten", () => {
    const pipe = new Mesh(new BoxGeometry(0.2, 0.1, 0.4), new MeshBasicMaterial());
    pipe.name = "BodyPaint";
    pipe.position.set(0.851, 0.45, 0.588);
    const root = wrappedCar([pipe]);
    expect(hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOX).meshes).toBe(0);
    expect(pipe.visible).toBe(true);
    const hidden = hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOXES);
    expect(hidden.meshes).toBe(1);
    expect(pipe.visible).toBe(false);
  });

  it("hides a lower leftover pipe the first remainder Kastens missed", () => {
    const pipe = new Mesh(new BoxGeometry(0.15, 0.05, 0.15), new MeshBasicMaterial());
    pipe.name = "BodyPaint";
    pipe.position.set(0.783, 0.325, 0.178);
    const root = wrappedCar([pipe]);
    expect(hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOX).meshes).toBe(0);
    expect(pipe.visible).toBe(true);
    const hidden = hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOXES);
    expect(hidden.meshes).toBe(1);
    expect(pipe.visible).toBe(false);
  });

  it("hides leftover StockEngine shards in the halo around the painted Kastens", () => {
    const shard = new Mesh(new BoxGeometry(0.08, 0.08, 0.08), new MeshBasicMaterial());
    shard.name = "StockEngine";
    shard.position.set(0, 0.95, 1.4);
    expect(meshInspectBoxContains(DONNER_STOCK_ENGINE_BOX, shard.position)).toBe(false);
    expect(inDonnerStockEngine(shard.position)).toBe(false);
    expect(inDonnerStockEngineHalo(shard.position)).toBe(true);
    expect(isDonnerStockEngineObject(shard)).toBe(true);
    const root = wrappedCar([shard]);
    const without = hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOXES);
    expect(without.meshes).toBe(0);
    const hidden = hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOXES, (p, mesh) =>
      isDonnerStockEngineObject(mesh) && inDonnerStockEngineHalo(p),
    );
    expect(hidden.meshes).toBe(1);
    expect(hidden.faces).toBeGreaterThan(0);
  });

  it("plugs the empty bay with a garage-paint block", () => {
    const fill = buildDonnerEngineBayFill("#339af0");
    expect(fill.name).toBe(DONNER_ENGINE_BAY_FILL_NAME);
    const plug = fill.children[0] as Mesh;
    expect(plug.position.x).toBeCloseTo(DONNER_ENGINE_BAY_FILL.x);
    expect(plug.position.y).toBeCloseTo(DONNER_ENGINE_BAY_FILL.y);
    expect(plug.position.z).toBeCloseTo(DONNER_ENGINE_BAY_FILL.z);
    expect((plug.material as MeshToonMaterial).color.getHex()).toBe(0x339af0);
    const root = wrappedCar([]);
    carMeshSpaceRoot(root).add(fill);
    expect(hideFacesInMeshSpaceBox(root, DONNER_STOCK_ENGINE_BOXES).meshes).toBe(0);
    expect(plug.visible).toBe(true);
  });
});

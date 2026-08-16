import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  applyLocalDeltaToVertices,
  applyWorldDeltaToEdge,
  pickClosestEdge,
  pickClosestEdgeInGeometry,
  pointToSegmentDistanceSq,
} from "../src/render/meshInspectEdges";

describe("mesh inspect edges", () => {
  it("measures distance to a segment", () => {
    expect(pointToSegmentDistanceSq(new Vector3(0, 1, 0), new Vector3(-1, 0, 0), new Vector3(1, 0, 0))).toBeCloseTo(1);
    expect(pointToSegmentDistanceSq(new Vector3(0, 0, 0), new Vector3(-1, 0, 0), new Vector3(1, 0, 0))).toBeCloseTo(0);
  });

  it("picks the nearest unique edge and moves only that edge", () => {
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    const local = new Vector3(1, 1, 0);
    const picked = pickClosestEdgeInGeometry(mesh.geometry, local);
    expect(picked).toBeTruthy();
    expect(picked!.indices.length).toBeGreaterThanOrEqual(2);

    const pos = mesh.geometry.getAttribute("position");
    const before = picked!.indices.map((i) => [pos.getX(i), pos.getY(i), pos.getZ(i)] as const);
    applyLocalDeltaToVertices(mesh.geometry, picked!.indices, 0.25, 0, 0);
    for (let n = 0; n < picked!.indices.length; n++) {
      const i = picked!.indices[n]!;
      expect(pos.getX(i)).toBeCloseTo(before[n]![0] + 0.25, 5);
    }
  });

  it("moves a world-space edge without translating the object origin", () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.position.set(2, 0, 0);
    mesh.updateMatrixWorld(true);
    const edge = pickClosestEdge(mesh, new Vector3(2.5, 0.5, 0));
    expect(edge).toBeTruthy();
    const origin = mesh.position.clone();
    applyWorldDeltaToEdge(edge!, new Vector3(0, 0.2, 0));
    expect(mesh.position.x).toBeCloseTo(origin.x, 5);
    expect(mesh.position.y).toBeCloseTo(origin.y, 5);
  });
});

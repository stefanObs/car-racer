import { describe, expect, it } from "vitest";
import type { Node as GltfNode } from "@gltf-transform/core";
import { Quaternion, Vector3 } from "three";
import { buildReinforcedFrame } from "../src/render/carPartBuilders";

const POLE_R = 0.025;
const INTO = 0.08;

const WAIST_L_PICK = {
  name: "WaistL",
  front: new Vector3(-0.571, 1.061, -0.449),
  rear: new Vector3(0.57, 1.051, -0.6),
};
const WAIST_R_PICK = {
  name: "WaistR",
  front: new Vector3(-0.504, 1.061, 0.49),
  rear: new Vector3(0.579, 1.063, 0.57),
};

function cylinderEnds(node: GltfNode): [Vector3, Vector3] {
  const t = new Vector3(...node.getTranslation());
  const q = node.getRotation();
  const quat = new Quaternion(q[0]!, q[1]!, q[2]!, q[3]!);
  const mesh = node.getMesh();
  if (!mesh) throw new Error("expected mesh");
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      ymin = Math.min(ymin, v[1]!);
      ymax = Math.max(ymax, v[1]!);
    }
  }
  return [
    new Vector3(0, ymin, 0).applyQuaternion(quat).add(t),
    new Vector3(0, ymax, 0).applyQuaternion(quat).add(t),
  ];
}

function distToSegment(p: Vector3, a: Vector3, b: Vector3): number {
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq();
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / lenSq));
  return a.clone().add(ab.multiplyScalar(t)).distanceTo(p);
}

function projectT(p: Vector3, a: Vector3, b: Vector3): number {
  const ab = b.clone().sub(a);
  return p.clone().sub(a).dot(ab) / ab.lengthSq();
}

function orderFrontRear(a: Vector3, b: Vector3): [Vector3, Vector3] {
  return a.x <= b.x ? [a, b] : [b, a];
}

function expectRailCovers(ends: [Vector3, Vector3], pick: { front: Vector3; rear: Vector3 }): void {
  const [front, rear] = orderFrontRear(ends[0], ends[1]);
  expect(distToSegment(pick.front, front, rear)).toBeLessThan(POLE_R);
  expect(distToSegment(pick.rear, front, rear)).toBeLessThan(POLE_R);
  expect(front.distanceTo(pick.front)).toBeGreaterThan(INTO * 0.85);
  expect(rear.distanceTo(pick.rear)).toBeGreaterThan(INTO * 0.85);
  expect(projectT(pick.front, front, rear)).toBeGreaterThan(0.02);
  expect(projectT(pick.front, front, rear)).toBeLessThan(0.2);
  expect(projectT(pick.rear, front, rear)).toBeGreaterThan(0.8);
  expect(projectT(pick.rear, front, rear)).toBeLessThan(0.98);
}

describe("Käferkraft pole-frame waist", () => {
  it("ships detached WaistL / WaistR covering their own BodyPaint spans", async () => {
    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read("public/models/parts/kaeferkraft-reinforced_frame.glb");
    const named = (n: string) => doc.getRoot().listNodes().find((node) => node.getMesh() && node.getName() === n);
    const left = named("WaistL");
    const right = named("WaistR");
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(doc.getRoot().listNodes().some((n) => n.getName() === "Waist" || n.getName() === "Waist_1")).toBe(false);
    expectRailCovers(cylinderEnds(left!), WAIST_L_PICK);
    expectRailCovers(cylinderEnds(right!), WAIST_R_PICK);

    expect(named("WaistToFrontTop_L")).toBeTruthy();
    expect(named("WaistToFrontTop_R")).toBeTruthy();
    expect(doc.getRoot().listNodes().some((n) => n.getName() === "WaistToFrontTop")).toBe(false);
  });

  it("keeps the procedural buggy fallback on detached WaistL / WaistR", () => {
    const g = buildReinforcedFrame("buggy");
    const left = g.children.find((c) => c.name === "WaistL");
    const right = g.children.find((c) => c.name === "WaistR");
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(g.children.some((c) => c.name === "Waist")).toBe(false);
    const endsOf = (mesh: (typeof g.children)[number]) => {
      const half = (mesh.geometry as { parameters?: { height?: number } }).parameters?.height ?? 0;
      const a = new Vector3(0, -half / 2, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
      const b = new Vector3(0, half / 2, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
      return [a, b] as [Vector3, Vector3];
    };
    expectRailCovers(endsOf(left!), WAIST_L_PICK);
    expectRailCovers(endsOf(right!), WAIST_R_PICK);
    expect(g.children.some((c) => c.name === "WaistToFrontTop_L")).toBe(true);
    expect(g.children.some((c) => c.name === "WaistToFrontTop_R")).toBe(true);
  });
});

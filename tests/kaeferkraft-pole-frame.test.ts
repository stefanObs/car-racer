import { describe, expect, it } from "vitest";
import type { Node as GltfNode } from "@gltf-transform/core";
import { Quaternion, Vector3 } from "three";
import { buildReinforcedFrame } from "../src/render/carPartBuilders";

const POLE_R = 0.025;
const INTO = 0.08;

/** BodyPaint garage picks — the waist must cover this span, then bury both caps. */
const WAIST_PICKS = [
  { front: new Vector3(-0.551, 1.029, -0.49), rear: new Vector3(0.799, 0.947, -0.498) },
  { front: new Vector3(-0.534, 1.001, 0.454), rear: new Vector3(0.553, 1.015, 0.564) },
] as const;

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

function expectWaistCoversPicks(endsByZ: [Vector3, Vector3][]): void {
  for (const pick of WAIST_PICKS) {
    const pole = endsByZ.find((ends) => Math.sign(ends[0].z + ends[1].z) === Math.sign(pick.front.z));
    expect(pole).toBeTruthy();
    const [front, rear] = orderFrontRear(pole![0], pole![1]);
    expect(distToSegment(pick.front, front, rear)).toBeLessThan(POLE_R);
    expect(distToSegment(pick.rear, front, rear)).toBeLessThan(POLE_R);
    expect(front.distanceTo(pick.front)).toBeGreaterThan(INTO * 0.85);
    expect(rear.distanceTo(pick.rear)).toBeGreaterThan(INTO * 0.85);
    expect(projectT(pick.front, front, rear)).toBeGreaterThan(0.02);
    expect(projectT(pick.front, front, rear)).toBeLessThan(0.2);
    expect(projectT(pick.rear, front, rear)).toBeGreaterThan(0.8);
    expect(projectT(pick.rear, front, rear)).toBeLessThan(0.98);
  }
}

describe("Käferkraft pole-frame waist", () => {
  it("covers the BodyPaint span and buries both caps in the frame", async () => {
    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read("public/models/parts/kaeferkraft-reinforced_frame.glb");
    const waist = doc.getRoot().listNodes().filter((n) => {
      const name = n.getMesh() && n.getName();
      return name === "Waist" || name === "Waist_1";
    });
    expect(waist.length).toBe(2);
    expectWaistCoversPicks(waist.map(cylinderEnds));

    expect(doc.getRoot().listNodes().some((n) => n.getName().startsWith("XRearToDash"))).toBe(false);
    expect(doc.getRoot().listNodes().some((n) => n.getName().startsWith("RearStay"))).toBe(false);
    const stay = doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getName().startsWith("WaistToFrontTop"));
    expect(stay.length).toBe(2);
    for (const n of stay) {
      const [x, y] = n.getTranslation();
      expect(y!).toBeGreaterThan(1.1);
      expect(y!).toBeLessThan(1.35);
      expect(x!).toBeGreaterThan(0.1);
      expect(x!).toBeLessThan(0.4);
    }
  });

  it("keeps the procedural buggy fallback on the same BodyPaint waist span", () => {
    const g = buildReinforcedFrame("buggy");
    const waist = g.children.filter((c) => c.name === "Waist");
    expect(waist.length).toBe(2);
    const ends = waist.map((mesh) => {
      const half = (mesh.geometry as { parameters?: { height?: number } }).parameters?.height ?? 0;
      const a = new Vector3(0, -half / 2, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
      const b = new Vector3(0, half / 2, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
      return [a, b] as [Vector3, Vector3];
    });
    expectWaistCoversPicks(ends);
    expect(g.children.some((c) => c.name === "XRearToDash")).toBe(false);
    expect(g.children.some((c) => c.name === "RearStay")).toBe(false);
    const stay = g.children.filter((c) => c.name === "WaistToFrontTop");
    expect(stay.length).toBe(2);
    for (const n of stay) {
      expect(n.position.y).toBeGreaterThan(1.1);
      expect(n.position.y).toBeLessThan(1.35);
      expect(n.position.x).toBeGreaterThan(0.1);
      expect(n.position.x).toBeLessThan(0.4);
    }
  });
});

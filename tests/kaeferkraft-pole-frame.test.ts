import { describe, expect, it } from "vitest";
import type { Document, Node as GltfNode } from "@gltf-transform/core";
import { buildReinforcedFrame } from "../src/render/carPartBuilders";

function gltfPositions(doc: Document): [number, number, number][] {
  const out: [number, number, number][] = [];
  const walk = (node: GltfNode): void => {
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const v = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v);
          out.push([v[0]!, v[1]!, v[2]!]);
        }
      }
    }
    for (const child of node.listChildren()) walk(child);
  };
  for (const root of doc.getRoot().listScenes()[0]!.listChildren()) walk(root);
  return out;
}

const POLE_R = 0.025;

describe("Käferkraft pole-frame waist", () => {
  it("clears the seats and stops short of the front teal cowl", async () => {
    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const { MeshoptDecoder } = await import("meshoptimizer");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read("public/models/parts/kaeferkraft-reinforced_frame.glb");
    const waist = doc.getRoot().listNodes().filter((n) => {
      const name = n.getMesh() && n.getName();
      return name === "Waist" || name === "Waist_1";
    });
    expect(waist.length).toBe(2);
    for (const n of waist) {
      const [x, y, z] = n.getTranslation();
      expect(Math.abs(z!)).toBeGreaterThan(0.53);
      expect(Math.abs(z!)).toBeLessThan(0.58);
      expect(y!).toBeGreaterThan(0.92);
      expect(y!).toBeLessThan(1);
      // Midpoint shifted aft so the nose-side end no longer sits in the cowl.
      expect(x!).toBeGreaterThan(0.08);
    }

    const carIo = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const bodyVerts = gltfPositions(await carIo.read("public/models/cars/kaeferkraft.glb"));
    const seats = bodyVerts.filter(
      (v) =>
        v[0] >= -0.2 &&
        v[0] <= 0.4 &&
        v[1] >= 0.45 &&
        v[1] <= 0.95 &&
        Math.abs(v[2]) >= 0.15 &&
        Math.abs(v[2]) <= 0.36,
    );
    const seatOuterZ = Math.max(...seats.map((v) => Math.abs(v[2])));
    const waistZ = Math.max(...waist.map((n) => Math.abs(n.getTranslation()[2]!)));
    expect(waistZ - POLE_R).toBeGreaterThan(seatOuterZ);
    expect(waistZ + POLE_R).toBeLessThan(0.62);
    expect(doc.getRoot().listNodes().some((n) => n.getName().startsWith("XRearToDash"))).toBe(false);
    expect(doc.getRoot().listNodes().some((n) => n.getName().startsWith("RearStay"))).toBe(false);
    const stay = doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getName().startsWith("WaistToFrontTop"));
    expect(stay.length).toBe(2);
    for (const n of stay) {
      const [x, y, z] = n.getTranslation();
      expect(y!).toBeGreaterThan(1.15);
      expect(y!).toBeLessThan(1.3);
      expect(x!).toBeGreaterThan(0.05);
      expect(x!).toBeLessThan(0.3);
      expect(Math.abs(z!)).toBeGreaterThan(0.48);
      expect(Math.abs(z!)).toBeLessThan(0.55);
    }
  });

  it("keeps the procedural buggy fallback on the same waist plane", () => {
    const g = buildReinforcedFrame("buggy");
    const waist = g.children.filter((c) => c.name === "Waist");
    expect(waist.length).toBe(2);
    for (const n of waist) {
      expect(Math.abs(n.position.z)).toBeGreaterThan(0.53);
      expect(Math.abs(n.position.z)).toBeLessThan(0.58);
      expect(n.position.y).toBeGreaterThan(0.92);
      expect(n.position.y).toBeLessThan(1);
      expect(n.position.x).toBeGreaterThan(0.08);
    }
    expect(g.children.some((c) => c.name === "XRearToDash")).toBe(false);
    expect(g.children.some((c) => c.name === "RearStay")).toBe(false);
    const stay = g.children.filter((c) => c.name === "WaistToFrontTop");
    expect(stay.length).toBe(2);
    for (const n of stay) {
      expect(n.position.y).toBeGreaterThan(1.15);
      expect(n.position.y).toBeLessThan(1.3);
      expect(n.position.x).toBeGreaterThan(0.05);
      expect(n.position.x).toBeLessThan(0.3);
    }
  });
});

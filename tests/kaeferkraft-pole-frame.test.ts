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

describe("Käferkraft pole-frame waist", () => {
  it("vanishes into the teal cabin side, not outboard of the paint", async () => {
    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const { MeshoptDecoder } = await import("meshoptimizer");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read("public/models/parts/kaeferkraft-reinforced_frame.glb");
    const waist = doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getName().startsWith("Waist"));
    expect(waist.length).toBe(2);
    for (const n of waist) {
      const [, y, z] = n.getTranslation();
      expect(Math.abs(z!)).toBeGreaterThan(0.27);
      expect(Math.abs(z!)).toBeLessThan(0.36);
      expect(y!).toBeGreaterThan(1.02);
      expect(y!).toBeLessThan(1.1);
    }

    const carIo = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const bodyVerts = gltfPositions(await carIo.read("public/models/cars/kaeferkraft.glb"));
    // Narrow teal cabin strip (x≈−0.3) — not the front/rear fender flares.
    const cabinStrip = bodyVerts.filter(
      (v) => v[0] >= -0.38 && v[0] <= -0.22 && v[1] >= 1.02 && v[1] <= 1.08 && Math.abs(v[2]) >= 0.2,
    );
    const stripOuterZ = Math.max(...cabinStrip.map((v) => Math.abs(v[2])));
    const waistZ = Math.max(...waist.map((n) => Math.abs(n.getTranslation()[2]!)));
    const poleR = 0.025;
    expect(waistZ + poleR).toBeLessThanOrEqual(stripOuterZ);
    expect(waistZ).toBeGreaterThan(0.27);
  });

  it("keeps the procedural buggy fallback on the same waist plane", () => {
    const g = buildReinforcedFrame("buggy");
    const waist = g.children.filter((c) => c.name === "Waist");
    expect(waist.length).toBe(2);
    for (const n of waist) {
      expect(Math.abs(n.position.z)).toBeGreaterThan(0.27);
      expect(Math.abs(n.position.z)).toBeLessThan(0.36);
      expect(n.position.y).toBeGreaterThan(1.02);
      expect(n.position.y).toBeLessThan(1.1);
    }
  });
});

import { describe, expect, it } from "vitest";
import type { Document, Node as GltfNode } from "@gltf-transform/core";

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
  it("sits just inside the teal side-rail outer, at the rail top", async () => {
    const { NodeIO } = await import("@gltf-transform/core");
    const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
    const { MeshoptDecoder } = await import("meshoptimizer");
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read("public/models/parts/kaeferkraft-reinforced_frame.glb");
    const waist = doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getName().startsWith("Waist"));
    expect(waist.length).toBe(2);
    for (const n of waist) {
      const [, y, z] = n.getTranslation();
      expect(Math.abs(z!)).toBeGreaterThan(0.66);
      expect(Math.abs(z!)).toBeLessThan(0.73);
      expect(y!).toBeGreaterThan(1.1);
      expect(y!).toBeLessThan(1.18);
    }

    const carIo = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const bodyVerts = gltfPositions(await carIo.read("public/models/cars/kaeferkraft.glb"));
    const beltOuter = bodyVerts.filter(
      (v) => v[0] >= -0.55 && v[0] <= 0.55 && v[1] >= 1.02 && v[1] <= 1.18 && Math.abs(v[2]) >= 0.55,
    );
    const bodyOuterZ = Math.max(...beltOuter.map((v) => Math.abs(v[2])));
    const waistZ = Math.max(...waist.map((n) => Math.abs(n.getTranslation()[2]!)));
    const poleR = 0.025;
    expect(waistZ + poleR).toBeLessThanOrEqual(bodyOuterZ);
    expect(waistZ + poleR).toBeGreaterThan(bodyOuterZ - 0.08);
  });
});

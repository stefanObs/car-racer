import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { Node as GltfNode } from "@gltf-transform/core";
import { buildLightweightBody } from "../src/render/carPartBuilders";

function namedMesh(doc: Awaited<ReturnType<NodeIO["read"]>>, name: string): GltfNode {
  const node = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getName() === name);
  if (!node) throw new Error(`missing ${name}`);
  return node;
}

function worldAabb(node: GltfNode): { min: number[]; max: number[] } {
  const t = node.getTranslation();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const prim of node.getMesh()!.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      for (let k = 0; k < 3; k++) {
        const w = v[k]! + t[k]!;
        min[k] = Math.min(min[k]!, w);
        max[k] = Math.max(max[k]!, w);
      }
    }
  }
  return { min, max };
}

describe("Käferkraft Leichtbau left/right split", () => {
  it("ships detached LightweightL / LightweightR on opposite mesh X", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read("public/models/parts/kaeferkraft-lightweight_body.glb");
    const left = namedMesh(doc, "LightweightL");
    const right = namedMesh(doc, "LightweightR");
    expect(doc.getRoot().listNodes().some((n) => n.getName() === "Lightweight")).toBe(false);

    const leftBox = worldAabb(left);
    const rightBox = worldAabb(right);
    // Mesh +X → car −Z after mount yaw π/2 (left); mesh −X → car +Z (right).
    expect(leftBox.min[0]).toBeGreaterThan(0.4);
    expect(rightBox.max[0]).toBeLessThan(-0.4);
    expect(leftBox.min[0]).toBeGreaterThan(rightBox.max[0]!);

    const mat = left.getMesh()?.listPrimitives()[0]?.getMaterial();
    expect(mat?.getName()).toBe("Carbon");
  });

  it("keeps the procedural buggy fallback on detached LightweightL / LightweightR", () => {
    const g = buildLightweightBody("holes");
    const left = g.getObjectByName("LightweightL");
    const right = g.getObjectByName("LightweightR");
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(g.children.some((c) => c.name === "Lightweight")).toBe(false);
    expect(left!.children.length).toBeGreaterThan(0);
    expect(right!.children.length).toBeGreaterThan(0);
  });
});

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { CAR_MODELS } from "../src/data/carModels";

describe("Bison Tripo arcade bake", () => {
  it("is a BodyPaint pickup with length along +Z and cab toward the nose", async () => {
    const path = resolve("public/models/cars/bison.glb");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    const text = readFileSync(path).toString("latin1");
    expect(text).toContain("BodyPaint");

    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    expect(sz).toBeGreaterThan(sx);
    expect(sz).toBeGreaterThan(3.2);
    expect(sz).toBeLessThan(4.1);
    expect(sy).toBeGreaterThan(1.0);
    expect(sy).toBeLessThan(2.4);
    expect(CAR_MODELS.bison.scale).toBe(1);
    expect(CAR_MODELS.bison.yaw).toBe(0);

    const midZ = (b.min[2] + b.max[2]) / 2;
    let highNeg = 0;
    let highPos = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          if ((v[1] ?? 0) <= 1.1) continue;
          if (v[2]! < midZ) highNeg += 1;
          else highPos += 1;
        }
      }
    }
    // Cab greenhouse has more high verts on +Z; open bed is the hollow −Z half.
    expect(highPos).toBeGreaterThan(highNeg);
  });
});

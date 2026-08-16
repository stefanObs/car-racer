import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { CAR_MODELS } from "../src/data/carModels";

describe("Bunker Tripo arcade bake", () => {
  it("is a BodyPaint APC with length along +Z", async () => {
    const path = resolve("public/models/cars/bunker.glb");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    const text = readFileSync(path).toString("latin1");
    expect(text).toContain("BodyPaint");

    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    expect(sz).toBeGreaterThan(sx);
    expect(sz).toBeGreaterThan(3.4);
    expect(sz).toBeLessThan(4.2);
    expect(sy).toBeGreaterThan(1.4);
    expect(sy).toBeLessThan(2.6);
    expect(CAR_MODELS.bunker.scale).toBe(1);
    expect(CAR_MODELS.bunker.yaw).toBe(0);
  });

  it("keeps welded textured tires on BodyPaint (no UV-carve Tire prims)", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/bunker.glb"),
    );
    expect(doc.getRoot().listMaterials().map((m) => m.getName())).toEqual(["BodyPaint"]);
    expect(doc.getRoot().listNodes().some((n) => n.getName()?.startsWith("StockWheel_"))).toBe(false);

    const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
    expect(prims).toHaveLength(1);
    const prim = prims[0]!;
    expect(prim.getMaterial()?.getBaseColorTexture()).toBeTruthy();
    const pos = prim.getAttribute("POSITION");
    const idx = prim.getIndices();
    expect(pos).toBeTruthy();
    expect(idx).toBeTruthy();
    expect(idx!.getCount() / 3).toBeGreaterThan(4000);

    let tireVolumeVerts = 0;
    for (let i = 0; i < pos!.getCount(); i++) {
      const [x, y, z] = pos!.getElement(i, []);
      const front = z! >= 0.7 && z! <= 1.85;
      const rear = z! <= -0.55 && z! >= -1.85;
      if (y! >= 0 && y! <= 0.72 && Math.abs(x!) >= 0.55 && Math.abs(x!) <= 1.05 && (front || rear)) {
        tireVolumeVerts++;
      }
    }
    expect(tireVolumeVerts).toBeGreaterThan(800);
  });
});

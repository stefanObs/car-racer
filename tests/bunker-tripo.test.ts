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

  it("ships Tripo-segmented StockWheel_* with comic Tire albedo", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/bunker.glb"),
    );
    expect(doc.getRoot().listMaterials().map((m) => m.getName()).sort()).toEqual(["BodyPaint", "Tire"]);

    let bodyMaps = 0;
    const wheels: string[] = [];
    for (const mesh of doc.getRoot().listMeshes()) {
      const name = mesh.getName() ?? "";
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial();
        const tex = mat?.getBaseColorTexture();
        const uv = prim.getAttribute("TEXCOORD_0");
        if (mat?.getName() === "BodyPaint") {
          expect(tex, name).toBeTruthy();
          expect(uv, name).toBeTruthy();
          if (tex) bodyMaps += 1;
        }
      }
      if (!name.startsWith("StockWheel_")) continue;
      wheels.push(name);
      expect(mesh.listPrimitives().every((p) => p.getMaterial()?.getName() === "Tire"), name).toBe(true);
      expect(
        mesh.listPrimitives().every((p) => p.getMaterial()?.getBaseColorTexture()),
        name,
      ).toBe(true);
      const face = mesh.listPrimitives().find((p) => p.getAttribute("TEXCOORD_0")?.getCount() === 33);
      expect(face, name).toBeTruthy();
    }
    expect(bodyMaps).toBeGreaterThan(0);
    expect([...new Set(wheels)].sort()).toEqual([
      "StockWheel_FL",
      "StockWheel_FR",
      "StockWheel_RL",
      "StockWheel_RR",
    ]);
  });

  it("keeps a hub hole on every StockWheel so face disks are not warped by rubber", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/bunker.glb"),
    );
    for (const corner of ["FL", "FR", "RL", "RR"] as const) {
      const mesh = doc.getRoot().listMeshes().find((m) => m.getName() === `StockWheel_${corner}`);
      expect(mesh, corner).toBeTruthy();
      const rubber = mesh!
        .listPrimitives()
        .find((p) => (p.getAttribute("TEXCOORD_0")?.getCount() ?? 0) !== 33);
      expect(rubber, corner).toBeTruthy();
      const pos = rubber!.getAttribute("POSITION")!;
      let rMin = Infinity;
      let rMax = 0;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        const r = Math.hypot(v[1]!, v[2]!);
        if (r < 1e-5) continue;
        rMin = Math.min(rMin, r);
        rMax = Math.max(rMax, r);
      }
      expect(rMin / rMax, corner).toBeGreaterThan(0.35);
    }
  });
});

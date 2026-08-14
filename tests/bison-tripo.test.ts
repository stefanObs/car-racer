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

  it("keeps BodyPaint atlas on body and comic albedo on StockWheel_*", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/cars/bison.glb"),
    );
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
      const mats = mesh.listPrimitives().map((p) => p.getMaterial()?.getName());
      expect(mats.every((m) => m === "Tire"), name).toBe(true);
      expect(
        mesh.listPrimitives().every((p) => p.getMaterial()?.getBaseColorTexture()),
        name,
      ).toBe(true);
      const face = mesh.listPrimitives().find((p) => p.getAttribute("TEXCOORD_0")?.getCount() === 33);
      expect(face, name).toBeTruthy();
      const faceUv = face!.getAttribute("TEXCOORD_0")!;
      let minR = Infinity;
      let maxR = 0;
      for (let i = 0; i < faceUv.getCount(); i++) {
        const [u, v] = faceUv.getElement(i, []);
        const r = Math.hypot(u! - 0.5, v! - 0.5);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
      }
      expect(minR, name).toBeLessThan(0.05);
      expect(maxR, name).toBeGreaterThan(0.45);
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
      resolve("public/models/cars/bison.glb"),
    );
    for (const corner of ["FL", "FR", "RL", "RR"] as const) {
      const mesh = doc.getRoot().listMeshes().find((m) => m.getName() === `StockWheel_${corner}`);
      expect(mesh, corner).toBeTruthy();
      // Rubber = non-face prim (face disks have 33 UV verts).
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
      // Filled front segments used to have rMin≈0 and annulus-warped hubcaps.
      expect(rMin / rMax, corner).toBeGreaterThan(0.35);
    }
  });
});

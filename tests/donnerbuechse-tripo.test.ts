import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { CAR_MODELS } from "../src/data/carModels";

describe("Donnerbüchse Tripo arcade bake", () => {
  it("is a BodyPaint hot rod with length along +Z and cabin toward the rear", async () => {
    const path = resolve("public/models/cars/donnerbuechse.glb");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    const text = readFileSync(path).toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(text).toContain("StockEngine");
    expect(text).toContain("Chrome");

    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const engNode = doc.getRoot().listNodes().find((n) => n.getName() === "StockEngine");
    expect(engNode?.getMesh()?.listPrimitives()[0]?.getMaterial()?.getName()).toBe("Chrome");

    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    expect(sz).toBeGreaterThan(sx);
    expect(sz).toBeGreaterThan(3.2);
    expect(sz).toBeLessThan(4.1);
    expect(sy).toBeGreaterThan(0.9);
    expect(sy).toBeLessThan(2.2);
    expect(CAR_MODELS.donnerbuechse.scale).toBe(1);
    expect(CAR_MODELS.donnerbuechse.yaw).toBe(0);

    const midZ = (b.min[2] + b.max[2]) / 2;
    let maxYNeg = -Infinity;
    let maxYPos = -Infinity;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          if (v[2]! < midZ) maxYNeg = Math.max(maxYNeg, v[1]!);
          else maxYPos = Math.max(maxYPos, v[1]!);
        }
      }
    }
    // Chopped cabin / fat rear tires sit on −Z; long hood is the lower +Z half.
    expect(maxYNeg).toBeGreaterThan(maxYPos - 0.02);
  });

  it("stock albedo has almost no baked door-flame oranges", async () => {
    const path = resolve("public/models/cars/donnerbuechse.glb");
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const sharp = (await import("sharp")).default;
    let orange = 0;
    let total = 0;
    for (const tex of doc.getRoot().listTextures()) {
      const raw = tex.getImage();
      if (!raw) continue;
      const { data } = await sharp(Buffer.from(raw)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4) {
        total++;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        if (r > 150 && r > g + 12 && r - b > 55 && g > 35 && g >= b - 10) orange++;
      }
    }
    expect(total).toBeGreaterThan(10_000);
    expect(orange / total).toBeLessThan(0.005);
  });

  it("Großer Motor GLB is silver Chrome (no body-paint bleed)", async () => {
    const path = resolve("public/models/parts/donnerbuechse-big_engine.glb");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const mat = doc.getRoot().listMaterials()[0];
    expect(mat?.getName()).toBe("Chrome");
    const raw = mat?.getBaseColorTexture()?.getImage();
    expect(raw).toBeTruthy();
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(Buffer.from(raw!)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let red = 0;
    let blue = 0;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r + g + b < 40) continue;
      lit++;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      if (r === max && chroma / max > 0.22 && r > g + 8 && r > b + 8) red++;
      if (b === max && chroma / max > 0.32 && b > r + 8 && b > g + 16) blue++;
    }
    expect(lit).toBeGreaterThan(10_000);
    expect(red / lit).toBeLessThan(0.02);
    expect(blue / lit).toBeLessThan(0.01);
  });
});

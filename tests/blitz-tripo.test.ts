import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { CAR_MODELS } from "../src/data/carModels";

describe("Blitz Tripo arcade bake", () => {
  it("is a BodyPaint coupe with length along +Z", async () => {
    const path = resolve("public/models/cars/blitz.glb");
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
    expect(sy).toBeGreaterThan(0.9);
    expect(sy).toBeLessThan(1.9);
    expect(CAR_MODELS.blitz.scale).toBe(1);
    expect(CAR_MODELS.blitz.yaw).toBe(0);

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
    // Cabin sits on −Z; nose is the lower +Z half (stock body has no tall wing).
    expect(maxYNeg).toBeGreaterThan(maxYPos - 0.02);
  });

  it("keeps windshield glass geometry (Tripo cabin glass, no open hole)", async () => {
    const path = resolve("public/models/cars/blitz.glb");
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    let windshieldBand = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          if (v[2]! > -0.1 && v[2]! < 0.7 && v[1]! > 0.65 && Math.abs(v[0]!) < 0.75) windshieldBand++;
        }
      }
    }
    expect(windshieldBand).toBeGreaterThan(200);
  });

  it("does not force-darken Tripo glass in the extract bake script", () => {
    const src = readFileSync("scripts/extract-blitz-stock-and-spoiler.mjs", "utf8");
    expect(src).not.toContain("darkenGlassTexels");
    expect(src).not.toContain("Opaque dark cabin glass");
  });

  it("keeps the full Blitz coupe deck (wing lives on StockSpoiler)", async () => {
    expect(existsSync("scripts/bake-blitz-segmented-parts.mjs")).toBe(true);

    const path = resolve("public/models/cars/blitz.glb");
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const body = doc.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
    expect(body).toBeTruthy();
    let highRearBody = 0;
    let deck = 0;
    let trunkSheet = 0;
    let capFaces = 0;
    for (const prim of body!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION")!;
      const idx = prim.getIndices()!;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        if (v[2]! < -1.22 && v[1]! >= 0.88) highRearBody++;
        if (v[2]! < -1.2 && v[1]! >= 0.65 && v[1]! < 0.85) deck++;
        if (v[2]! < -1.45 && v[1]! >= 0.72 && v[1]! < 0.86 && Math.abs(v[0]!) < 0.55) trunkSheet++;
      }
      for (let t = 0; t < idx.getCount() / 3; t++) {
        const a = pos.getElement(idx.getScalar(t * 3), []);
        const b = pos.getElement(idx.getScalar(t * 3 + 1), []);
        const c = pos.getElement(idx.getScalar(t * 3 + 2), []);
        const cx = (a[0]! + b[0]! + c[0]!) / 3;
        const cy = (a[1]! + b[1]! + c[1]!) / 3;
        const cz = (a[2]! + b[2]! + c[2]!) / 3;
        const ny = (b[2]! - a[2]!) * (c[0]! - a[0]!) - (b[0]! - a[0]!) * (c[2]! - a[2]!);
        if (cz < -1.42 && cz > -1.82 && cy >= 0.68 && cy <= 0.82 && Math.abs(cx) < 0.5 && ny > 0) {
          capFaces++;
        }
      }
    }
    expect(highRearBody).toBeLessThan(20);
    expect(deck).toBeGreaterThan(40);
    expect(trunkSheet).toBeGreaterThan(40);
    expect(capFaces).toBeGreaterThan(1);

    const spoiler = doc.getRoot().listNodes().find((n) => n.getName() === "StockSpoiler");
    expect(spoiler).toBeTruthy();
    const t = spoiler!.getTranslation();
    expect(t[2]).toBeLessThan(-1.4);
    expect(t[1]).toBeGreaterThan(0.7);
    const strutNames = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockStrut_"))
      .sort();
    expect(strutNames).toEqual(["StockStrut_L", "StockStrut_R"]);
  });
});

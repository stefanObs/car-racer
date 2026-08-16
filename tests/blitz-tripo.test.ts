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
    // Cabin and welded GT wing sit on −Z; nose is the lower +Z half.
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

  it("keeps the welded GT wing on BodyPaint and remounts StockWheel_* only", async () => {
    expect(existsSync("scripts/bake-blitz-segmented-parts.mjs")).toBe(true);

    const path = resolve("public/models/cars/blitz.glb");
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const names = doc.getRoot().listNodes().map((n) => n.getName());
    expect(names.some((n) => n === "StockSpoiler")).toBe(false);
    expect(names.some((n) => n?.startsWith("StockStrut_"))).toBe(false);
    expect(names.filter((n) => n?.startsWith("StockWheel_")).sort()).toEqual([
      "StockWheel_FL",
      "StockWheel_FR",
      "StockWheel_RL",
      "StockWheel_RR",
    ]);

    const body = doc.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
    expect(body).toBeTruthy();
    let highRearBody = 0;
    let deck = 0;
    for (const prim of body!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION")!;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        if (v[2]! < -1.22 && v[1]! >= 0.88) highRearBody++;
        if (v[2]! < -1.2 && v[1]! >= 0.65 && v[1]! < 0.85) deck++;
      }
    }
    expect(highRearBody).toBeGreaterThan(80);
    expect(deck).toBeGreaterThan(40);
  });
});

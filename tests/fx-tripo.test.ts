import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { FX_CHUNK_IDS, FX_URLS } from "../src/render/loadFxGltf";

const FILES: Record<(typeof FX_CHUNK_IDS)[number], { file: string; mat: string; min: number; max: number }> = {
  smokePuff: { file: "smoke-puff.glb", mat: "SmokePuff", min: 0.35, max: 0.9 },
  smokeHeavy: { file: "smoke-heavy.glb", mat: "SmokeHeavy", min: 0.5, max: 1.05 },
  repairSpark: { file: "repair-spark.glb", mat: "RepairSpark", min: 0.15, max: 0.4 },
  nitroOrange: { file: "nitro-orange.glb", mat: "NitroOrange", min: 0.7, max: 1.25 },
  nitroOrangeB: { file: "nitro-orange-b.glb", mat: "NitroOrange", min: 0.7, max: 1.25 },
  nitroCyan: { file: "nitro-cyan.glb", mat: "NitroCyan", min: 0.7, max: 1.25 },
  nitroCyanB: { file: "nitro-cyan-b.glb", mat: "NitroCyan", min: 0.7, max: 1.25 },
  lapShield: { file: "lap-shield.glb", mat: "LapShield", min: 0.9, max: 1.7 },
};

describe("Tripo comic FX bakes", () => {
  it("maps every FX id to a public GLB", () => {
    for (const id of FX_CHUNK_IDS) {
      expect(FX_URLS[id]).toBe(`/models/fx/${FILES[id].file}`);
    }
  });

  it("ships real GLBs with named comic materials and arcade-small bounds", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    for (const id of FX_CHUNK_IDS) {
      const spec = FILES[id];
      const path = resolve("public/models/fx", spec.file);
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(2_000);
      expect(statSync(path).size).toBeLessThan(2_500_000);
      const buf = readFileSync(path);
      expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
      expect(buf.toString("latin1")).toContain(spec.mat);

      const doc = await io.read(path);
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      const sx = b.max[0] - b.min[0];
      const sy = b.max[1] - b.min[1];
      const sz = b.max[2] - b.min[2];
      const longest = Math.max(sx, sy, sz);
      expect(longest, id).toBeGreaterThan(spec.min);
      expect(longest, id).toBeLessThan(spec.max);
    }
  });

  it("orients nitro exhaust with pipe near Z=0 and flame streaming −Z", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    for (const file of ["nitro-orange.glb", "nitro-orange-b.glb", "nitro-cyan.glb", "nitro-cyan-b.glb"] as const) {
      const doc = await io.read(resolve("public/models/fx", file));
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      const sx = b.max[0] - b.min[0];
      const sy = b.max[1] - b.min[1];
      const sz = b.max[2] - b.min[2];
      expect(sz).toBeGreaterThan(sx);
      expect(sz).toBeGreaterThan(sy);
      expect(b.max[2]!).toBeLessThan(0.08);
      expect(b.min[2]!).toBeLessThan(-0.55);
    }
  });

  it("keeps nitro flame elongated as a jet (not a sphere-like blob)", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(resolve("public/models/fx/nitro-orange.glb"));
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    expect(sz / Math.max(sx, sy)).toBeGreaterThan(1.5);
    expect(sy / sx).toBeGreaterThan(0.9);
  });
});

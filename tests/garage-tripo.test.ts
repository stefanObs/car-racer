import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { GARAGE_PROP_IDS, GARAGE_PROPS } from "../src/data/garageProps";
import { GARAGE_PAD_CENTER } from "../src/render/garageBay";

const FILES = [
  { id: "cabinet", file: "cabinet.glb", minH: 1.7, maxH: 2.25, minBytes: 20_000 },
  { id: "workbench", file: "workbench.glb", minH: 0.85, maxH: 1.45, minBytes: 20_000 },
  { id: "tireStack", file: "tire-stack.glb", minH: 0.95, maxH: 1.45, minBytes: 15_000 },
  { id: "shelf", file: "shelf.glb", minH: 1.5, maxH: 2.15, minBytes: 20_000 },
  { id: "drums", file: "drums.glb", minH: 0.7, maxH: 1.15, minBytes: 12_000 },
] as const;

describe("garage Tripo workshop bake", () => {
  it("ships five BodyPaint GLBs with a glTF header", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    for (const spec of FILES) {
      const path = resolve("public/models/garage", spec.file);
      const bytes = statSync(path).size;
      expect(bytes, spec.file).toBeGreaterThan(spec.minBytes);
      const buf = readFileSync(path);
      expect(buf.subarray(0, 4).toString()).toBe("glTF");
      expect(buf.toString("latin1")).toContain("BodyPaint");

      const doc = await io.read(path);
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      const sy = b.max[1] - b.min[1];
      expect(b.min[1], spec.file).toBeCloseTo(0, 2);
      expect(sy, spec.file).toBeGreaterThan(spec.minH);
      expect(sy, spec.file).toBeLessThan(spec.maxH);
    }
  });

  it("places stock off the center pad", () => {
    expect(GARAGE_PROP_IDS).toHaveLength(5);
    const padHalfX = 11 / 2;
    const padHalfZ = 16 / 2;
    for (const id of GARAGE_PROP_IDS) {
      const p = GARAGE_PROPS[id].position;
      const dx = Math.abs(p.x - GARAGE_PAD_CENTER.x);
      const dz = Math.abs(p.z - GARAGE_PAD_CENTER.z);
      const outside = dx > padHalfX - 0.4 || dz > padHalfZ - 0.4;
      expect(outside, id).toBe(true);
    }
  });
});

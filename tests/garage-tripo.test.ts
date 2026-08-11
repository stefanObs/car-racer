import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { GARAGE_HERO, GARAGE_PROP_IDS, GARAGE_STOCK } from "../src/data/garageProps";
import { GARAGE_PAD_RADIUS, isOutsideGaragePad } from "../src/render/garageBay";

const FILES = [
  { id: "cabinet", file: "cabinet.glb", minH: 1.7, maxH: 2.25, minBytes: 20_000 },
  { id: "workbench", file: "workbench.glb", minH: 0.85, maxH: 1.45, minBytes: 20_000 },
  { id: "tireStack", file: "tire-stack.glb", minH: 0.95, maxH: 1.45, minBytes: 15_000 },
  { id: "shelf", file: "shelf.glb", minH: 1.5, maxH: 2.15, minBytes: 20_000 },
  { id: "drums", file: "drums.glb", minH: 0.7, maxH: 1.15, minBytes: 12_000 },
  { id: "toolchest", file: "toolchest.glb", minH: 0.95, maxH: 1.4, minBytes: 15_000 },
  { id: "gas", file: "gas.glb", minH: 1.1, maxH: 1.6, minBytes: 12_000 },
  { id: "hoist", file: "hoist.glb", minH: 2.0, maxH: 2.7, minBytes: 15_000 },
] as const;

describe("garage Tripo workshop bake", () => {
  it("ships BodyPaint GLBs with a glTF header", async () => {
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

  it("places stock and heroes outside the circular pad", () => {
    expect(GARAGE_PAD_RADIUS).toBe(4.5);
    expect(GARAGE_PROP_IDS).toHaveLength(8);
    expect(GARAGE_STOCK).toHaveLength(7);
    for (const place of [...GARAGE_STOCK, ...GARAGE_HERO]) {
      expect(isOutsideGaragePad(place.position.x, place.position.z), place.name).toBe(true);
    }
  });

  it("keeps workshop props in a tight ring near the pad (camera frustum)", () => {
    const cx = 1.5;
    const cz = 0;
    for (const place of [...GARAGE_STOCK, ...GARAGE_HERO]) {
      const r = Math.hypot(place.position.x - cx, place.position.z - cz);
      expect(r, place.name).toBeGreaterThan(GARAGE_PAD_RADIUS + 0.35);
      expect(r, place.name).toBeLessThan(7.5);
    }
  });
});
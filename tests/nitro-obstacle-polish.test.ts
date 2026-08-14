import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { CUP_LEVELS } from "../src/data/levels";
import { obstacleYaw } from "../src/render/levelObstacles";
import { SFX_URLS } from "../src/audio/catalog";

describe("nitro SFX + obstacle orientation polish", () => {
  it("ships a whoosh nitro sample (not the old spring ogg)", () => {
    expect(SFX_URLS.nitro).toBe("/audio/nitro.wav");
    const path = resolve("public/audio/nitro.wav");
    expect(existsSync(path)).toBe(true);
    const buf = readFileSync(path);
    expect(buf.subarray(0, 4).toString()).toBe("RIFF");
    expect(buf.byteLength).toBeGreaterThan(20_000);
    expect(existsSync(resolve("public/audio/nitro.ogg"))).toBe(false);
  });

  it("orients cup ribbon hazards with track heading", () => {
    const withHeading = CUP_LEVELS.flatMap((l) => l.obstacles).filter((o) => o.heading !== undefined);
    expect(withHeading.length).toBeGreaterThan(10);
    const ramps = CUP_LEVELS.flatMap((l) => l.obstacles).filter((o) => o.type === "ramp");
    expect(ramps.length).toBeGreaterThan(0);
    expect(ramps.every((o) => typeof o.heading === "number")).toBe(true);
  });

  it("yaws jersey barriers parallel to the ribbon", () => {
    expect(obstacleYaw("concrete_barrier", 0)).toBeCloseTo(Math.PI / 2);
    expect(obstacleYaw("ramp", 0.4)).toBeCloseTo(0.4);
  });

  it("bakes ramp so the high end faces +Z (climb with travel)", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(resolve("public/models/track/ramp.glb"));
    let maxNeg = -Infinity;
    let maxPos = -Infinity;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          if (v[2]! < 0) maxNeg = Math.max(maxNeg, v[1]!);
          if (v[2]! > 0) maxPos = Math.max(maxPos, v[1]!);
        }
      }
    }
    expect(maxPos).toBeGreaterThanOrEqual(maxNeg - 0.05);
  });
});

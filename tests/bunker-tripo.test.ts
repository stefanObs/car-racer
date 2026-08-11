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
});

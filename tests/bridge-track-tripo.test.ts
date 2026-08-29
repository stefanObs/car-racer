import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import {
  STRUCTURE_TRACK_PROP_IDS,
  TRACK_PROP_IDS,
  TRACK_PROPS,
} from "../src/data/trackModels";

describe("bridge Tripo kit (CONCEPT §4.4.1)", () => {
  it("ships baked bridge GLB that sits on y=0 with underpass height", async () => {
    expect(STRUCTURE_TRACK_PROP_IDS).toEqual(["bridge"]);
    const path = resolve("public/models/track/bridge.glb");
    expect(existsSync(path), path).toBe(true);
    expect(TRACK_PROPS.bridge.url).toBe("/models/track/bridge.glb");
    const buf = readFileSync(path);
    expect(buf.byteLength).toBeGreaterThan(40_000);
    expect(buf.subarray(0, 4).toString()).toBe("glTF");
    expect(buf.toString("latin1")).toContain("bridge");
    expect(statSync(path).size).toBe(buf.byteLength);

    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(path);
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    expect(b.min[1]).toBeCloseTo(0, 2);
    const height = b.max[1]! - b.min[1]!;
    const length = Math.max(b.max[0]! - b.min[0]!, b.max[2]! - b.min[2]!);
    const width = Math.min(b.max[0]! - b.min[0]!, b.max[2]! - b.min[2]!);
    // Wide overpass: full asphalt width + long gentle approaches (v2 bake).
    expect(height).toBeGreaterThan(4.5);
    expect(height).toBeLessThan(6.5);
    expect(length).toBeGreaterThan(36);
    expect(length).toBeLessThan(48);
    expect(width).toBeGreaterThan(12);
    expect(width).toBeLessThan(15);
  });

  it("includes bridge in the track preload list", () => {
    expect(TRACK_PROP_IDS).toContain("bridge");
    expect(TRACK_PROP_IDS.length).toBe(22);
  });
});

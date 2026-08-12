import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { BLITZ_PART_MESH_IDS, BLITZ_PART_PLACEMENT } from "../src/render/carParts";

const MATERIALS: Record<(typeof BLITZ_PART_MESH_IDS)[number], string> = {
  rear_spoiler: "Spoiler",
  big_engine: "Carbon",
  nitro_kit: "NitroKit",
  spike_bumper: "Spike",
  offroad_suspension: "Spring",
  reinforced_frame: "Grey",
  lightweight_body: "Carbon",
};

describe("Blitz Tripo part add-on bakes", () => {
  it.each([...BLITZ_PART_MESH_IDS])("ships a small %s GLB with authored material", async (id) => {
    const path = resolve("public/models/parts", `blitz-${id}.glb`);
    expect(existsSync(path), path).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(8_000);
    expect(statSync(path).size).toBeLessThan(2_000_000);
    const text = readFileSync(path).toString("latin1");
    expect(text).toContain(MATERIALS[id]);

    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    expect(Math.max(sx, sy, sz)).toBeLessThan(2.2);
    expect(sy).toBeGreaterThan(0.04);
    expect(sy).toBeLessThan(1.1);
    expect(BLITZ_PART_PLACEMENT[id].length).toBeGreaterThan(0);
  });
});

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { GARAGE_SHELL_ALBEDO, clearGarageTextureCache, floorTexture, turntableTexture, wallPanelTexture } from "../src/render/garageTextures";
import { GARAGE_SHELL_IDS } from "../src/render/loadGarageGltf";

describe("garage shell Tripo textures + meshes", () => {
  beforeEach(() => clearGarageTextureCache());

  it("ships albedo PNGs for floor, wall, and turntable", () => {
    for (const url of Object.values(GARAGE_SHELL_ALBEDO)) {
      const path = resolve("public" + url);
      expect(existsSync(path), path).toBe(true);
      const bytes = statSync(path).size;
      expect(bytes, path).toBeGreaterThan(80_000);
      const buf = readFileSync(path);
      expect(buf[0]).toBe(0x89);
      expect(buf.subarray(1, 4).toString()).toBe("PNG");
    }
  });

  it("ships Tripo shell GLBs that sit on y=0", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    for (const id of GARAGE_SHELL_IDS) {
      const path = resolve("public/models/garage", `${id}.glb`);
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(40_000);
      const buf = readFileSync(path);
      expect(buf.subarray(0, 4).toString()).toBe("glTF");
      const doc = await io.read(path);
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      expect(b.min[1], id).toBeCloseTo(0, 2);
      expect(b.max[1]! - b.min[1]!, id).toBeGreaterThan(0.05);
    }
  });

  it("falls back to canvas textures when shell maps are not preloaded", () => {
    expect(floorTexture()).toBeTruthy();
    expect(wallPanelTexture(1)).toBeTruthy();
    expect(turntableTexture()).toBeTruthy();
  });
});

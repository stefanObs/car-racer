import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import {
  OBSTACLE_PROP_BY_TYPE,
  OBSTACLE_TRACK_PROP_IDS,
  TRACK_PROP_IDS,
  TRACK_PROPS,
} from "../src/data/trackModels";
import { buildLevelObstacles } from "../src/render/levelObstacles";
import { CUP_LEVELS } from "../src/data/levels";

describe("on-track obstacle Tripo kit", () => {
  it("ships baked obstacle GLBs that sit on y=0", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    for (const id of OBSTACLE_TRACK_PROP_IDS) {
      const path = resolve("public/models/track", `${id}.glb`);
      expect(existsSync(path), path).toBe(true);
      expect(TRACK_PROPS[id].url).toBe(`/models/track/${id}.glb`);
      const buf = readFileSync(path);
      expect(buf.byteLength, id).toBeGreaterThan(40_000);
      expect(buf.subarray(0, 4).toString()).toBe("glTF");
      expect(buf.toString("latin1")).toContain(id);

      const doc = await io.read(path);
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      expect(b.min[1], id).toBeCloseTo(0, 2);
      expect(b.max[1]! - b.min[1]!, id).toBeGreaterThan(0.02);
      expect(b.max[1]! - b.min[1]!, id).toBeLessThan(1.6);
    }
    expect(OBSTACLE_TRACK_PROP_IDS.length).toBe(5);
    expect(
      new Set(OBSTACLE_TRACK_PROP_IDS.map((id) => statSync(resolve("public/models/track", `${id}.glb`)).size)).size,
    ).toBe(5);
  });

  it("maps every obstacle type onto a kit id", () => {
    expect(OBSTACLE_PROP_BY_TYPE.ramp.id).toBe("ramp");
    expect(OBSTACLE_PROP_BY_TYPE.uneven.id).toBe("rumble");
    expect(OBSTACLE_PROP_BY_TYPE.oil.id).toBe("oil");
    expect(OBSTACLE_PROP_BY_TYPE.tire_stack.id).toBe("tire-stack");
    expect(OBSTACLE_PROP_BY_TYPE.concrete_barrier.id).toBe("barrier");
  });

  it("keeps passable hazards low and solids tall after bake", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const height = async (id: string) => {
      const doc = await io.read(resolve("public/models/track", `${id}.glb`));
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      return b.max[1]! - b.min[1]!;
    };
    expect(await height("oil")).toBeLessThan(0.35);
    expect(await height("rumble")).toBeLessThan(0.55);
    expect(await height("ramp")).toBeLessThan(1.25);
    expect(await height("barrier")).toBeGreaterThan(0.9);
    expect(await height("tire-stack")).toBeGreaterThan(1.0);
  });

  it("includes obstacle kit in the full track preload list", () => {
    expect(TRACK_PROP_IDS.length).toBe(21);
    for (const id of OBSTACLE_TRACK_PROP_IDS) {
      expect(TRACK_PROP_IDS).toContain(id);
    }
  });

  it("builds cup obstacle groups without throwing (procedural fallback in tests)", () => {
    for (const level of CUP_LEVELS) {
      const g = buildLevelObstacles(level);
      expect(g.children.length, level.id).toBe(level.obstacles.length);
    }
  });
});

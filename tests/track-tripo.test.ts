import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import {
  OPTIONAL_TRACK_PROP_IDS,
  REQUIRED_TRACK_PROP_IDS,
  TRACK_PROPS,
} from "../src/data/trackModels";
import { CUP_LEVELS } from "../src/data/levels";
import { planSceneryAnchors, sceneryOverlapsTrack } from "../src/render/themeScenery";
import { planWallPlacements } from "../src/render/trackKit";
import { buildTrackFromLevel, sampleCenterline } from "../src/track/buildTrack";

describe("track kit + wall kinds", () => {
  it("keeps tire walls in corners and concrete on straights (Hafenstart)", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const midStraight = sampleCenterline(track, 25);
    expect(midStraight.wall).toBe("concrete");
    const midCurve = sampleCenterline(track, 55 + 16);
    expect(midCurve.wall).toBe("tire");
  });

  it("tiles wall modules with matching wallKind and both sides off the asphalt", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const places = planWallPlacements(track);
    expect(places.some((p) => p.kind === "tire")).toBe(true);
    expect(places.some((p) => p.kind === "concrete")).toBe(true);
    expect(places.some((p) => p.side === 1)).toBe(true);
    expect(places.some((p) => p.side === -1)).toBe(true);
    const wallOff = track.asphaltHalfWidth + track.grassWidth + 0.65;
    for (const p of places) {
      const s = sampleCenterline(track, p.along);
      expect(s.wall).toBe(p.kind);
      const dist = Math.hypot(p.x - s.position.x, p.z - s.position.z);
      // May push farther than wallOff on tight loops so modules stay off asphalt.
      expect(dist).toBeGreaterThanOrEqual(wallOff - 0.01);
    }
  });

  it("keeps harbor scenery off the racing surface", () => {
    const level = CUP_LEVELS[0]!;
    const track = buildTrackFromLevel(level);
    const anchors = planSceneryAnchors(track, level.theme);
    const onTrack = anchors.filter((a) => sceneryOverlapsTrack(track, a.x, a.z, a.radius));
    expect(onTrack).toEqual([]);
  });

  it("ships baked track kit GLBs", async () => {
    const sizes = new Set<number>();
    for (const id of REQUIRED_TRACK_PROP_IDS) {
      const path = resolve("public/models/track", `${id}.glb`);
      expect(existsSync(path), path).toBe(true);
      const bytes = statSync(path).size;
      expect(bytes).toBeGreaterThan(40_000);
      sizes.add(bytes);
      expect(TRACK_PROPS[id].url).toBe(`/models/track/${id}.glb`);
      expect(readFileSync(path).toString("latin1")).toContain(id);
    }
    expect(sizes.size).toBe(REQUIRED_TRACK_PROP_IDS.length);

    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const tire = await io.read(resolve("public/models/track/tire-wall.glb"));
    const tb = getBounds(tire.getRoot().listScenes()[0]!);
    expect(tb.max[1]! - tb.min[1]!).toBeGreaterThan(0.9);
    expect(tb.max[1]! - tb.min[1]!).toBeLessThan(1.5);

    const wall = await io.read(resolve("public/models/track/concrete-wall.glb"));
    const wb = getBounds(wall.getRoot().listScenes()[0]!);
    expect(wb.max[1]! - wb.min[1]!).toBeGreaterThan(1.3);
    expect(wb.max[1]! - wb.min[1]!).toBeLessThan(1.8);

    const crane = await io.read(resolve("public/models/track/crane.glb"));
    const cb = getBounds(crane.getRoot().listScenes()[0]!);
    expect(cb.max[1]! - cb.min[1]!).toBeGreaterThan(12);
  });

  it("ships BodyPaint harbor container and tank GLBs that sit on y=0", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    for (const id of OPTIONAL_TRACK_PROP_IDS) {
      const path = resolve("public/models/track", `${id}.glb`);
      expect(existsSync(path), path).toBe(true);
      expect(TRACK_PROPS[id].url).toBe(`/models/track/${id}.glb`);
      const buf = readFileSync(path);
      expect(buf.byteLength, id).toBeGreaterThan(40_000);
      expect(buf.subarray(0, 4).toString()).toBe("glTF");
      expect(buf.toString("latin1")).toContain("BodyPaint");

      const doc = await io.read(path);
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      const sx = b.max[0]! - b.min[0]!;
      const sy = b.max[1]! - b.min[1]!;
      const sz = b.max[2]! - b.min[2]!;
      expect(b.min[1], id).toBeCloseTo(0, 2);
      if (id === "container") {
        expect(sy).toBeGreaterThan(2.2);
        expect(sy).toBeLessThan(2.9);
        expect(Math.max(sx, sz)).toBeGreaterThan(4.5);
        expect(Math.min(sx, sz)).toBeGreaterThan(2);
        expect(Math.min(sx, sz)).toBeLessThan(3.2);
      } else {
        expect(sy).toBeGreaterThan(7);
        expect(sy).toBeLessThan(8.6);
        expect(sx).toBeGreaterThan(5);
        expect(sz).toBeGreaterThan(5);
      }
    }
  });
});

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { REQUIRED_TRACK_PROP_IDS, TRACK_PROPS } from "../src/data/trackModels";
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
      expect(dist).toBeCloseTo(wallOff, 5);
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
});

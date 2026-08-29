import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { resolve } from "node:path";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel, sampleCenterline } from "../src/track/buildTrack";
import { BRIDGE_DECK_Y_M } from "../src/track/bridgeElevation";
import { TRACK_PROPS } from "../src/data/trackModels";

/**
 * RCA locks for Brückenkreuz bridge feel:
 * - Mesh deck at least as wide as asphalt
 * - Prop centered on the plan-view crossing (origin)
 * - Elevation climb is long/smooth (not a sharp edge)
 */
describe("bridge overpass alignment (RCA)", () => {
  const level = CUP_LEVELS.find((l) => l.id === "blitz_cup_06_brueckenkreuz")!;

  it("ships a bridge GLB at least as wide as the cup asphalt", async () => {
    const track = buildTrackFromLevel(level);
    const asphaltW = track.asphaltHalfWidth * 2;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(resolve("public/models/track/bridge.glb"));
    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const width = Math.min(b.max[0]! - b.min[0]!, b.max[2]! - b.min[2]!);
    const length = Math.max(b.max[0]! - b.min[0]!, b.max[2]! - b.min[2]!);
    const height = b.max[1]! - b.min[1]!;
    // After scale in TRACK_PROPS, effective width must cover asphalt.
    const scale = TRACK_PROPS.bridge.scale;
    expect(width * scale).toBeGreaterThanOrEqual(asphaltW - 0.25);
    expect(length * scale).toBeGreaterThan(30);
    expect(height * scale).toBeGreaterThan(3.5);
  });

  it("places the Tripo bridge on the plan-view crossing, not an offset ramp sample", () => {
    const place = level.sceneryPlacements?.find((p) => p.kind === "bridge");
    expect(place).toBeTruthy();
    expect(Math.hypot(place!.x, place!.z)).toBeLessThan(2.5);
  });

  it("uses a long smooth climb onto the deck (no sharp edge)", () => {
    const track = buildTrackFromLevel(level);
    let peakD = 0;
    let peakY = 0;
    for (let d = 0; d < track.totalLength; d += 0.5) {
      const y = sampleCenterline(track, d).y;
      if (y > peakY) {
        peakY = y;
        peakD = d;
      }
    }
    expect(peakY).toBeGreaterThanOrEqual(BRIDGE_DECK_Y_M - 0.15);

    // Sample mid-ramp: slope dy/ds should stay gentle (< ~12% average over 8 m).
    const mid = peakD - 20;
    const a = sampleCenterline(track, mid);
    const b = sampleCenterline(track, mid + 8);
    const slope = Math.abs(b.y - a.y) / 8;
    expect(slope).toBeLessThan(0.15);

    // Near the top of the climb, curvature of y should ease (smoothstep), not a kink.
    const y0 = sampleCenterline(track, peakD - 30).y;
    const y1 = sampleCenterline(track, peakD - 15).y;
    const y2 = sampleCenterline(track, peakD).y;
    expect(y1).toBeGreaterThan(y0);
    expect(y2).toBeGreaterThan(y1);
    // Second half of climb gains less than first half (ease-out).
    expect(y2 - y1).toBeLessThanOrEqual(y1 - y0 + 0.05);
  });
});

import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { resolve } from "node:path";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel, sampleCenterline } from "../src/track/buildTrack";
import {
  BRIDGE_DECK_HALF_M,
  BRIDGE_DECK_Y_M,
  BRIDGE_MESH_ROAD_Y_M,
  BRIDGE_RAMP_M,
  elevationAt,
  surfacePitchAt,
} from "../src/track/bridgeElevation";
import { TRACK_PROPS } from "../src/data/trackModels";
import { buildSmoothTrack } from "../src/render/trackMesh";
import { createCarState, stepCar } from "../src/sim/vehicle";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";

/**
 * RCA locks for Brückenkreuz bridge feel:
 * - Mesh deck at least as wide as asphalt
 * - Prop centered on the plan-view crossing (origin)
 * - Drive height sits above Tripo road so the whole car is on the deck, not in the slab
 * - Elevated comic asphalt follows surfaceY under the wheels
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

  it("drives above the Tripo road so wheels sit on the deck (not through the slab)", async () => {
    // RCA: physics inside the Tripo volume (road/rails ~3.5–5.0) buried cars in the mesh.
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(resolve("public/models/track/bridge.glb"));
    const roadYs: number[] = [];
    let meshMaxY = -Infinity;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = [0, 0, 0];
          pos.getElement(i, v);
          meshMaxY = Math.max(meshMaxY, v[1]!);
          if (Math.abs(v[0]!) < 5.5 && Math.abs(v[2]!) < 10 && v[1]! > 3.4 && v[1]! < 4.2) {
            roadYs.push(v[1]!);
          }
        }
      }
    }
    roadYs.sort((a, b) => a - b);
    expect(roadYs.length).toBeGreaterThan(50);
    const roadMax = roadYs[roadYs.length - 1]!;
    expect(BRIDGE_MESH_ROAD_Y_M).toBeLessThanOrEqual(roadMax + 0.05);
    // Drive plane clears the whole Tripo prop (rails/arch), not just the road slab.
    expect(BRIDGE_DECK_Y_M).toBeGreaterThan(meshMaxY - 0.2);

    const track = buildTrackFromLevel(level);
    expect(Math.max(...track.elevation)).toBeGreaterThanOrEqual(BRIDGE_DECK_Y_M - 0.05);

    let peakAlong = 0;
    let peakY = 0;
    for (let d = 0; d < track.totalLength; d += 0.5) {
      const y = sampleCenterline(track, d).y;
      if (y > peakY) {
        peakY = y;
        peakAlong = d;
      }
    }
    const s = sampleCenterline(track, peakAlong);
    const car = createCarState({
      id: "deck",
      isPlayer: true,
      x: s.position.x,
      z: s.position.z,
      y: s.y,
      surfaceY: s.y,
      heading: Math.atan2(s.tangent.z, s.tangent.x),
      speed: 20,
      distanceAlong: peakAlong,
      progress: peakAlong,
      paint: "#e03131",
      sticker: "none",
      stats: mergeStats(CARS.blitz.stats, []),
    });
    stepCar(
      car,
      { throttle: 0.4, brake: 0, steer: 0, nitro: false, drift: false },
      track,
      1 / 60,
      { accel: 1, topSpeed: 1 },
      [],
    );
    expect(car.surfaceY).toBeGreaterThan(meshMaxY - 0.25);
    expect(car.y).toBeGreaterThan(meshMaxY - 0.25);
    expect(Math.abs(car.y - car.surfaceY)).toBeLessThan(0.12);
  });

  it("lays elevated comic asphalt under the overpass wheels", () => {
    const track = buildTrackFromLevel(level);
    const root = buildSmoothTrack(track);
    root.updateMatrixWorld(true);
    const mesh = root.getObjectByName("trackAsphalt");
    expect(mesh).toBeTruthy();
    const b = new Box3().setFromObject(mesh!);
    expect(b.max.y).toBeGreaterThan(BRIDGE_DECK_Y_M - 0.2);
    expect(b.max.y).toBeLessThan(BRIDGE_DECK_Y_M + 0.5);
  });

  it("uses a smoothstep climb onto the deck (no sharp kink)", () => {
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

    // Mid-ramp slope stays driveable (smoothstep over BRIDGE_RAMP_M).
    const mid = peakD - (BRIDGE_DECK_HALF_M + BRIDGE_RAMP_M * 0.5);
    const a = sampleCenterline(track, mid);
    const b = sampleCenterline(track, mid + 8);
    const slope = Math.abs(b.y - a.y) / 8;
    expect(slope).toBeLessThan(0.22);

    // Near the top of the climb, curvature of y should ease (smoothstep), not a kink.
    const y0 = sampleCenterline(track, peakD - 30).y;
    const y1 = sampleCenterline(track, peakD - 15).y;
    const y2 = sampleCenterline(track, peakD).y;
    expect(y1).toBeGreaterThan(y0);
    expect(y2).toBeGreaterThan(y1);
    // Second half of climb gains less than first half (ease-out into flat deck).
    expect(y2 - y1).toBeLessThanOrEqual(y1 - y0 + 0.05);
  });

  it("pitches grounded cars to follow the ramp so wheels sit on the deck", () => {
    const track = buildTrackFromLevel(level);
    let climbAlong = 0;
    for (let d = 0; d < track.totalLength; d += 0.5) {
      const y = elevationAt(track, d);
      if (y > 1.0 && y < BRIDGE_DECK_Y_M - 0.4) {
        climbAlong = d;
        break;
      }
    }
    expect(climbAlong).toBeGreaterThan(0);
    const pitch = surfacePitchAt(track, climbAlong);
    expect(Math.abs(pitch)).toBeGreaterThan(0.08);
    expect(Math.abs(pitch)).toBeLessThan(0.55);
    expect(surfacePitchAt(track, 0)).toBeCloseTo(0, 2);
  });
});

/**
 * Audit: cup tracks are driveable closed laps; walls/obstacles leave the racing surface usable.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { CUP_LEVELS } from "../src/data/levels";
import { TRACK_PROPS } from "../src/data/trackModels";
import { planWallPlacements } from "../src/render/trackKit";
import { RaceSession } from "../src/sim/race";
import { buildTrackFromLevel, nearestOnTrack, sampleCenterline } from "../src/track/buildTrack";
import { loopSeamKinkDegrees, trackSelfIntersects } from "../src/track/validateTrack";

describe("cup lap driveability + road clearance", () => {
  it("every cup is a closed non-crossing loop with a small seam gap", () => {
    for (const level of CUP_LEVELS) {
      expect(level.track.closedLoop, level.id).toBe(true);
      expect(level.laps, level.id).toBe(5);
      const track = buildTrackFromLevel(level);
      expect(trackSelfIntersects(track), level.id).toBe(false);
      expect(track.totalLength, level.id).toBeGreaterThan(700);
      const a = track.centerline[0]!;
      const b = track.centerline[track.centerline.length - 1]!;
      const gap = Math.hypot(a.x - b.x, a.z - b.z);
      expect(gap, `${level.id} loop gap`).toBeLessThan(4);
    }
  });

  it("keeps start/finish on the racing line (no U-turn kink at the seam)", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const kink = loopSeamKinkDegrees(track);
      expect(kink, `${level.id} seam kink ${kink.toFixed(1)}°`).toBeLessThan(25);
    }
  });

  it("driving one full circuit advances progress by ~track length and awards exactly one lap", { timeout: 20_000 }, () => {
    for (const level of CUP_LEVELS) {
      const race = new RaceSession({
        level,
        playerCarId: "blitz",
        playerParts: [],
        playerPaint: "#e03131",
        playerSticker: "none",
      });
      race.clearStartCountdown();
      const player = race.player();
      const startProgress = player.progress;
      const startLap = player.lap;
      const len = race.track.totalLength;

      let steps = 0;
      const maxSteps = Math.ceil((len / 7) * 60) + 3000;
      while (player.lap <= startLap && steps < maxSteps) {
        const along = ((player.progress % len) + len) % len;
        const look = sampleCenterline(race.track, along + 16);
        const toX = look.position.x - player.x;
        const toZ = look.position.z - player.z;
        const want = Math.atan2(toZ, toX);
        let err = want - player.heading;
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, err * 1.7));
        race.step(1 / 60, { throttle: 1, brake: 0, steer, nitro: false, drift: false });
        steps += 1;
      }

      expect(steps, `${level.id} never completed a lap`).toBeLessThan(maxSteps);
      expect(player.lap, level.id).toBe(startLap + 1);
      const gained = player.progress - startProgress;
      expect(gained, `${level.id} progress gain`).toBeGreaterThan(len * 0.85);
      expect(gained, `${level.id} progress gain`).toBeLessThan(len * 1.25);
    }
  });

  it("outer wall module footprints stay outside the asphalt half-width (no road blocking)", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const tireDoc = await io.read(resolve("public/models/track/tire-wall.glb"));
    const concDoc = await io.read(resolve("public/models/track/concrete-wall.glb"));
    const tireB = getBounds(tireDoc.getRoot().listScenes()[0]!);
    const concB = getBounds(concDoc.getRoot().listScenes()[0]!);
    const tireIn = Math.max(Math.abs(tireB.min[2]!), Math.abs(tireB.max[2]!)) * TRACK_PROPS["tire-wall"].scale;
    const concIn = Math.max(Math.abs(concB.min[2]!), Math.abs(concB.max[2]!)) * TRACK_PROPS["concrete-wall"].scale;

    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      for (const p of planWallPlacements(track)) {
        const near = nearestOnTrack(track, { x: p.x, z: p.z });
        const inward = p.kind === "tire" ? tireIn : concIn;
        const faceLat = Math.abs(near.lateral) - inward;
        expect(
          faceLat,
          `${level.id} ${p.kind} face on asphalt lat=${near.lateral} inward=${inward}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("passable hazards sit on asphalt; solid blockers do not sit on the racing corridor", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      for (const o of level.obstacles) {
        const near = nearestOnTrack(track, { x: o.position[0]!, z: o.position[1]! });
        if (o.type === "ramp" || o.type === "uneven" || o.type === "oil") {
          expect(Math.abs(near.lateral), `${level.id} ${o.type}`).toBeLessThan(
            track.asphaltHalfWidth + 1.5,
          );
          continue;
        }
        if (o.type === "tire_stack" || o.type === "concrete_barrier") {
          if (o.role === "median") {
            expect(Math.abs(near.lateral), `${level.id} median`).toBeGreaterThanOrEqual(
              track.asphaltHalfWidth * 0.45,
            );
          } else {
            expect(Math.abs(near.lateral), `${level.id} solid`).toBeGreaterThanOrEqual(
              track.asphaltHalfWidth + 0.35,
            );
          }
        }
      }
    }
  });

  it("asphalt ribbon uses Asphalt-Comic flat materials (no missing texture crash path)", () => {
    const src = readFileSync("src/render/trackMesh.ts", "utf8");
    expect(src).toContain('name = "trackAsphalt"');
    expect(src).toContain('name = "trackGrass"');
    expect(src).toContain("ComicPalette.asphalt");
    expect(src).toContain("ComicPalette.grass");
  });
});

import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { buildSmoothTrack } from "../src/render/trackMesh";

describe("track ribbon bounds", () => {
  it(
    "keeps grass/asphalt ribbons flat (no Frenet-twist walls)",
    () => {
      // RCA: ExtrudeGeometry + closed CatmullRom flipped frames → ~19 m tall green/gray walls.
      for (const level of CUP_LEVELS) {
        const track = buildTrackFromLevel(level);
        const root = buildSmoothTrack(track);
        root.updateMatrixWorld(true);
        for (const name of ["trackGrass", "trackAsphalt"] as const) {
          const mesh = root.getObjectByName(name);
          expect(mesh, `${level.id} ${name}`).toBeTruthy();
          const b = new Box3().setFromObject(mesh!);
          const s = new Vector3();
          b.getSize(s);
          expect(s.y, `${level.id} ${name} height`).toBeLessThan(1.5);
          expect(Math.max(s.x, s.z), `${level.id} ${name} span`).toBeGreaterThan(20);
        }
      }
    },
    40_000,
  );
});

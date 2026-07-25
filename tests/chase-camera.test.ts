import { describe, expect, it } from "vitest";
import { chaseBasis, edgePoint, projectWorldPoint } from "../src/render/chaseCamera";
import { ComicPalette } from "../src/render/palette";

describe("Asphalt-Comic chase camera", () => {
  it("projects points ahead of the car onto screen space", () => {
    const pose = { x: 0, z: 0, heading: 0 };
    const cam = {
      back: 7,
      height: 3.5,
      focal: 400,
      horizonY: 200,
      centerX: 400,
      near: 1,
    };
    // Point straight ahead on road
    const ahead = projectWorldPoint(20, 0, 0, pose, cam);
    expect(ahead).not.toBeNull();
    expect(ahead!.sx).toBeCloseTo(400, 0);
    expect(ahead!.sy).toBeGreaterThan(cam.horizonY);
    expect(ahead!.depth).toBeGreaterThan(cam.near);

    // Point well behind camera should cull
    const behind = projectWorldPoint(-30, 0, 0, pose, cam);
    expect(behind).toBeNull();
  });

  it("builds right-handed chase basis from heading", () => {
    const b = chaseBasis(0);
    expect(b.fwdX).toBeCloseTo(1);
    expect(b.rightZ).toBeCloseTo(1);
    const edge = edgePoint(0, 0, 1, 0, 5);
    expect(edge.z).toBeCloseTo(5);
  });

  it("keeps concept track palette hexes", () => {
    expect(ComicPalette.asphalt).toBe(0x4a4f57);
    expect(ComicPalette.grass).toBe(0x3f8f3a);
    expect(ComicPalette.tireAccent).toBe(0xe85d04);
  });
});

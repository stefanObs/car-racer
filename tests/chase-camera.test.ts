import { describe, expect, it } from "vitest";
import {
  CHASE_HEIGHT_ABOVE_CAR_M,
  chaseCameraPose,
} from "../src/render/chaseCamera";
import { BRIDGE_DECK_Y_M } from "../src/track/bridgeElevation";

describe("chase camera (bridge deck RCA)", () => {
  it("stays above the car on flat ground", () => {
    const pose = chaseCameraPose({ x: 0, y: 0, z: 0, heading: 0 });
    expect(pose.camY).toBeCloseTo(CHASE_HEIGHT_ABOVE_CAR_M, 5);
    expect(pose.lookY).toBeGreaterThan(0);
    expect(pose.camY).toBeGreaterThan(pose.lookY);
  });

  it("rises with the Brückenkreuz deck so the car stays in frame", () => {
    // RCA: old formula capped camY at ~5.55 while deck cars sat at ~5.6 → camera
    // level with / below the car, looking down through the asphalt — Blitz invisible.
    const pose = chaseCameraPose({
      x: 0,
      y: BRIDGE_DECK_Y_M,
      z: 0,
      heading: Math.PI / 4,
    });
    expect(pose.camY).toBeGreaterThan(BRIDGE_DECK_Y_M + 2.5);
    expect(pose.lookY).toBeGreaterThan(BRIDGE_DECK_Y_M);
    expect(pose.camY).toBeGreaterThan(pose.lookY + 1.5);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyGarageDragYaw,
  garageDisplayYaw,
  GARAGE_ORBIT_SENSITIVITY,
  GARAGE_YAW_DEFAULT,
} from "../src/ui/garageOrbit";

describe("garage orbit yaw", () => {
  it("starts from a 3/4-front default", () => {
    expect(GARAGE_YAW_DEFAULT).toBeCloseTo(0.42, 2);
  });

  it("drag right decreases yaw (turntable)", () => {
    const next = applyGarageDragYaw(0, 100);
    expect(next).toBeCloseTo(-100 * GARAGE_ORBIT_SENSITIVITY, 5);
    expect(next).toBeLessThan(0);
  });

  it("drag left increases yaw", () => {
    expect(applyGarageDragYaw(1, -40)).toBeGreaterThan(1);
  });

  it("suppresses idle sway while dragging", () => {
    const base = 0.5;
    expect(garageDisplayYaw(base, 10, true)).toBe(base);
    expect(garageDisplayYaw(base, 10, false)).not.toBe(base);
  });
});

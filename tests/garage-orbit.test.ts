import { describe, expect, it } from "vitest";
import {
  applyGarageDragOrbit,
  applyGarageDragPitch,
  applyGarageDragYaw,
  garageDisplayYaw,
  GARAGE_ORBIT_SENSITIVITY,
  GARAGE_PITCH_LIMIT,
  GARAGE_YAW_DEFAULT,
} from "../src/ui/garageOrbit";

describe("garage orbit yaw + pitch", () => {
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

  it("drag down increases pitch", () => {
    const next = applyGarageDragPitch(0, 80);
    expect(next).toBeCloseTo(80 * GARAGE_ORBIT_SENSITIVITY, 5);
    expect(next).toBeGreaterThan(0);
  });

  it("drag up decreases pitch", () => {
    expect(applyGarageDragPitch(0.2, -40)).toBeLessThan(0.2);
  });

  it("clamps pitch so the car can flip but not spin past ±π", () => {
    expect(applyGarageDragPitch(GARAGE_PITCH_LIMIT, 500)).toBe(GARAGE_PITCH_LIMIT);
    expect(applyGarageDragPitch(-GARAGE_PITCH_LIMIT, -500)).toBe(-GARAGE_PITCH_LIMIT);
  });

  it("applies both axes from one drag", () => {
    const next = applyGarageDragOrbit(0.4, 0.1, 50, -30);
    expect(next.yaw).toBeCloseTo(applyGarageDragYaw(0.4, 50), 5);
    expect(next.pitch).toBeCloseTo(applyGarageDragPitch(0.1, -30), 5);
  });

  it("suppresses idle sway while dragging", () => {
    const base = 0.5;
    expect(garageDisplayYaw(base, 10, true)).toBe(base);
    expect(garageDisplayYaw(base, 10, false)).not.toBe(base);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyGarageDragOrbit,
  applyGarageDragPitch,
  applyGarageDragYaw,
  garageDisplayYaw,
  garageOrbitAxesForPointer,
  garagePitchFloorClearance,
  garagePitchHoverY,
  GARAGE_ORBIT_SENSITIVITY,
  GARAGE_PITCH_DEFAULT,
  GARAGE_PITCH_INSPECT_LIFT,
  GARAGE_PITCH_LIMIT,
  GARAGE_YAW_DEFAULT,
} from "../src/ui/garageOrbit";

describe("garage orbit yaw + pitch", () => {
  it("starts from a 3/4-front default", () => {
    expect(GARAGE_YAW_DEFAULT).toBeCloseTo(0.42, 2);
  });

  it("maps LMB to yaw-only and RMB to free tumble", () => {
    expect(garageOrbitAxesForPointer(0, "mouse")).toEqual({ yaw: true, pitch: false });
    expect(garageOrbitAxesForPointer(2, "mouse")).toEqual({ yaw: true, pitch: true });
    expect(garageOrbitAxesForPointer(1, "mouse")).toEqual({ yaw: false, pitch: false });
  });

  it("uses 1-finger yaw and 2-finger free tumble on touch/pen", () => {
    expect(garageOrbitAxesForPointer(0, "touch", 1)).toEqual({ yaw: true, pitch: false });
    expect(garageOrbitAxesForPointer(0, "touch", 2)).toEqual({ yaw: true, pitch: true });
    expect(garageOrbitAxesForPointer(0, "pen", 2)).toEqual({ yaw: true, pitch: true });
  });

  it("lifts the car off the pad as pitch increases (and when inverted)", () => {
    expect(garagePitchFloorClearance(0, 1.5, 0.6)).toBeCloseTo(0, 5);
    expect(garagePitchFloorClearance(Math.PI / 2, 1.5, 0.6)).toBeGreaterThan(1.4);
    expect(garagePitchFloorClearance(Math.PI, 1.5, 0.6)).toBeCloseTo(1.2, 5);
    expect(garagePitchHoverY(0, 1.5, 0.6, true)).toBeCloseTo(GARAGE_PITCH_INSPECT_LIFT, 5);
    expect(garagePitchHoverY(0, 1.5, 0.6, false)).toBeCloseTo(0, 5);
  });

  it("documents pitch default as flat (inspect release snaps here)", () => {
    expect(GARAGE_PITCH_DEFAULT).toBe(0);
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

  it("applies both axes from one drag by default", () => {
    const next = applyGarageDragOrbit(0.4, 0.1, 50, -30);
    expect(next.yaw).toBeCloseTo(applyGarageDragYaw(0.4, 50), 5);
    expect(next.pitch).toBeCloseTo(applyGarageDragPitch(0.1, -30), 5);
  });

  it("respects yaw-only axis mask", () => {
    const yawOnly = applyGarageDragOrbit(0.4, 0.1, 50, 80, { yaw: true, pitch: false });
    expect(yawOnly.yaw).toBeCloseTo(applyGarageDragYaw(0.4, 50), 5);
    expect(yawOnly.pitch).toBe(0.1);
  });

  it("suppresses idle sway while dragging", () => {
    const base = 0.5;
    expect(garageDisplayYaw(base, 10, true)).toBe(base);
    expect(garageDisplayYaw(base, 10, false)).not.toBe(base);
  });
});

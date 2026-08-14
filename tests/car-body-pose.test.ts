import { describe, expect, it } from "vitest";
import { bodyBaseLean, bodyRollZ, MAX_BODY_ROLL } from "../src/render/carBodyPose";

describe("car body roll (steered-wheel era)", () => {
  it("keeps drift bank mild so steered tires stay readable", () => {
    const roll = bodyRollZ({
      drift: 0.9,
      slip: 0.6,
      baseLean: 0.2,
      wobble: 1,
    });
    expect(Math.abs(roll)).toBeLessThanOrEqual(MAX_BODY_ROLL + 1e-9);
    expect(Math.abs(roll)).toBeLessThan(0.25);
  });

  it("does not slam to the old ±0.42 kart lean", () => {
    expect(MAX_BODY_ROLL).toBeLessThan(0.25);
    const roll = bodyRollZ({ drift: 1, slip: Math.PI / 2, baseLean: 1, wobble: 1 });
    expect(Math.abs(roll)).toBeCloseTo(MAX_BODY_ROLL);
  });

  it("uses light wobble when not drifting hard", () => {
    const a = bodyRollZ({ drift: 0, slip: 0, baseLean: 0.1, wobble: 1 });
    const b = bodyRollZ({ drift: 0, slip: 0, baseLean: 0.1, wobble: -1 });
    expect(a).toBeCloseTo(0.1);
    expect(b).toBeCloseTo(-0.1);
  });

  it("skips bump lean while airborne", () => {
    expect(bodyBaseLean(1, true, 1)).toBe(0);
    expect(bodyBaseLean(2, false, 1)).toBeGreaterThan(0.05);
  });
});

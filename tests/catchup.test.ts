import { describe, expect, it } from "vitest";
import { catchUpMultipliers } from "../src/sim/catchup";

describe("catch-up multipliers (CONCEPT §4.7)", () => {
  it("gives the leader no boost", () => {
    expect(catchUpMultipliers(1, 6)).toEqual({ accel: 1, topSpeed: 1 });
  });

  it("scales boost with how far back the car is", () => {
    const second = catchUpMultipliers(2, 6);
    const mid = catchUpMultipliers(4, 6);
    const last = catchUpMultipliers(6, 6);
    expect(second.accel).toBeGreaterThan(1);
    expect(second.topSpeed).toBeGreaterThan(1);
    expect(mid.accel).toBeGreaterThan(second.accel);
    expect(mid.topSpeed).toBeGreaterThan(second.topSpeed);
    expect(last.accel).toBeGreaterThan(mid.accel);
    expect(last.topSpeed).toBeGreaterThan(mid.topSpeed);
  });

  it("keeps last-place boost strong enough to chase but below a magnet ceiling", () => {
    const last = catchUpMultipliers(6, 6);
    expect(last.accel).toBeCloseTo(1.3, 5);
    expect(last.topSpeed).toBeCloseTo(1.12, 5);
    expect(last.topSpeed).toBeLessThan(1.2);
    expect(last.accel).toBeLessThan(1.4);
  });
});

import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import {
  applyWallBounce,
  createCarState,
  wallHitAmount,
} from "../src/sim/vehicle";

function blitzAtWall(speed: number) {
  const car = createCarState({
    id: "player",
    x: 0,
    z: 0,
    heading: Math.PI / 2,
    isPlayer: true,
    paint: "#e03131",
    sticker: "none",
    stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0, brakeBonus: 0 },
    speed,
  });
  car.vx = 0;
  car.vz = speed;
  return car;
}

const concreteWall = {
  zone: "wall" as const,
  speedFactor: 0.35,
  gripFactor: 0.4,
  wallKind: "concrete" as const,
  bump: 0,
  lateral: 12,
  distanceAlong: 10,
  tangent: { x: 1, z: 0 },
};

describe("low damage (pre–Fast-KO hits)", () => {
  it("uses the old wall hit table when lowDamage is on", () => {
    expect(wallHitAmount("concrete", 1, true)).toBeCloseTo(0.07, 5);
    expect(wallHitAmount("tire", 1, true)).toBeCloseTo(0.045, 5);
    expect(wallHitAmount("concrete", 1, false)).toBeCloseTo(1.15, 5);
  });

  it("a high-speed wall slam does not KO Blitz under low damage", () => {
    const car = blitzAtWall(28);
    applyWallBounce(car, concreteWall, 2, { lowDamage: true });
    expect(car.koTimer).toBe(0);
    expect(car.hp).toBeGreaterThan(0.8);
    expect(car.hp).toBeLessThan(1);
  });

  it("the same slam still KOs Blitz with default damage", () => {
    const car = blitzAtWall(28);
    applyWallBounce(car, concreteWall, 2);
    expect(car.hp).toBe(0);
  });
});

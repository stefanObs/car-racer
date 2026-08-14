import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import {
  contactDirectionClass,
  contactHitZone,
  contactImpulseDirScale,
  contactYawKick,
  createCarState,
  resolveContact,
  type MergedVehicleStats,
} from "../src/sim/vehicle";

function stats(id: keyof typeof CARS, parts: Parameters<typeof mergeStats>[1] = []): MergedVehicleStats {
  return mergeStats(CARS[id].stats, parts);
}

function car(opts: {
  id: string;
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  modelId?: string;
  carStats?: MergedVehicleStats;
}) {
  const s = opts.carStats ?? stats("blitz");
  const speed = Math.hypot(opts.vx, opts.vz);
  return createCarState({
    id: opts.id,
    x: opts.x,
    z: opts.z,
    heading: opts.heading,
    isPlayer: opts.id === "a",
    paint: "#e03131",
    sticker: "none",
    modelId: opts.modelId ?? "blitz",
    stats: s,
    speed,
    vx: opts.vx,
    vz: opts.vz,
  });
}

describe("contact bump helpers (CONCEPT §4.5)", () => {
  it("classifies Bug / Flanke / Heck from heading vs contact normal", () => {
    expect(contactHitZone(0, 1, 0)).toBe("nose");
    expect(contactHitZone(0, -1, 0)).toBe("tail");
    expect(contactHitZone(0, 0, 1)).toBe("flank");
  });

  it("classifies frontal / oblique / glancing direction", () => {
    expect(contactDirectionClass(0, 1, 0)).toBe("frontal");
    expect(contactDirectionClass(0, Math.cos(0.9), Math.sin(0.9))).toBe("oblique");
    expect(contactDirectionClass(0, 0, 1)).toBe("glancing");
    expect(contactImpulseDirScale("glancing")).toBeLessThan(contactImpulseDirScale("frontal"));
  });

  it("flank yaw kick is stronger than nose at same closing", () => {
    const flank = Math.abs(
      contactYawKick({ zone: "flank", dir: "oblique", closing: 18, grip: 1, side: 1 }),
    );
    const nose = Math.abs(
      contactYawKick({ zone: "nose", dir: "frontal", closing: 18, grip: 1, side: 1 }),
    );
    expect(flank).toBeGreaterThan(nose * 2);
  });
});

describe("resolveContact §4.5 scenes", () => {
  it("soft separating contact only separates (no hard impulse flag)", () => {
    const a = car({ id: "a", x: 0, z: 0, heading: 0, vx: 2, vz: 0 });
    const b = car({ id: "b", x: 2.0, z: 0, heading: 0, vx: 8, vz: 0 });
    const hard = resolveContact(a, b);
    expect(hard).toBe(false);
  });

  it("glancing side-swipe shoves less than head-on at matched closing", () => {
    // Head-on along X
    const aHead = car({ id: "a", x: 0, z: 0, heading: 0, vx: 16, vz: 0 });
    const bHead = car({ id: "b", x: 2.05, z: 0, heading: Math.PI, vx: -16, vz: 0 });
    const a0 = aHead.vx;
    resolveContact(aHead, bHead);
    const headDelta = Math.abs(aHead.vx - a0);

    // Parallel side contact: both heading +X, B to the side, closing via lateral v
    const aSide = car({ id: "a", x: 0, z: 0, heading: 0, vx: 12, vz: 8 });
    const bSide = car({ id: "b", x: 0, z: 2.05, heading: 0, vx: 12, vz: -8 });
    const az0 = aSide.vz;
    resolveContact(aSide, bSide);
    const sideDelta = Math.abs(aSide.vz - az0);

    expect(headDelta).toBeGreaterThan(sideDelta * 1.35);
  });

  it("heavy nose into light tail pushes the light car forward more than sideways yaw alone", () => {
    const light = car({
      id: "light",
      x: 3.0,
      z: 0,
      heading: 0,
      vx: 6,
      vz: 0,
      modelId: "blitz",
      carStats: stats("blitz"),
    });
    const heavy = car({
      id: "heavy",
      x: 0.9,
      z: 0,
      heading: 0,
      vx: 22,
      vz: 0,
      modelId: "bunker",
      carStats: stats("bunker"),
    });
    const vx0 = light.vx;
    const h0 = light.heading;
    expect(resolveContact(heavy, light)).toBe(true);
    // Rear shove: forward speed increases (angeschoben)
    expect(light.vx).toBeGreaterThan(vx0 + 1.5);
    // Not a big spin compared to a flank hit
    expect(Math.abs(light.heading - h0)).toBeLessThan(0.35);
  });

  it("equal-mass flank clash yaws more than nose-on at similar closing", () => {
    const aNose = car({ id: "a", x: 0, z: 0, heading: 0, vx: 14, vz: 0 });
    const bNose = car({ id: "b", x: 2.05, z: 0, heading: Math.PI, vx: -14, vz: 0 });
    const hNose0 = aNose.heading;
    resolveContact(aNose, bNose);
    const noseYaw = Math.abs(aNose.heading - hNose0);

    // Parallel cars, lateral closing → Flanke / streifend on both
    const aFlank = car({ id: "a", x: 0, z: 0, heading: 0, vx: 12, vz: 10 });
    const bFlank = car({ id: "b", x: 0, z: 2.05, heading: 0, vx: 12, vz: -10 });
    const hFlank0 = aFlank.heading;
    resolveContact(aFlank, bFlank);
    const flankYaw = Math.abs(aFlank.heading - hFlank0);

    expect(flankYaw).toBeGreaterThan(noseYaw + 0.05);
  });

  it("higher closing speed deals more damage on the same geometry", () => {
    const softA = car({ id: "a", x: 0, z: 0, heading: 0, vx: 8, vz: 0 });
    const softB = car({ id: "b", x: 2.05, z: 0, heading: Math.PI, vx: -8, vz: 0 });
    resolveContact(softA, softB);
    const softHp = softA.hp;

    const hardA = car({ id: "a", x: 0, z: 0, heading: 0, vx: 22, vz: 0 });
    const hardB = car({ id: "b", x: 2.05, z: 0, heading: Math.PI, vx: -22, vz: 0 });
    resolveContact(hardA, hardB);
    expect(hardA.hp).toBeLessThan(softHp - 0.02);
  });

  it("spike_bumper on aggressor nose increases shove vs stock", () => {
    const stockA = car({ id: "a", x: 0, z: 0, heading: 0, vx: 18, vz: 0 });
    const stockB = car({ id: "b", x: 2.05, z: 0, heading: Math.PI, vx: -4, vz: 0 });
    resolveContact(stockA, stockB);
    const stockShove = Math.abs(stockB.vx - -4);

    const spikeA = car({
      id: "a",
      x: 0,
      z: 0,
      heading: 0,
      vx: 18,
      vz: 0,
      carStats: stats("blitz", ["spike_bumper"]),
    });
    const spikeB = car({ id: "b", x: 2.05, z: 0, heading: Math.PI, vx: -4, vz: 0 });
    resolveContact(spikeA, spikeB);
    const spikeShove = Math.abs(spikeB.vx - -4);
    expect(spikeShove).toBeGreaterThan(stockShove * 1.05);
  });
});

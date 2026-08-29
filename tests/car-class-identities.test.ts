import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";

/** CONCEPT §5 — relative class niches (gras never fully removed). */
describe("distinct car class identities", () => {
  const blitz = mergeStats(CARS.blitz.stats, []);
  const bison = mergeStats(CARS.bison.stats, []);
  const kaefer = mergeStats(CARS.kaeferkraft.stats, []);
  const donner = mergeStats(CARS.donnerbuechse.stats, []);
  const bunker = mergeStats(CARS.bunker.stats, []);

  it("accel: Donnerbüchse peaks; Blitz/Käferkraft ahead of Bunker", () => {
    expect(donner.accel).toBeGreaterThanOrEqual(blitz.accel);
    expect(donner.accel).toBeGreaterThanOrEqual(kaefer.accel);
    expect(blitz.accel).toBeGreaterThan(bunker.accel);
    expect(kaefer.accel).toBeGreaterThan(bunker.accel);
  });

  it("tempo: Blitz peaks; Bunker is slowest", () => {
    expect(blitz.topSpeed).toBeGreaterThanOrEqual(donner.topSpeed);
    expect(donner.topSpeed).toBeGreaterThan(bison.topSpeed);
    expect(bison.topSpeed).toBeGreaterThanOrEqual(kaefer.topSpeed);
    expect(kaefer.topSpeed).toBeGreaterThan(bunker.topSpeed);
  });

  it("handling: Blitz peaks; Donnerbüchse and Bunker are weak", () => {
    expect(blitz.handling).toBeGreaterThan(bison.handling);
    expect(blitz.handling).toBeGreaterThan(donner.handling);
    expect(blitz.handling).toBeGreaterThan(bunker.handling);
    expect(donner.handling).toBeLessThan(1);
    expect(bunker.handling).toBeLessThan(1);
  });

  it("offroad: Käferkraft ≥ Bunker > Bison > asphalt cars; never full remove", () => {
    expect(kaefer.grassMitigation).toBeGreaterThanOrEqual(bunker.grassMitigation);
    expect(bunker.grassMitigation).toBeGreaterThan(bison.grassMitigation);
    expect(bison.grassMitigation).toBeGreaterThan(blitz.grassMitigation);
    expect(blitz.grassMitigation).toBe(0);
    expect(donner.grassMitigation).toBe(0);
    expect(kaefer.grassMitigation).toBeLessThan(0.55);
  });

  it("Federung: Käferkraft owns hops; Bunker stays mediocre despite Gras", () => {
    expect(kaefer.suspension).toBeGreaterThan(bison.suspension);
    expect(kaefer.suspension).toBeGreaterThan(bunker.suspension);
    expect(bunker.suspension).toBeLessThan(1.1);
    expect(blitz.suspension).toBeLessThan(bison.suspension);
  });

  it("contact: Bunker tankiest; Bison shoves; Käferkraft light but armored", () => {
    expect(bunker.mass).toBeGreaterThanOrEqual(bison.mass);
    expect(bison.mass).toBeGreaterThan(kaefer.mass);
    expect(bison.mass).toBeGreaterThan(blitz.mass);
    expect(kaefer.mass).toBeLessThanOrEqual(blitz.mass + 0.05);
    expect(bunker.armor).toBeGreaterThanOrEqual(kaefer.armor);
    expect(kaefer.armor).toBeGreaterThan(bison.armor);
    expect(kaefer.armor).toBeGreaterThan(blitz.armor);
  });

  it("nitro: Donnerbüchse unique stock peak", () => {
    expect(donner.nitroBonus).toBeGreaterThan(0.3);
    expect(blitz.nitroBonus).toBe(0);
    expect(bison.nitroBonus).toBe(0);
    expect(kaefer.nitroBonus).toBe(0);
    expect(bunker.nitroBonus).toBe(0);
  });

  it("ships kid-readable German one-liner descriptions", () => {
    expect(CARS.blitz.description).toMatch(/Remplern|Buckeln/);
    expect(CARS.bison.description).toMatch(/schiebt/);
    expect(CARS.kaeferkraft.description).toMatch(/Gras|Sprünge/);
    expect(CARS.donnerbuechse.description).toMatch(/Nitro/);
    expect(CARS.bunker.description).toMatch(/Schanzen|Gras/);
  });
});

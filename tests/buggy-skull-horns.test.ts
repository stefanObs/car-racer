import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Käferkraft Skull nose prop", () => {
  it("ships a dedicated skull GLB (horns attached in the Tripo mesh)", () => {
    const path = resolve("public/models/props/buggy-skull.glb");
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(8_000);
    expect(statSync(path).size).toBeLessThan(4_000_000);
  });
});

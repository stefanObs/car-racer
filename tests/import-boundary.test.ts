import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAR_IDS, carUsesNoseVariants } from "../src/data/cars";
import { CAR_PAINT_BLACK } from "../src/data/paintColors";
import { displayLap } from "../src/sim/laps";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTs(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function forbiddenImports(file: string, banned: RegExp): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/from\s+["']([^"']+)["']/g)]
    .map((m) => m[1]!)
    .filter((spec) => banned.test(spec));
}

describe("layer import boundaries", () => {
  it("keeps src/data free of render and ui imports", () => {
    const leaks: string[] = [];
    for (const file of listTs(join(SRC, "data"))) {
      for (const spec of forbiddenImports(file, /\/(render|ui)\//)) {
        leaks.push(`${relative(SRC, file)} → ${spec}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("keeps src/render free of ui imports", () => {
    const leaks: string[] = [];
    for (const file of listTs(join(SRC, "render"))) {
      for (const spec of forbiddenImports(file, /\/ui\//)) {
        leaks.push(`${relative(SRC, file)} → ${spec}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("owns garage black paint in data", () => {
    expect(CAR_PAINT_BLACK).toBe("#52545e");
  });

  it("marks only Käferkraft as nose-variant car", () => {
    expect(carUsesNoseVariants("kaeferkraft")).toBe(true);
    for (const id of CAR_IDS) {
      if (id !== "kaeferkraft") expect(carUsesNoseVariants(id)).toBe(false);
    }
  });

  it("clamps display lap only on finish overrun", () => {
    expect(displayLap(4, 3)).toBe(3);
    expect(displayLap(-2, 3)).toBe(-2);
  });
});

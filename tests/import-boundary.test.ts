import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAR_IDS, carUsesNoseVariants } from "../src/data/cars";
import { ComicPaletteCss } from "../src/data/comicPalette";
import { CAR_PAINT_BLACK } from "../src/data/paintColors";
import { STICKER_IDS, sanitizeSticker } from "../src/data/stickers";
import { themeSurface } from "../src/data/themeColors";
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

  it("keeps src/meta free of ui and render imports", () => {
    const leaks: string[] = [];
    for (const file of listTs(join(SRC, "meta"))) {
      for (const spec of forbiddenImports(file, /\/(ui|render)\//)) {
        leaks.push(`${relative(SRC, file)} → ${spec}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("keeps src/ui free of render imports", () => {
    const leaks: string[] = [];
    for (const file of listTs(join(SRC, "ui"))) {
      for (const spec of forbiddenImports(file, /\/render\//)) {
        leaks.push(`${relative(SRC, file)} → ${spec}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("owns garage black paint in data", () => {
    expect(CAR_PAINT_BLACK).toBe("#52545e");
  });

  it("owns comic palette and theme surface hex in data", () => {
    expect(ComicPaletteCss.asphalt).toBe("#4A4F57");
    expect(themeSurface("harbor").ground).toBe(0x6e7580);
  });

  it("owns sticker ids in data", () => {
    expect(STICKER_IDS).toEqual(["none", "flames", "bolt", "star"]);
    expect(sanitizeSticker("lightning")).toBe("bolt");
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

  it("hosts GameApp in src/app, not ui", () => {
    expect(existsSync(join(SRC, "app/GameApp.ts"))).toBe(true);
    expect(existsSync(join(SRC, "ui/GameApp.ts"))).toBe(false);
    expect(readFileSync(join(SRC, "main.ts"), "utf8")).toContain('from "./app/GameApp"');
    expect(readFileSync(join(SRC, "app/GameApp.ts"), "utf8")).toContain("tick(now: number, dt: number)");
  });

  it("keeps sim free of GameAudio and ui", () => {
    const leaks: string[] = [];
    for (const file of listTs(join(SRC, "sim"))) {
      for (const spec of forbiddenImports(file, /\/(ui|GameAudio)/)) {
        leaks.push(`${relative(SRC, file)} → ${spec}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("keeps mergeStats free of cosmetics", () => {
    const src = readFileSync(join(SRC, "data/parts.ts"), "utf8");
    const start = src.indexOf("export function mergeStats");
    const next = src.indexOf("\nexport ", start + 1);
    const body = src.slice(start, next === -1 ? undefined : next);
    expect(body).not.toMatch(/paint|sticker|cosmetic/i);
  });

  it("does not assign CarState kinematics from render", () => {
    const hits: string[] = [];
    const write = /\bcar\.(x|z|vx|vz|heading|hp|nitro)\s*=/;
    for (const file of listTs(join(SRC, "render"))) {
      const text = readFileSync(file, "utf8");
      if (write.test(text)) hits.push(relative(SRC, file));
    }
    expect(hits).toEqual([]);
  });
});

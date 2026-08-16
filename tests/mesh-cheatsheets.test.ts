import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateCheatsheets } from "../scripts/dump-mesh-cheatsheets.mjs";
import { inspectGlb } from "../scripts/lib/inspect-glb.mjs";

const sheets = join(process.cwd(), ".cursor/cheatsheets");

const CAR_IDS = ["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"] as const;
const TRACK_FILES = [
  "track-hafenstart.md",
  "track-parabolbogen.md",
  "track-schikanenring.md",
  "track-omegatal.md",
  "track-kuppenfinale.md",
] as const;

function readSheet(name: string): string {
  return readFileSync(join(sheets, name), "utf8");
}

describe("mesh cheat sheets", () => {
  it("ships one sheet per car, garage, and cup track plus an index", () => {
    expect(existsSync(join(sheets, "README.md"))).toBe(true);
    expect(existsSync(join(sheets, "garage.md"))).toBe(true);
    for (const id of CAR_IDS) {
      expect(existsSync(join(sheets, `car-${id}.md`))).toBe(true);
    }
    for (const f of TRACK_FILES) {
      expect(existsSync(join(sheets, f))).toBe(true);
    }
  });

  it("puts a meter coordinate grid and named nodes on each car sheet", () => {
    for (const id of CAR_IDS) {
      const md = readSheet(`car-${id}.md`);
      expect(md).toContain("<svg");
      expect(md).toContain("meters");
      expect(md).toContain("`BodyPaint`");
      expect(md).toContain("StockWheel_FL");
      expect(md).toContain("AABB");
    }
  });

  it("lists garage instance names on a world grid", () => {
    const md = readSheet("garage.md");
    expect(md).toContain("<svg");
    expect(md).toContain("`garageCabinet`");
    expect(md).toContain("`garageHoist`");
    expect(md).toContain("(1.5");
  });

  it("maps Hafenstart with harbor kit names", () => {
    const md = readSheet("track-hafenstart.md");
    expect(md).toContain("`blitz_cup_01_hafenstart`");
    expect(md).toContain("`crane`");
    expect(md).toContain("tire-wall");
    expect(md).toContain("<svg");
  });

  it("committed sheets match a fresh dump (do not leave them stale)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cc-cheatsheets-"));
    try {
      await generateCheatsheets(dir, { quiet: true });
      const committed = readdirSync(sheets).filter((f) => f.endsWith(".md")).sort();
      const fresh = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
      expect(fresh).toEqual(committed);
      for (const f of committed) {
        expect(readFileSync(join(dir, f), "utf8")).toBe(readFileSync(join(sheets, f), "utf8"));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("inspectGlb", () => {
  it("reports authored StockWheel_FL on Käferkraft", async () => {
    const dump = await inspectGlb(join(process.cwd(), "public/models/cars/kaeferkraft.glb"));
    const wheel = dump.nodes.find((n: { name: string }) => n.name === "StockWheel_FL");
    expect(wheel).toBeTruthy();
    expect(wheel.aabb).toBeTruthy();
    expect(Number.isFinite(wheel.aabb.min[0])).toBe(true);
  });
});

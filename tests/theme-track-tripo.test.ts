import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { THEME_TRACK_PROP_IDS, TRACK_PROP_IDS, TRACK_PROPS } from "../src/data/trackModels";
import { CUP_LEVELS } from "../src/data/levels";
import {
  isTripoSceneryKind,
  normalizeTrackTheme,
  planSceneryAnchors,
  sceneryOverlapsTrack,
  SCENERY_CLEARANCE,
} from "../src/render/themeScenery";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { generateAdhocLevel } from "../src/track/adhoc";
import { isAllowedNonTripoScenery } from "../src/track/layoutRules";

describe("theme track Tripo kit (cups 2–5)", () => {
  it("ships baked theme scenery GLBs that sit on y=0", async () => {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    for (const id of THEME_TRACK_PROP_IDS) {
      const path = resolve("public/models/track", `${id}.glb`);
      expect(existsSync(path), path).toBe(true);
      expect(TRACK_PROPS[id].url).toBe(`/models/track/${id}.glb`);
      const buf = readFileSync(path);
      expect(buf.byteLength, id).toBeGreaterThan(20_000);
      expect(buf.subarray(0, 4).toString()).toBe("glTF");
      expect(buf.toString("latin1")).toContain(id);

      const doc = await io.read(path);
      const b = getBounds(doc.getRoot().listScenes()[0]!);
      expect(b.min[1], id).toBeCloseTo(0, 2);
      expect(b.max[1]! - b.min[1]!, id).toBeGreaterThan(0.8);
    }
    expect(THEME_TRACK_PROP_IDS.length).toBe(10);
    expect(new Set(THEME_TRACK_PROP_IDS.map((id) => statSync(resolve("public/models/track", `${id}.glb`)).size)).size).toBe(
      THEME_TRACK_PROP_IDS.length,
    );
  });

  it("boot awaits the full track Tripo kit before the garage opens", () => {
    const src = readFileSync("src/main.ts", "utf8");
    expect(src).toContain("preloadTrackModels");
    expect(src).toMatch(/Promise\.all\(\[[\s\S]*preloadTrackModels\(\)/);
    expect(TRACK_PROP_IDS.length).toBe(21);
  });

  it("race start awaits track kit so walls/scenery never miss Tripo", () => {
    const src = readFileSync("src/app/raceFlow.ts", "utf8");
    expect(src).toContain("preloadTrackModels");
    expect(src).toMatch(/await preloadTrackModels\(\)/);
  });

  it("maps every cup + ad-hoc theme scenery kind onto shipped Tripo props", () => {
    expect(normalizeTrackTheme("scrapyard")).toBe("factory");
    expect(normalizeTrackTheme("mountain")).toBe("canyon");

    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const anchors = planSceneryAnchors(track, level.theme);
      expect(anchors.length, level.id).toBeGreaterThan(5);
      for (const a of anchors) {
        if (isAllowedNonTripoScenery(a.kind)) continue;
        expect(isTripoSceneryKind(a.kind), `${level.id} ${a.kind}`).toBe(true);
      }
    }

    for (const theme of ["harbor", "beach", "city", "canyon", "factory", "scrapyard", "mountain"] as const) {
      const level = generateAdhocLevel({ seed: "A7F2", theme });
      const track = buildTrackFromLevel(level);
      const anchors = planSceneryAnchors(track, level.theme);
      expect(anchors.length, theme).toBeGreaterThan(5);
      const tripo = anchors.filter((a) => isTripoSceneryKind(a.kind));
      expect(tripo.length, theme).toBeGreaterThan(0);
    }
  });

  it("keeps scenery clearance larger than the wall ribbon for cups 2–5", () => {
    expect(SCENERY_CLEARANCE).toBeGreaterThanOrEqual(12);
    for (const level of CUP_LEVELS.slice(1)) {
      const track = buildTrackFromLevel(level);
      const anchors = planSceneryAnchors(track, level.theme);
      expect(anchors.length, level.id).toBeGreaterThan(8);
      const onTrack = anchors.filter((a) => sceneryOverlapsTrack(track, a.x, a.z, a.radius));
      expect(onTrack, `${level.id} (${level.theme})`).toEqual([]);
    }
  });

  it("does not place harbor cranes on Parabolbogen (beach)", () => {
    const level = CUP_LEVELS.find((l) => l.theme === "beach")!;
    const track = buildTrackFromLevel(level);
    const kinds = new Set(planSceneryAnchors(track, level.theme).map((a) => a.kind));
    expect(kinds.has("crane")).toBe(false);
    expect(kinds.has("grandstand")).toBe(true);
    expect(kinds.has("palm")).toBe(true);
    expect(kinds.has("dune")).toBe(false);
  });

  it("drops procedural lamp/stack/dune from cup scenery plans", () => {
    for (const level of CUP_LEVELS) {
      const kinds = new Set(
        planSceneryAnchors(buildTrackFromLevel(level), level.theme).map((a) => a.kind),
      );
      expect(kinds.has("lamp"), level.id).toBe(false);
      expect(kinds.has("stack"), level.id).toBe(false);
      expect(kinds.has("dune"), level.id).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { CUP_LEVELS, layoutFingerprint } from "../src/data/levels";
import { buildTrackFromLevel, nearestOnTrack } from "../src/track/buildTrack";
import { CORRIDOR_ALONG_WINDOW_M } from "../src/track/layoutRules";
import { trackSelfIntersects } from "../src/track/validateTrack";
import { planSceneryAnchors, sceneryOverlapsTrack } from "../src/render/themeScenery";
import { planWallPlacements } from "../src/render/trackKit";

describe("cup tracks wired to proposals (clear asphalt)", () => {
  it("keeps Hafenstart id/theme and gives cups 2–5 proposal display names", () => {
    expect(CUP_LEVELS.map((l) => ({ id: l.id, name: l.displayName, theme: l.theme }))).toEqual([
      { id: "blitz_cup_01_hafenstart", name: "Hafenstart", theme: "harbor" },
      { id: "blitz_cup_02_kuestenline", name: "Parabolbogen", theme: "beach" },
      { id: "blitz_cup_03_stadtring", name: "Schikanenring", theme: "city" },
      { id: "blitz_cup_04_buckelpiste", name: "Omegatal", theme: "canyon" },
      { id: "blitz_cup_05_cupfinale", name: "Kuppenfinale", theme: "factory" },
      { id: "blitz_cup_06_brueckenkreuz", name: "Brückenkreuz", theme: "overpass" },
    ]);
  });

  it("uses distinct layout fingerprints (not clone ovals)", () => {
    const fps = CUP_LEVELS.map(layoutFingerprint);
    expect(new Set(fps).size).toBe(CUP_LEVELS.length);
    // Parabolbogen: wide paperclip arcs (proposal tempo track)
    expect(layoutFingerprint(CUP_LEVELS[1]!)).toMatch(/curve_r:(1|2)\d{2}/);
    // Schikanenring: signature S-chicanes
    expect(layoutFingerprint(CUP_LEVELS[2]!)).toContain("s_curve");
    // Omegatal: left+right mix for omega lobe
    expect(layoutFingerprint(CUP_LEVELS[3]!)).toMatch(/curve_l/);
    expect(layoutFingerprint(CUP_LEVELS[3]!)).toMatch(/curve_r/);
    // Kuppenfinale: many kuppen (uneven) + varied corners
    expect(layoutFingerprint(CUP_LEVELS[4]!).split("uneven_field").length).toBeGreaterThan(2);
  });

  it("never places solid obstacles on the racing corridor (median walls exempt at verge)", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const solids = level.obstacles.filter(
        (o) => o.type === "tire_stack" || o.type === "concrete_barrier",
      );
      for (const o of solids) {
        const near = nearestOnTrack(track, { x: o.position[0]!, z: o.position[1]! });
        if (o.role === "median") {
          expect(
            Math.abs(near.lateral),
            `${level.displayName} median on center`,
          ).toBeGreaterThanOrEqual(track.asphaltHalfWidth * 0.5);
          continue;
        }
        expect(
          Math.abs(near.lateral),
          `${level.displayName} ${o.type} lat=${near.lateral}`,
        ).toBeGreaterThanOrEqual(track.asphaltHalfWidth + 0.35);
      }
    }
  });

    it("keeps outer wall module centers outside asphalt", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      for (const p of planWallPlacements(track)) {
        const near = nearestOnTrack(track, { x: p.x, z: p.z }, {
          preferAlong: p.along,
          maxAlongGap: CORRIDOR_ALONG_WINDOW_M,
        });
        expect(Math.abs(near.lateral), `${level.id} wall`).toBeGreaterThan(track.asphaltHalfWidth);
      }
    }
  });

  it("keeps theme scenery off asphalt+grass and loops non-crossing", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      expect(trackSelfIntersects(track), level.id).toBe(false);
      const on = planSceneryAnchors(track, level.theme).filter((a) =>
        sceneryOverlapsTrack(track, a.x, a.z, a.radius),
      );
      expect(on, level.id).toEqual([]);
    }
  });
});

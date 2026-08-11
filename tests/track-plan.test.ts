import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import { renderTrackPlanSvg, trackPlanTint } from "../src/ui/trackPlan";

describe("track plan SVG", () => {
  it("renders a unique themed plan for every cup", () => {
    const svgs = CUP_LEVELS.map((l) => renderTrackPlanSvg(l));
    expect(new Set(svgs).size).toBe(CUP_LEVELS.length);
    for (let i = 0; i < CUP_LEVELS.length; i++) {
      const level = CUP_LEVELS[i]!;
      const svg = svgs[i]!;
      expect(svg).toContain("track-plan-svg");
      expect(svg).toContain(level.displayName);
      expect(svg).toContain(trackPlanTint(level.theme).bg);
      expect(svg).toMatch(/<path d="M/);
    }
  });

  it("marks Schanzen on Buckelpiste and Cup-Finale plans", () => {
    const buckel = CUP_LEVELS.find((l) => l.id.includes("buckelpiste"))!;
    const finale = CUP_LEVELS.find((l) => l.id.includes("cupfinale"))!;
    expect(buckel.obstacles.some((o) => o.type === "ramp")).toBe(true);
    expect(finale.obstacles.some((o) => o.type === "ramp")).toBe(true);
    expect(renderTrackPlanSvg(buckel)).toContain("polygon");
    expect(renderTrackPlanSvg(finale)).toContain("polygon");
  });

  it("cup silhouettes differ in bounding aspect", () => {
    const aspects = CUP_LEVELS.map((l) => {
      const t = buildTrackFromLevel(l);
      const xs = t.centerline.map((p) => p.x);
      const zs = t.centerline.map((p) => p.z);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...zs) - Math.min(...zs);
      return +(w / Math.max(h, 1)).toFixed(2);
    });
    expect(new Set(aspects).size).toBeGreaterThanOrEqual(3);
  });
});

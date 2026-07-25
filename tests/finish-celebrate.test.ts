import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { buildFinishLine } from "../src/render/finishLine";
import { buildSmoothTrack } from "../src/render/trackMesh";
import { buildTrackFromLevel } from "../src/track/buildTrack";
import {
  advanceFinishCelebrate,
  createFinishCelebrate,
  finishCelebrateDuration,
  finishOverlayHtml,
  isPodiumPlace,
  resultsPodiumHtml,
} from "../src/ui/finishCelebrate";

describe("finish line and celebrate", () => {
  it("adds a named finish line group on every cup track", () => {
    for (const level of CUP_LEVELS) {
      const track = buildTrackFromLevel(level);
      const mesh = buildSmoothTrack(track);
      const finish = mesh.getObjectByName("finishLine");
      expect(finish, level.id).toBeTruthy();
      expect(finish!.children.length).toBeGreaterThan(5);
    }
  });

  it("places finish banner at start/finish sample", () => {
    const track = buildTrackFromLevel(CUP_LEVELS[0]!);
    const finish = buildFinishLine(track);
    expect(finish.name).toBe("finishLine");
    expect(Math.hypot(finish.position.x, finish.position.z)).toBeLessThan(2);
  });

  it("uses longer celebrate for podium places than field places", () => {
    expect(isPodiumPlace(1)).toBe(true);
    expect(isPodiumPlace(3)).toBe(true);
    expect(isPodiumPlace(4)).toBe(false);
    expect(finishCelebrateDuration(1)).toBeGreaterThan(finishCelebrateDuration(5));
    expect(finishCelebrateDuration(2)).toBe(finishCelebrateDuration(3));
  });

  it("renders distinct finish overlays for podium vs field", () => {
    const podium = createFinishCelebrate(1);
    podium.t = 0.4;
    const field = createFinishCelebrate(5);
    field.t = 0.4;
    const podHtml = finishOverlayHtml(podium);
    const fieldHtml = finishOverlayHtml(field);
    expect(podHtml).toContain("finish-fx--podium");
    expect(podHtml).toContain("SIEG!");
    expect(fieldHtml).toContain("finish-fx--field");
    expect(fieldHtml).toContain("IM ZIEL!");
    expect(fieldHtml).not.toContain("SIEG!");
  });

  it("animates podium landing for top-3 and field slide otherwise", () => {
    const p1 = resultsPodiumHtml(1);
    expect(p1).toContain("results-podium--land");
    expect(p1).toContain("podium-stand--you");
    expect(p1).toContain('data-place="1"');

    const p5 = resultsPodiumHtml(5);
    expect(p5).toContain("results-podium--field");
    expect(p5).toContain("land-field");
    expect(p5).toContain("Platz 5");
    expect(p5).not.toContain("podium-stand--you");
  });

  it("advances celebrate time from wall clock", () => {
    const fx = createFinishCelebrate(1, 1000);
    advanceFinishCelebrate(fx, 2500);
    expect(fx.t).toBeCloseTo(1.5, 5);
    advanceFinishCelebrate(fx, 4000);
    expect(fx.t).toBeGreaterThanOrEqual(fx.duration);
  });
});

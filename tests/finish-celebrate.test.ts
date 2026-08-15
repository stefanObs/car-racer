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
import {
  FIELD_MOVIE_SECONDS,
  PODIUM_MOVIE_SECONDS,
  RESULT_MOVIE_PANELS,
  podiumMovieDuration,
  podiumMovieHtml,
  podiumMovieKind,
  podiumMovieTitle,
} from "../src/ui/podiumMovie";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("finish line and celebrate", () => {
  it("adds a named finish line group on every cup track", { timeout: 20_000 }, () => {
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

  it("uses ~15s podium movies and a shorter field disappointment beat", () => {
    expect(isPodiumPlace(1)).toBe(true);
    expect(isPodiumPlace(3)).toBe(true);
    expect(isPodiumPlace(4)).toBe(false);
    expect(finishCelebrateDuration(1)).toBe(PODIUM_MOVIE_SECONDS);
    expect(finishCelebrateDuration(2)).toBe(PODIUM_MOVIE_SECONDS);
    expect(finishCelebrateDuration(3)).toBe(PODIUM_MOVIE_SECONDS);
    expect(finishCelebrateDuration(5)).toBe(FIELD_MOVIE_SECONDS);
    expect(finishCelebrateDuration(1)).toBeGreaterThan(finishCelebrateDuration(5));
  });

  it("renders distinct 2D movies for 1st, 2nd, 3rd, and field", () => {
    expect(podiumMovieKind(1)).toBe("gold");
    expect(podiumMovieKind(2)).toBe("silver");
    expect(podiumMovieKind(3)).toBe("bronze");
    expect(podiumMovieKind(6)).toBe("field");

    const gold = finishOverlayHtml(createFinishCelebrate(1));
    const silver = finishOverlayHtml(createFinishCelebrate(2));
    const bronze = finishOverlayHtml(createFinishCelebrate(3));
    const field = finishOverlayHtml(createFinishCelebrate(5));

    expect(gold).toContain("finish-fx--gold");
    expect(gold).toContain("podium-movie--gold");
    expect(gold).toContain("SIEGER!");
    expect(gold).toContain('data-dev-name="finish.movie"');
    expect(gold).toContain('data-pose="cheer"');
    expect(gold).toContain("gold-podium.jpg");
    expect(gold).toContain("gold-finish.jpg");
    expect(gold).toContain("gold-end.jpg");
    expect(gold).toContain("podium-movie--painted");

    expect(silver).toContain("finish-fx--silver");
    expect(silver).toContain("SILBER!");
    expect(silver).toContain('data-pose="wave"');
    expect(silver).toContain("silver-proud.jpg");

    expect(bronze).toContain("finish-fx--bronze");
    expect(bronze).toContain("BRONZE!");
    expect(bronze).toContain('data-pose="fist"');
    expect(bronze).toContain("bronze-relief.jpg");

    expect(field).toContain("finish-fx--field");
    expect(field).toContain("podium-movie--field");
    expect(field).toContain("SCHADE!");
    expect(field).toContain('data-pose="sad"');
    expect(field).toContain("field-sad.jpg");
    expect(field).not.toContain("SIEGER!");
  });

  it("keeps gold/silver/bronze movie HTML structurally different", () => {
    const g = podiumMovieHtml(1);
    const s = podiumMovieHtml(2);
    const b = podiumMovieHtml(3);
    const f = podiumMovieHtml(4);
    expect(g).toContain("pm-prop--trophy");
    expect(s).toContain("pm-prop--silver");
    expect(b).toContain("pm-prop--bronze");
    expect(f).toContain("pm-scene--sad");
    expect(g).not.toContain("pm-scene--sad");
    expect(g).toContain("pm-art");
    expect(podiumMovieDuration(1)).toBe(15);
    expect(podiumMovieDuration(4)).toBe(5);
    expect(podiumMovieTitle(2)).toBe("SILBER!");
  });

  it("animates podium landing for top-3 and field slide otherwise", () => {
    const p1 = resultsPodiumHtml(1);
    expect(p1).toContain("results-podium--land");
    expect(p1).toContain("podium-stand--you");
    expect(p1).toContain('data-place="1"');
    expect(p1).toContain("SIEGER!");
    expect(p1).toContain("results-still");
    expect(p1).toContain("gold-podium.jpg");

    const p5 = resultsPodiumHtml(5);
    expect(p5).toContain("results-podium--field");
    expect(p5).toContain("land-field");
    expect(p5).toContain("SCHADE!");
    expect(p5).toContain("Platz 5");
    expect(p5).toContain("field-sad.jpg");
    expect(p5).not.toContain("podium-stand--you");
  });

  it("advances celebrate time from wall clock through the full movie", () => {
    const fx = createFinishCelebrate(1, 1000);
    advanceFinishCelebrate(fx, 2500);
    expect(fx.t).toBeCloseTo(1.5, 5);
    expect(fx.t).toBeLessThan(fx.duration);
    advanceFinishCelebrate(fx, 1000 + PODIUM_MOVIE_SECONDS * 1000);
    expect(fx.t).toBeGreaterThanOrEqual(fx.duration);
  });

  it("ships painted Asphalt-Comic result panels for every movie kind", () => {
    for (const urls of Object.values(RESULT_MOVIE_PANELS)) {
      for (const url of urls) {
        const path = resolve("public", url.replace(/^\//, ""));
        expect(existsSync(path), path).toBe(true);
      }
    }
  });
});

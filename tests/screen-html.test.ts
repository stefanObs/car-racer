import { describe, expect, it } from "vitest";
import { APP_CREDIT, APP_VERSION } from "../src/core/version";
import { CUP_LEVELS, freeLevels, trainingLevels } from "../src/data/levels";
import { formatChf } from "../src/meta/save";
import { generateAdhocLevel } from "../src/track/adhoc";
import { renderAdhocHtml } from "../src/ui/adhocHtml";
import { renderMenuHtml } from "../src/ui/menuHtml";
import {
  renderCupPickHtml,
  renderFreePickHtml,
  renderTrainingPickHtml,
} from "../src/ui/modePickHtml";
import { renderRaceChromeHtml } from "../src/ui/raceChromeHtml";
import { renderResultsHtml } from "../src/ui/resultsHtml";

describe("screen HTML extracts", () => {
  it("menu keeps Hilfe copy and garage CTA", () => {
    const html = renderMenuHtml(250, false);
    expect(html).toContain("Crash Circuit");
    expect(html).toContain("Hilfe & Infos");
    expect(html).toContain(`v${APP_VERSION}`);
    expect(html).toContain(APP_CREDIT);
    expect(html).toContain(formatChf(250));
    expect(html).toContain("Ton an");
    expect(html).toContain('data-act="garage"');
    expect(html).toContain('data-act="open-settings"');
  });

  it("cup list locks later tracks and preserves race data-act", () => {
    const html = renderCupPickHtml(CUP_LEVELS, 1, { [CUP_LEVELS[0]!.id]: 2 });
    expect(html).toContain("Blitz-Cup");
    expect(html).toContain(`data-level="${CUP_LEVELS[0]!.id}"`);
    expect(html).toContain("★★");
    expect(html).toContain("disabled");
    expect(html).toContain("Gesperrt");
    expect(html).toContain('data-act="garage"');
  });

  it("free mode shows empty copy when nothing is unlocked", () => {
    expect(renderFreePickHtml([])).toContain("Noch keine Strecken freigeschaltet.");
    const html = renderFreePickHtml(freeLevels([CUP_LEVELS[0]!.id]));
    expect(html).toContain("Freier Modus");
    expect(html).toContain(`data-level="${CUP_LEVELS[0]!.id}"`);
    expect(html).not.toContain("disabled");
  });

  it("training lists every cup track without locks", () => {
    const html = renderTrainingPickHtml(trainingLevels());
    expect(html).toContain("ohne Platzierung");
    expect(html).toContain(`data-level="${CUP_LEVELS[0]!.id}"`);
    expect(html).toContain(`data-level="${CUP_LEVELS[CUP_LEVELS.length - 1]!.id}"`);
    expect(html).not.toContain("disabled");
  });

  it("adhoc keeps seed field and start CTA", () => {
    const preview = generateAdhocLevel({ seed: "A7F2", length: "medium" });
    const html = renderAdhocHtml({ seed: "A7F2", length: "medium", preview });
    expect(html).toContain('id="adhoc-seed-label"');
    expect(html).toContain("A7F2");
    expect(html).toContain('data-act="adhoc-start"');
    expect(html).toContain('data-act="adhoc-roll"');
    expect(html).toContain('data-length="medium"');
    expect(html).toContain("data-seed-input");
  });

  it("race chrome keeps HUD host, mute, and touch acts", () => {
    const html = renderRaceChromeHtml(true);
    expect(html).toContain('id="race-hud"');
    expect(html).toContain('data-act="open-settings"');
    expect(html).toContain("Ton aus");
    expect(html).toContain('data-touch="nitro"');
    expect(html).toContain('data-touch="drift"');
  });

  it("results keep ranked vs training contracts", () => {
    const ranked = renderResultsHtml({
      place: 1,
      purseChf: 120,
      styleBonus: 20,
      starsEarned: true,
      ranked: true,
    });
    expect(ranked).toContain("Ergebnis");
    expect(ranked).toContain("Sterne verdient!");
    expect(ranked).toContain('data-act="cup"');
    expect(ranked).toContain(formatChf(120));

    const training = renderResultsHtml({
      place: 0,
      purseChf: 0,
      styleBonus: 0,
      starsEarned: false,
      ranked: false,
    });
    expect(training).toContain('data-dev-name="results.training"');
    expect(training).toContain('data-act="training"');
    expect(training).not.toContain("Sterne verdient!");
  });
});

import { describe, expect, it } from "vitest";
import { escapeOpensSettings } from "../src/ui/settingsEsc";
import { emptyKit } from "../src/meta/save";
import type { GameSettings } from "../src/meta/gameSettings";
import { renderGarageHtml } from "../src/ui/garageHtml";
import { renderSettingsPanelHtml } from "../src/ui/settingsHtml";

function settings(partial: Partial<GameSettings> = {}): GameSettings {
  return { easyMode: false, lowDamageMode: false, ...partial };
}

describe("settings Esc + garage button", () => {
  it("opens settings from garage and race, not from submenus", () => {
    expect(escapeOpensSettings("garage")).toBe(true);
    expect(escapeOpensSettings("race")).toBe(true);
    expect(escapeOpensSettings("menu")).toBe(false);
    expect(escapeOpensSettings("cup")).toBe(false);
    expect(escapeOpensSettings("results")).toBe(false);
  });

  it("shows Einstellungen in the garage hero", () => {
    const html = renderGarageHtml({
      chf: 100,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
    });
    expect(html).toContain('data-dev-name="garage.settings"');
    expect(html).toContain('data-act="open-settings"');
    expect(html).toContain("Einstellungen");
  });

  it("mentions Esc in the settings hint", () => {
    expect(renderSettingsPanelHtml(settings(), false)).toContain("Esc");
  });

  it("marks active toggles for comic on-state styling", () => {
    const easy = renderSettingsPanelHtml(settings({ easyMode: true }), false);
    expect(easy).toContain("settings-toggle is-on");
    expect(easy).toContain(">AN<");
    const low = renderSettingsPanelHtml(settings({ lowDamageMode: true }), false);
    expect(low).toContain('data-act="toggle-low-damage"');
    expect(low).toContain("Wenig Schaden");
    expect(low).toMatch(/data-act="toggle-low-damage"[^>]*is-on/);
    const muted = renderSettingsPanelHtml(settings(), true);
    expect(muted).not.toMatch(/data-act="toggle-mute"[^>]*is-on/);
    expect(muted).toContain(">AUS<");
  });

  it("uses Asphalt-Comic chrome classes", () => {
    const html = renderSettingsPanelHtml(settings(), false);
    expect(html).toContain("settings-kicker");
    expect(html).toContain("settings-hazard");
  });

  it("offers leave-race only while in a race", () => {
    const garage = renderSettingsPanelHtml(settings(), false);
    expect(garage).not.toContain("leave-race");
    const race = renderSettingsPanelHtml(settings(), false, { inRace: true });
    expect(race).toContain('data-act="leave-race"');
    expect(race).toContain("Rennen verlassen");
    expect(race).toContain("kein Preisgeld");
  });
});

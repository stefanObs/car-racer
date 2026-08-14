import { describe, expect, it } from "vitest";
import { escapeOpensSettings } from "../src/ui/settingsEsc";
import { emptyKit } from "../src/meta/save";
import { renderGarageHtml } from "../src/ui/garageHtml";
import { renderSettingsPanelHtml } from "../src/ui/settingsHtml";

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
    expect(renderSettingsPanelHtml({ easyMode: false }, false)).toContain("Esc");
  });

  it("marks active toggles for comic on-state styling", () => {
    const easy = renderSettingsPanelHtml({ easyMode: true }, false);
    expect(easy).toContain("settings-toggle is-on");
    expect(easy).toContain(">AN<");
    const muted = renderSettingsPanelHtml({ easyMode: false }, true);
    expect(muted).not.toMatch(/data-act="toggle-mute"[^>]*is-on/);
    expect(muted).toContain(">AUS<");
  });

  it("uses Asphalt-Comic chrome classes", () => {
    const html = renderSettingsPanelHtml({ easyMode: false }, false);
    expect(html).toContain("settings-kicker");
    expect(html).toContain("settings-hazard");
  });
});

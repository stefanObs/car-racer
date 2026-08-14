import type { GameSettings } from "../meta/gameSettings";

export type SettingsPanelOpts = {
  /** Show “Rennen verlassen → Garage” (CONCEPT §9). */
  inRace?: boolean;
};

/** Modal settings panel — German UI (CONCEPT §7.4 / §9), Asphalt-Comic look. */
export function renderSettingsPanelHtml(
  settings: GameSettings,
  muted: boolean,
  opts: SettingsPanelOpts = {},
): string {
  const easyOn = settings.easyMode;
  const tonOn = !muted;
  const inRace = Boolean(opts.inRace);
  const leaveRace = inRace
    ? `<div class="settings-row">
        <button type="button" data-nav data-act="leave-race" class="settings-leave" data-dev-name="settings.leave-race">
          <strong>Rennen verlassen</strong>
          <span class="settings-leave__hint">Zurück zur Garage — kein Preisgeld für diesen Lauf.</span>
        </button>
      </div>`
    : "";
  return `
    <div class="settings-backdrop" data-act="close-settings" data-dev-name="settings.backdrop"></div>
    <div class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-dev-name="settings.panel">
      <p class="settings-kicker">Crash Circuit</p>
      <h2 id="settings-title">Einstellungen</h2>
      <div class="settings-hazard" aria-hidden="true"></div>
      <p class="settings-hint">${
        inRace
          ? "Esc schließt dieses Menü. Du kannst das Rennen hier abbrechen."
          : "Esc oder Rechtsklick öffnet dieses Menü (am Auto in der Garage: Rechtsklick dreht)."
      }</p>
      <div class="settings-row">
        <button type="button" data-nav data-act="toggle-easy-mode" class="settings-toggle${
          easyOn ? " is-on" : ""
        }" aria-pressed="${easyOn ? "true" : "false"}" data-dev-name="settings.easy">
          <span class="settings-toggle__label">
            <strong>Einfacher Modus</strong>
            <span class="settings-toggle__hint">Immer Vollgas — Bremse hebt das auf; halten nach Stopp = Rückwärts.</span>
          </span>
          <span class="settings-toggle__state">${easyOn ? "AN" : "AUS"}</span>
        </button>
      </div>
      <div class="settings-row">
        <button type="button" data-nav data-act="toggle-mute" class="settings-toggle${
          tonOn ? " is-on" : ""
        }" aria-pressed="${tonOn ? "true" : "false"}" data-dev-name="settings.mute">
          <span class="settings-toggle__label">
            <strong>Ton</strong>
            <span class="settings-toggle__hint">Arcade-SFX an oder stumm.</span>
          </span>
          <span class="settings-toggle__state">${tonOn ? "AN" : "AUS"}</span>
        </button>
      </div>
      ${leaveRace}
      <button type="button" data-nav data-act="close-settings" class="settings-close">Schließen</button>
    </div>
  `;
}

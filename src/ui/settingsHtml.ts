import type { GameSettings } from "../meta/gameSettings";

/** Modal settings panel — German UI (CONCEPT §7.4 / §9), Asphalt-Comic look. */
export function renderSettingsPanelHtml(settings: GameSettings, muted: boolean): string {
  const easyOn = settings.easyMode;
  const tonOn = !muted;
  return `
    <div class="settings-backdrop" data-act="close-settings" data-dev-name="settings.backdrop"></div>
    <div class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-dev-name="settings.panel">
      <p class="settings-kicker">Crash Circuit</p>
      <h2 id="settings-title">Einstellungen</h2>
      <div class="settings-hazard" aria-hidden="true"></div>
      <p class="settings-hint">Esc oder Rechtsklick öffnet dieses Menü (am Auto in der Garage: Rechtsklick dreht).</p>
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
      <button type="button" data-nav data-act="close-settings" class="settings-close">Schließen</button>
    </div>
  `;
}

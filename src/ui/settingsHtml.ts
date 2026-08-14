import type { GameSettings } from "../meta/gameSettings";

/** Modal settings panel — German UI (CONCEPT §7.4 / §9). */
export function renderSettingsPanelHtml(settings: GameSettings, muted: boolean): string {
  const easyOn = settings.easyMode;
  return `
    <div class="settings-backdrop" data-act="close-settings" data-dev-name="settings.backdrop"></div>
    <div class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-dev-name="settings.panel">
      <h2 id="settings-title">Einstellungen</h2>
      <p class="dim settings-hint">Rechtsklick öffnet dieses Menü (am Auto in der Garage: Rechtsklick dreht).</p>
      <div class="settings-row">
        <button type="button" data-nav data-act="toggle-easy-mode" class="settings-toggle" aria-pressed="${
          easyOn ? "true" : "false"
        }" data-dev-name="settings.easy">
          <strong>Einfacher Modus</strong>
          <span class="settings-toggle__state">${easyOn ? "AN" : "AUS"}</span>
        </button>
        <p class="dim settings-desc">Immer Vollgas — du musst nicht Gas halten. Bremse hebt das auf; halten nach Stopp = Rückwärts.</p>
      </div>
      <div class="settings-row">
        <button type="button" data-nav data-act="toggle-mute" class="settings-toggle" aria-pressed="${
          muted ? "true" : "false"
        }" data-dev-name="settings.mute">
          <strong>Ton</strong>
          <span class="settings-toggle__state">${muted ? "AUS" : "AN"}</span>
        </button>
      </div>
      <button type="button" data-nav data-act="close-settings" class="settings-close">Schließen</button>
    </div>
  `;
}

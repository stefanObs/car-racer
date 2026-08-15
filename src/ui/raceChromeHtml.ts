export function renderRaceChromeHtml(muted: boolean): string {
  return `
        <div id="race-hud" class="race-hud"></div>
        <button type="button" data-act="open-settings" class="race-settings">Einstellungen</button>
        <button type="button" data-act="toggle-mute" class="race-mute" aria-pressed="${
          muted ? "true" : "false"
        }">${muted ? "Ton aus" : "Ton an"}</button>
        <div class="touch-controls" aria-label="Touch-Steuerung">
          <button type="button" data-touch="left">◀</button>
          <button type="button" data-touch="brake">Bremse / R</button>
          <button type="button" data-touch="throttle">Gas</button>
          <button type="button" data-touch="right">▶</button>
          <button type="button" data-touch="drift">Drift</button>
          <button type="button" data-touch="nitro">Nitro</button>
        </div>
      `;
}

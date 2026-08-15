import { APP_CREDIT, APP_VERSION } from "../core/version";
import { formatChf } from "../meta/save";

export function renderMenuHtml(chf: number, muted: boolean): string {
  return `
        <h1 class="brand">Crash Circuit</h1>
        <p class="tag">Hilfe & Infos</p>
        <p class="meta">${formatChf(chf)} · v${APP_VERSION}</p>
        <p class="credit">${APP_CREDIT}</p>
        <p class="help">Tastatur: WASD / Pfeile (S halten = Rückwärts), Strg/E Drift, Space Nitro (erst ab der Marke), Enter, Esc · Controller: Stick, LT Bremse/Rückwärts, LB Drift, A/RB Nitro · Tablet: Touch · Mini-Map: DU + die anderen</p>
        <div class="stack">
          <button data-nav data-act="open-settings">Einstellungen</button>
          <button data-nav data-act="toggle-mute">${muted ? "Ton aus" : "Ton an"}</button>
          <button data-nav data-act="garage">Zur Garage</button>
        </div>
      `;
}

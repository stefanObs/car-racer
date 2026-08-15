import type { AdhocLength } from "../track/adhoc";
import type { LevelDefinition } from "../track/types";
import { renderTrackPlanSvg } from "./trackPlan";

export function renderAdhocHtml(opts: {
  seed: string;
  length: AdhocLength;
  preview: LevelDefinition;
}): string {
  const lengthBtns = (["short", "medium", "long"] as AdhocLength[])
    .map((len) => {
      const label = len === "short" ? "Kurz" : len === "long" ? "Lang" : "Mittel";
      const on = opts.length === len ? " ✓" : "";
      return `<button data-nav data-act="adhoc-length" data-length="${len}">${label}${on}</button>`;
    })
    .join("");
  const plan = renderTrackPlanSvg(opts.preview, 160);
  return `
        <h2>Ad-hoc</h2>
        <p class="tag">Zufallsstrecke zum Teilen — Seed zeigt die gleiche Runde.</p>
        <div class="track-pick track-pick--preview">${plan}</div>
        <p class="meta">Seed <strong id="adhoc-seed-label">${opts.seed}</strong> · ${opts.preview.theme} · ${opts.preview.laps} Runden</p>
        <label class="seed-field">Seed
          <input data-seed-input maxlength="6" value="${opts.seed}" autocomplete="off" spellcheck="false" />
        </label>
        <div class="stack row">${lengthBtns}</div>
        <div class="stack">
          <button data-nav data-act="adhoc-roll">Neuer Seed</button>
          <button data-nav data-act="adhoc-start">Start #${opts.seed}</button>
          <button data-nav data-act="garage">Garage</button>
        </div>
      `;
}

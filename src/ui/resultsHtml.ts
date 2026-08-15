import { formatChf } from "../meta/save";
import type { RaceResult } from "../sim/race";
import { resultsPodiumHtml } from "./finishCelebrate";

export function renderResultsHtml(result: RaceResult): string {
  if (!result.ranked) {
    return `
        <h2>Training</h2>
        <p class="tag" data-dev-name="results.training">Runden geschafft — ohne Wertung.</p>
        <div class="stack">
          <button data-nav data-act="training">Weiter Training</button>
          <button data-nav data-act="garage">Garage</button>
        </div>
      `;
  }
  return `
        <h2>Ergebnis</h2>
        ${resultsPodiumHtml(result.place)}
        <p>${formatChf(result.purseChf)} <span class="dim">(inkl. Style ${formatChf(result.styleBonus)})</span></p>
        <p>${result.starsEarned ? "Sterne verdient!" : ""}</p>
        <div class="stack">
          <button data-nav data-act="cup">Weiter Cup</button>
          <button data-nav data-act="garage">Garage</button>
          <button data-nav data-act="menu">Hilfe</button>
        </div>
      `;
}

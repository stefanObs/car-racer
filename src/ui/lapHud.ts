/** Current lap for HUD — clamp so finish frame still reads as last lap. */
export function displayLap(lap: number, totalLaps: number): number {
  return Math.max(1, Math.min(lap, Math.max(1, totalLaps)));
}

/** Kid-readable lap line: current / total. */
export function formatLapCounter(lap: number, totalLaps: number): string {
  const cur = displayLap(lap, totalLaps);
  const total = Math.max(1, totalLaps);
  return `${cur} / ${total}`;
}

/** Comic HUD block for race overlay. */
export function renderLapCounterHtml(lap: number, totalLaps: number): string {
  const total = Math.max(1, totalLaps);
  const cur = displayLap(lap, total);
  return `
    <div class="hud-lap" data-dev-name="hud.lap" aria-label="Runde ${cur} von ${total}">
      <span class="hud-lap__label">Runde</span>
      <span class="hud-lap__value"><strong data-dev-name="hud.lap.current">${cur}</strong><span class="hud-lap__sep">/</span><span data-dev-name="hud.lap.total">${total}</span></span>
    </div>
  `;
}

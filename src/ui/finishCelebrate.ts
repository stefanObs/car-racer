/** Finish-crossing celebration timing and UI copy (German, ages 10+). */

export type FinishCelebrate = {
  /** Elapsed seconds (derived from wall clock). */
  t: number;
  duration: number;
  place: number;
  startedAtMs: number;
};

export function isPodiumPlace(place: number): boolean {
  return place >= 1 && place <= 3;
}

/** Podium finishes get a longer comic burst; mid/back pack a shorter “im Ziel”. */
export function finishCelebrateDuration(place: number): number {
  return isPodiumPlace(place) ? 2.7 : 1.55;
}

export function createFinishCelebrate(place: number, startedAtMs = 0): FinishCelebrate {
  return {
    t: 0,
    duration: finishCelebrateDuration(place),
    place,
    startedAtMs,
  };
}

/** Advance celebrate using wall clock so headless/throttled rAF still completes. */
export function advanceFinishCelebrate(fx: FinishCelebrate, nowMs: number): void {
  if (!fx.startedAtMs) fx.startedAtMs = nowMs;
  fx.t = Math.max(0, (nowMs - fx.startedAtMs) / 1000);
}

export function finishCelebrateProgress(fx: FinishCelebrate): number {
  return Math.min(1, fx.t / Math.max(0.001, fx.duration));
}

export function finishOverlayHtml(fx: FinishCelebrate): string {
  const podium = isPodiumPlace(fx.place);
  const p = finishCelebrateProgress(fx);
  const flash = p < 0.18 ? 1 - p / 0.18 : Math.max(0, 1 - (p - 0.18) / 0.25);
  const title = podium ? podiumTitle(fx.place) : "IM ZIEL!";
  const sub = podium ? `Platz ${fx.place} — Podest!` : `Platz ${fx.place}`;
  const kind = podium ? "podium" : "field";
  return `
    <div class="finish-fx finish-fx--${kind}" data-dev-name="finish.overlay" style="--flash:${flash.toFixed(3)};--p:${p.toFixed(3)}">
      <div class="finish-fx__burst" aria-hidden="true"></div>
      <p class="finish-fx__title">${title}</p>
      <p class="finish-fx__sub">${sub}</p>
    </div>
  `;
}

function podiumTitle(place: number): string {
  if (place === 1) return "SIEG!";
  if (place === 2) return "PODEST!";
  return "PODEST!";
}

/** Results screen podium stands with landing anim on the player's place. */
export function resultsPodiumHtml(place: number): string {
  const podium = isPodiumPlace(place);
  const stands = [2, 1, 3]
    .map((n) => {
      const you = place === n;
      const medal = n === 1 ? "gold" : n === 2 ? "silver" : "bronze";
      return `<div class="podium-stand podium-stand--${n} podium-stand--${medal}${you ? " podium-stand--you" : ""}" data-dev-name="results.stand.${n}">
        <span class="podium-stand__rank">${n}</span>
        ${you ? `<span class="podium-stand__you">Du</span>` : ""}
      </div>`;
    })
    .join("");

  if (podium) {
    return `
      <div class="results-podium results-podium--land" data-dev-name="results.podium" data-place="${place}">
        <div class="podium-stands">${stands}</div>
        <p class="podium-caption">Platz ${place}</p>
      </div>
    `;
  }

  return `
    <div class="results-podium results-podium--field" data-dev-name="results.podium" data-place="${place}">
      <div class="podium-stands podium-stands--dim">${stands}</div>
      <p class="podium-caption podium-caption--field land-field">Platz ${place}</p>
    </div>
  `;
}

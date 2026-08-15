/** Finish-crossing celebration timing and UI copy (German, ages 10+). */

import {
  podiumMovieDuration,
  podiumMovieHeroSrc,
  podiumMovieHtml,
  podiumMovieKind,
  podiumMovieSub,
  podiumMovieTitle,
} from "./podiumMovie";

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

/** Podium: ~7.5s 2D movie; field: short disappointed beat. */
export function finishCelebrateDuration(place: number): number {
  return podiumMovieDuration(place);
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
  const kind = podiumMovieKind(fx.place);
  const p = finishCelebrateProgress(fx);
  const flash = p < 0.12 ? 1 - p / 0.12 : Math.max(0, 1 - (p - 0.12) / 0.2);
  const title = podiumMovieTitle(fx.place);
  const sub = podiumMovieSub(fx.place);
  return `
    <div
      class="finish-fx finish-fx--movie finish-fx--${kind}"
      data-dev-name="finish.overlay"
      data-place="${fx.place}"
      style="--flash:${flash.toFixed(3)};--p:${p.toFixed(3)}"
    >
      <div class="finish-fx__burst" aria-hidden="true"></div>
      ${podiumMovieHtml(fx.place)}
      <p class="finish-fx__sr-only">${title} — ${sub}</p>
    </div>
  `;
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

  const still = podiumMovieHeroSrc(place);
  if (podium) {
    return `
      <div class="results-podium results-podium--land" data-dev-name="results.podium" data-place="${place}">
        <img class="results-still" src="${still}" alt="" />
        <div class="podium-stands">${stands}</div>
        <p class="podium-caption">${podiumMovieTitle(place)} · Platz ${place}</p>
      </div>
    `;
  }

  return `
    <div class="results-podium results-podium--field" data-dev-name="results.podium" data-place="${place}">
      <img class="results-still results-still--field" src="${still}" alt="" />
      <div class="podium-stands podium-stands--dim">${stands}</div>
      <p class="podium-caption podium-caption--field land-field">SCHADE! · Platz ${place}</p>
    </div>
  `;
}

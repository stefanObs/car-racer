/** Finish-crossing celebration UI copy (German, ages 10+). Timing lives in `core/finishCelebrate`. */

import { finishCelebrateProgress, isPodiumPlace, type FinishCelebrate } from "../core/finishCelebrate";
import {
  podiumMovieHeroSrc,
  podiumMovieHtml,
  podiumMovieKind,
  podiumMovieSub,
  podiumMovieTitle,
} from "./podiumMovie";

export type { FinishCelebrate } from "../core/finishCelebrate";
export {
  TRAINING_FINISH_SECONDS,
  advanceFinishCelebrate,
  createFinishCelebrate,
  finishCelebrateDuration,
  finishCelebrateProgress,
  isPodiumPlace,
} from "../core/finishCelebrate";

export function finishOverlayHtml(fx: FinishCelebrate): string {
  if (!fx.ranked) {
    return `
    <div
      class="finish-fx finish-fx--training"
      data-dev-name="finish.overlay"
      data-ranked="0"
    >
      <p class="finish-fx__training">Ziel!</p>
    </div>`;
  }
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

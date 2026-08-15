/** Finish-crossing celebration timing (DOM-free). HTML lives in `ui/finishCelebrate`. */

export type FinishCelebrate = {
  /** Elapsed seconds (derived from wall clock). */
  t: number;
  duration: number;
  place: number;
  startedAtMs: number;
  /** False for Training: short Ziel flash, no podium movie. */
  ranked: boolean;
};

export const TRAINING_FINISH_SECONDS = 1.2;
export const PODIUM_CELEBRATE_SECONDS = 7.5;
export const FIELD_CELEBRATE_SECONDS = 2.5;

export function isPodiumPlace(place: number): boolean {
  return place >= 1 && place <= 3;
}

/** Podium: ~7.5s 2D movie; field: short disappointed beat. */
export function finishCelebrateDuration(place: number): number {
  return isPodiumPlace(place) ? PODIUM_CELEBRATE_SECONDS : FIELD_CELEBRATE_SECONDS;
}

export function createFinishCelebrate(
  place: number,
  startedAtMs = 0,
  opts?: { ranked?: boolean },
): FinishCelebrate {
  const ranked = opts?.ranked !== false;
  return {
    t: 0,
    duration: ranked ? finishCelebrateDuration(place) : TRAINING_FINISH_SECONDS,
    place: ranked ? place : 0,
    startedAtMs,
    ranked,
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

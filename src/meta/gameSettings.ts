/** Player preferences (non-save meta) — localStorage. */

export type GameSettings = {
  /** Auto full throttle unless braking — optional assist for younger players. */
  easyMode: boolean;
  /** Restore pre–Fast-KO wall/obstacle hits (CONCEPT §7.4). */
  lowDamageMode: boolean;
};

const KEY = "crash-circuit-settings-v1";

const DEFAULTS: GameSettings = { easyMode: false, lowDamageMode: false };

export function loadGameSettings(): GameSettings {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      easyMode: Boolean(parsed.easyMode),
      lowDamageMode: Boolean(parsed.lowDamageMode),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeGameSettings(settings: GameSettings): void {
  storage()?.setItem(
    KEY,
    JSON.stringify({
      easyMode: Boolean(settings.easyMode),
      lowDamageMode: Boolean(settings.lowDamageMode),
    }),
  );
}

/** Easy mode: full throttle unless the player is braking. */
export function applyEasyModeThrottle(throttle: number, brake: number, easyMode: boolean): number {
  if (!easyMode) return throttle;
  if (brake > 0.05) return throttle;
  return Math.max(throttle, 1);
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

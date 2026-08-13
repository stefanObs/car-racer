export type AudioSettings = {
  muted: boolean;
  /** Master gain 0..1 */
  volume: number;
};

const KEY = "crash-circuit-audio-v1";

const DEFAULTS: AudioSettings = { muted: false, volume: 0.7 };

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: Boolean(parsed.muted),
      volume: clamp01(typeof parsed.volume === "number" ? parsed.volume : DEFAULTS.volume),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeAudioSettings(settings: AudioSettings): void {
  storage()?.setItem(
    KEY,
    JSON.stringify({
      muted: settings.muted,
      volume: clamp01(settings.volume),
    }),
  );
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

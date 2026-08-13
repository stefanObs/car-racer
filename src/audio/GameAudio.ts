import { ALL_SFX_IDS, SFX_URLS, type SfxId } from "./catalog";
import { loadAudioSettings, writeAudioSettings, type AudioSettings } from "./settings";

type PlayOpts = {
  volume?: number;
  playbackRate?: number;
};

/**
 * Web Audio SFX bus — unlocks on first gesture, respects mute/volume settings.
 * TECH.md: Howler **or** Web Audio; we use native Web Audio (zero deps).
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SfxId, AudioBuffer>();
  private settings: AudioSettings = loadAudioSettings();
  private engine: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private unlocked = false;
  private loadPromise: Promise<void> | null = null;
  private lastOneShotAt = new Map<SfxId, number>();

  get muted(): boolean {
    return this.settings.muted;
  }

  get volume(): number {
    return this.settings.volume;
  }

  /** Bind unlock + mute persistence once at boot. */
  installGestureUnlock(target: Window | Document = window): void {
    const unlock = () => {
      void this.ensureRunning();
    };
    target.addEventListener("pointerdown", unlock, { once: true, capture: true });
    target.addEventListener("keydown", unlock, { once: true, capture: true });
  }

  preload(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.loadAll();
    return this.loadPromise;
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    writeAudioSettings(this.settings);
    this.applyMasterGain();
    if (muted) this.stopEngine();
  }

  toggleMute(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    writeAudioSettings(this.settings);
    this.applyMasterGain();
  }

  play(id: SfxId, opts: PlayOpts = {}): void {
    if (this.settings.muted) return;
    const buf = this.buffers.get(id);
    if (!buf || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const minGap = id.startsWith("ui") ? 0.04 : 0.08;
    const last = this.lastOneShotAt.get(id) ?? -Infinity;
    if (now - last < minGap) return;
    this.lastOneShotAt.set(id, now);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.playbackRate ?? 1;
    const g = this.ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  playUiClick(): void {
    this.play("uiClick", { volume: 0.55 });
  }

  playUiConfirm(): void {
    this.play("uiConfirm", { volume: 0.65 });
  }

  playUiNav(): void {
    this.play("uiNav", { volume: 0.35 });
  }

  playUiBuy(): void {
    this.play("uiBuy", { volume: 0.7 });
  }

  /** Keep a pitched engine loop in sync with player speed (m/s-ish arcade units). */
  syncEngine(active: boolean, speed: number, nitro: boolean): void {
    if (this.settings.muted || !active) {
      this.stopEngine();
      return;
    }
    if (!this.ctx || !this.master) return;
    const buf = this.buffers.get("engineLoop");
    if (!buf) return;

    if (!this.engine) {
      const source = this.ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.master);
      source.start();
      this.engine = { source, gain };
    }

    const t = this.ctx.currentTime;
    const rate = 0.72 + Math.min(1.55, speed / 28) * 0.85 + (nitro ? 0.12 : 0);
    const vol = 0.12 + Math.min(0.55, speed / 32) * 0.5 + (nitro ? 0.08 : 0);
    this.engine.source.playbackRate.setTargetAtTime(rate, t, 0.08);
    this.engine.gain.gain.setTargetAtTime(vol, t, 0.06);
  }

  stopEngine(): void {
    if (!this.engine) return;
    try {
      this.engine.source.stop();
    } catch {
      /* already stopped */
    }
    this.engine.source.disconnect();
    this.engine.gain.disconnect();
    this.engine = null;
  }

  private async ensureRunning(): Promise<void> {
    await this.preload();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }
    this.unlocked = this.ctx.state === "running";
  }

  private applyMasterGain(): void {
    if (!this.master || !this.ctx) return;
    const v = this.settings.muted ? 0 : this.settings.volume;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private async loadAll(): Promise<void> {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
    this.master.connect(this.ctx.destination);

    await Promise.all(
      ALL_SFX_IDS.map(async (id) => {
        try {
          const res = await fetch(SFX_URLS[id]);
          if (!res.ok) return;
          const raw = await res.arrayBuffer();
          const buf = await this.ctx!.decodeAudioData(raw.slice(0));
          this.buffers.set(id, buf);
        } catch (err) {
          console.warn(`[audio] skip ${id}`, err);
        }
      }),
    );
  }

  /** Test helper — buffer presence without needing a live race. */
  loadedCount(): number {
    return this.buffers.size;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }
}

/** Shared singleton used by UI + race. */
export const gameAudio = new GameAudio();

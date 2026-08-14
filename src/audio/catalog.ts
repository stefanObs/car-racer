/** One-shot and loop sample IDs shipped under `/audio/`. */
export type SfxId =
  | "uiClick"
  | "uiConfirm"
  | "uiNav"
  | "uiBuy"
  | "engineLoop"
  | "nitro"
  | "wallHit"
  | "wallHitHard"
  | "contact"
  | "ko"
  | "lap"
  | "finish"
  | "shield"
  | "style"
  | "wrongWay";

export const SFX_URLS: Record<SfxId, string> = {
  uiClick: "/audio/ui-click.wav",
  uiConfirm: "/audio/ui-confirm.wav",
  uiNav: "/audio/ui-nav.wav",
  uiBuy: "/audio/ui-buy.wav",
  engineLoop: "/audio/engine-loop.wav",
  nitro: "/audio/nitro.wav",
  wallHit: "/audio/wall-hit.ogg",
  wallHitHard: "/audio/wall-hit-hard.ogg",
  contact: "/audio/contact.ogg",
  ko: "/audio/ko.ogg",
  lap: "/audio/lap.ogg",
  finish: "/audio/finish.ogg",
  shield: "/audio/shield.ogg",
  style: "/audio/style.ogg",
  wrongWay: "/audio/wrong-way.ogg",
};

export const ALL_SFX_IDS = Object.keys(SFX_URLS) as SfxId[];

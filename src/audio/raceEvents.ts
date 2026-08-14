/** Discrete race SFX cues emitted by `RaceSession` (player-centric). */
export type RaceAudioEvent =
  | { kind: "wall"; hard: boolean }
  | { kind: "contact" }
  | { kind: "lap" }
  | { kind: "finish" }
  | { kind: "ko" }
  | { kind: "shield" }
  | { kind: "nitro" }
  | { kind: "style" }
  | { kind: "wrongWay" }
  | { kind: "countdown"; phase: "3" | "2" | "1" | "GO" };

export function playRaceAudioEvent(
  audio: { play: (id: import("./catalog").SfxId, opts?: { volume?: number; playbackRate?: number }) => void },
  ev: RaceAudioEvent,
): void {
  switch (ev.kind) {
    case "wall":
      audio.play(ev.hard ? "wallHitHard" : "wallHit", { volume: ev.hard ? 0.85 : 0.65 });
      break;
    case "contact":
      audio.play("contact", { volume: 0.7, playbackRate: 0.95 + Math.random() * 0.1 });
      break;
    case "lap":
      audio.play("lap", { volume: 0.75 });
      break;
    case "finish":
      audio.play("finish", { volume: 0.9 });
      break;
    case "ko":
      audio.play("ko", { volume: 0.85 });
      break;
    case "shield":
      audio.play("shield", { volume: 0.7 });
      break;
    case "nitro":
      audio.play("nitro", { volume: 0.8, playbackRate: 1.05 });
      break;
    case "style":
      audio.play("style", { volume: 0.45, playbackRate: 1.1 });
      break;
    case "wrongWay":
      audio.play("wrongWay", { volume: 0.55 });
      break;
    case "countdown":
      if (ev.phase === "GO") audio.play("uiConfirm", { volume: 0.9 });
      else audio.play("uiClick", { volume: 0.75, playbackRate: 0.9 + Number(ev.phase) * 0.05 });
      break;
  }
}

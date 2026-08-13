/** @vitest-environment happy-dom */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { ALL_SFX_IDS, SFX_URLS } from "../src/audio/catalog";
import { playRaceAudioEvent, type RaceAudioEvent } from "../src/audio/raceEvents";
import { loadAudioSettings, writeAudioSettings } from "../src/audio/settings";
import { CUP_LEVELS } from "../src/data/levels";
import { RaceSession } from "../src/sim/race";
import { renderGarageHtml } from "../src/ui/garageHtml";
import { emptyKit } from "../src/meta/save";

describe("audio catalog", () => {
  it("ships every catalogued sample under public/audio", () => {
    for (const id of ALL_SFX_IDS) {
      const url = SFX_URLS[id];
      expect(url.startsWith("/audio/")).toBe(true);
      const file = join(process.cwd(), "public", url.replace(/^\//, ""));
      expect(existsSync(file), `missing ${file}`).toBe(true);
    }
  });
});

describe("audio settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists mute and volume", () => {
    writeAudioSettings({ muted: true, volume: 0.4 });
    expect(loadAudioSettings()).toEqual({ muted: true, volume: 0.4 });
  });
});

describe("race audio events", () => {
  it("emits finish when the player is force-finished", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#e03131",
      playerSticker: "none",
    });
    race.forceFinishAs(1);
    const kinds = race.consumeAudioEvents().map((e) => e.kind);
    expect(kinds).toContain("finish");
  });

  it("maps event kinds to SFX ids", () => {
    const played: string[] = [];
    const audio = {
      play(id: string) {
        played.push(id);
      },
    };
    const events: RaceAudioEvent[] = [
      { kind: "wall", hard: false },
      { kind: "wall", hard: true },
      { kind: "contact" },
      { kind: "nitro" },
      { kind: "lap" },
      { kind: "shield" },
      { kind: "ko" },
      { kind: "finish" },
      { kind: "style" },
      { kind: "wrongWay" },
    ];
    for (const ev of events) playRaceAudioEvent(audio, ev);
    expect(played).toEqual([
      "wallHit",
      "wallHitHard",
      "contact",
      "nitro",
      "lap",
      "shield",
      "ko",
      "finish",
      "style",
      "wrongWay",
    ]);
  });
});

describe("garage mute control", () => {
  it("renders Ton an/aus toggle", () => {
    const on = renderGarageHtml({
      chf: 100,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
      muted: false,
    });
    expect(on).toContain('data-act="toggle-mute"');
    expect(on).toContain("Ton an");
    const off = renderGarageHtml({
      chf: 100,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
      muted: true,
    });
    expect(off).toContain("Ton aus");
  });
});

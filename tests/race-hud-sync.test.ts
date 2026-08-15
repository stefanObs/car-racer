/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { RaceSession } from "../src/sim/race";
import { renderRaceHudHtml, syncRaceHud } from "../src/ui/raceHud";
import { StylePopupQueue } from "../src/ui/stylePopups";

describe("race HUD DOM patch", () => {
  it("rebuilds an empty host then patches place without dropping the cluster", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#E03131",
      playerSticker: "none",
    });
    race.clearStartCountdown();
    const host = document.createElement("div");
    const pops = new StylePopupQueue();
    syncRaceHud(host, race, pops, 0);
    const cluster = host.querySelector(".hud-cluster");
    expect(cluster).toBeTruthy();
    expect(host.innerHTML).toContain("Platz ");

    race.player().place = 4;
    race.player().hp = 0.4;
    syncRaceHud(host, race, pops, 16);
    expect(host.querySelector(".hud-cluster")).toBe(cluster);
    expect(host.querySelector('[data-dev-name="hud.place"]')?.textContent).toContain("Platz 4");
    expect(host.querySelector<HTMLElement>('[data-dev-name="hud.hp"] i.hp')?.style.width).toBe("40%");
  });

  it("keeps the countdown node and updates the label in place", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#E03131",
      playerSticker: "none",
    });
    const host = document.createElement("div");
    const pops = new StylePopupQueue();
    syncRaceHud(host, race, pops, 0);
    const node = host.querySelector("[data-dev-name='hud.countdown']");
    const label = host.querySelector(".race-countdown__label");
    expect(label?.textContent).toBe("3");
    race.step(1.1, { throttle: 0, brake: 0, steer: 0, nitro: false });
    syncRaceHud(host, race, pops, 16);
    expect(host.querySelector("[data-dev-name='hud.countdown']")).toBe(node);
    expect(label?.textContent).toBe("2");
  });

  it("falls back to a full render when the shell is missing", () => {
    const race = new RaceSession({
      level: CUP_LEVELS[0]!,
      playerCarId: "blitz",
      playerParts: [],
      playerPaint: "#E03131",
      playerSticker: "none",
    });
    const host = document.createElement("div");
    host.innerHTML = "<span>stale</span>";
    syncRaceHud(host, race, new StylePopupQueue(), 0);
    expect(host.querySelector(".hud-cluster")).toBeTruthy();
    expect(host.innerHTML).not.toContain("stale");
    expect(renderRaceHudHtml(race, new StylePopupQueue(), 0)).toContain("hud.cluster");
  });
});

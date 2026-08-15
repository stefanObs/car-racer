import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { RaceSession } from "../src/sim/race";
import { sampleCenterline } from "../src/track/buildTrack";
import { renderFieldStripSvg, renderMiniMapSvg, trackBounds, fieldProgress01 } from "../src/ui/miniMap";
import { renderNitroMeterHtml } from "../src/ui/nitroHud";
import { renderDamageHudHtml } from "../src/ui/damageHud";
import { NITRO_ENGAGE_MIN } from "../src/sim/vehicle";
import { StylePopupQueue } from "../src/ui/stylePopups";

function makeRace(): RaceSession {
  return new RaceSession({
    level: CUP_LEVELS[0]!,
    playerCarId: "blitz",
    playerParts: [],
    playerPaint: "#E03131",
    playerSticker: "none",
  });
}

function placeCar(race: RaceSession, carId: string, along: number): void {
  const car = race.cars.find((c) => c.id === carId)!;
  const s = sampleCenterline(race.track, along);
  car.x = s.position.x;
  car.z = s.position.z;
  car.heading = Math.atan2(s.tangent.z, s.tangent.x);
  car.distanceAlong = along;
  car.progress = along + (car.lap - 1) * race.track.totalLength;
  car.speed = 0;
}

describe("race HUD UI (CONCEPT §9)", () => {
  it("builds a mini-map SVG with track, player DU, and every rival", () => {
    const race = makeRace();
    const b = trackBounds(race);
    expect(b.maxX).toBeGreaterThan(b.minX);
    const svg = renderMiniMapSvg(race);
    expect(svg).toContain("<svg");
    expect(svg).toContain("polygon");
    expect(svg).toContain(">DU<");
    expect(svg).toContain('data-player="1"');
    expect(svg).toContain('data-start="1"');
    expect(svg).toContain("#4A4F57");
    expect(svg).toContain("#2f6f9e");
    expect(svg).toContain('data-dev-name="hud.minimap"');
    const rivals = race.cars.filter((c) => !c.isPlayer);
    expect(rivals.length).toBeGreaterThan(0);
    for (const c of rivals) {
      expect(svg).toContain(`data-car="${c.id}"`);
    }
    expect((svg.match(/<circle /g) ?? []).length).toBe(rivals.length);
  });

  it("field strip places a leading car to the right of the player", () => {
    const race = makeRace();
    const len = race.track.totalLength;
    placeCar(race, "player", 10);
    const rival = race.cars.find((c) => !c.isPlayer)!;
    placeCar(race, rival.id, len * 0.6);
    race.player().progress = 10;
    rival.progress = len * 0.6;
    expect(fieldProgress01(rival, race)).toBeGreaterThan(fieldProgress01(race.player(), race));
    const svg = renderFieldStripSvg(race);
    expect(svg).toContain('data-dev-name="hud.field-strip"');
    expect(svg).toContain(">DU<");
    const playerProg = Number(svg.match(/data-car="player"[^>]*data-progress="([\d.]+)"/)?.[1]);
    const rivalProg = Number(svg.match(new RegExp(`data-car="${rival.id}"[^>]*data-progress="([\\d.]+)"`))?.[1]);
    expect(playerProg).toBeLessThan(rivalProg);
  });

  it("renders floating style popups with CHF amount", () => {
    const q = new StylePopupQueue(1000);
    q.push(50, "Überholt!", 1000);
    const html = q.renderHtml(1100);
    expect(html).toContain("+50 CHF");
    expect(html).toContain("Überholt!");
    expect(q.active(2500)).toHaveLength(0);
  });

  it("emits style events when the player overtakes", () => {
    const race = makeRace();
    const len = race.track.totalLength;
    placeCar(race, "player", 10);
    race.cars.filter((c) => !c.isPlayer).forEach((c, i) => placeCar(race, c.id, len * 0.35 + i * 3));
    race.clearStartCountdown();
    race.step(0.016, { throttle: 0, brake: 0, steer: 0, nitro: false });
    race.consumeStyleEvents();
    expect(race.player().place).toBeGreaterThan(1);

    placeCar(race, "player", len * 0.55);
    race.cars.filter((c) => !c.isPlayer).forEach((c, i) => placeCar(race, c.id, 15 + i * 3));
    race.step(0.016, { throttle: 0, brake: 0, steer: 0, nitro: false });
    const events = race.consumeStyleEvents();
    expect(events.some((e) => e.reason === "Überholt!" && e.amount > 0)).toBe(true);
    expect(race.styleBonus).toBeGreaterThan(0);
    expect(race.styleBonus).toBeLessThanOrEqual(120);
  });

  it("damage HUD shows Comeback seconds while K.O.", () => {
    expect(renderDamageHudHtml(0, 3, 0)).toContain("K.O. · Comeback 3");
    expect(renderDamageHudHtml(0.4, 0, 0.5)).toContain("Reparatur");
  });

  it("nitro meter shows the engage mark and dim fill below it", () => {
    const low = renderNitroMeterHtml(NITRO_ENGAGE_MIN - 0.1, false);
    const ready = renderNitroMeterHtml(NITRO_ENGAGE_MIN, false);
    const boost = renderNitroMeterHtml(0.2, true);
    expect(low).toContain("is-low");
    expect(low).toContain('data-dev-name="hud.nitro"');
    expect(low).toContain(`left:${Math.round(NITRO_ENGAGE_MIN * 100)}%`);
    expect(ready).toContain("is-ready");
    expect(boost).toContain("is-boost");
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/ui/styles.css"), "utf8");
    expect(css).toContain(".bar-min");
    expect(css).toContain(".bar--nitro.is-low");
  });

  it("pins the race HUD overlay to the viewport so the course map is not under settings", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/ui/styles.css"), "utf8");
    const hud = css.match(/\.race-hud\s*\{[^}]+\}/)?.[0] ?? "";
    expect(hud).toContain("position: absolute");
    expect(hud).toContain("inset: 0");
    const map = css.match(/\.hud-minimap\s*\{[^}]+\}/)?.[0] ?? "";
    expect(map).toContain("bottom:");
    expect(map).not.toMatch(/^\s*top:/m);
    const chrome = css.match(/\.race-mute,\s*\n\.race-settings\s*\{[^}]+\}/)?.[0] ?? "";
    expect(chrome).toContain("top:");
  });
});

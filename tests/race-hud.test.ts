import { describe, expect, it } from "vitest";
import { CUP_LEVELS } from "../src/data/levels";
import { RaceSession } from "../src/sim/race";
import { sampleCenterline } from "../src/track/buildTrack";
import { renderMiniMapSvg, trackBounds } from "../src/ui/miniMap";
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
  it("builds a mini-map SVG with track and player marker", () => {
    const race = makeRace();
    const b = trackBounds(race);
    expect(b.maxX).toBeGreaterThan(b.minX);
    const svg = renderMiniMapSvg(race, 128);
    expect(svg).toContain("<svg");
    expect(svg).toContain("polygon");
    expect(svg).toContain("#4A4F57");
    expect(svg).toContain("#2f6f9e"); // harbor basin infield on mini-map
    expect(svg).toContain('data-dev-name="hud.minimap"');
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
});

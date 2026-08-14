import { describe, expect, it } from "vitest";
import { displayLap, formatLapCounter, renderLapCounterHtml } from "../src/ui/lapHud";

describe("lap counter HUD", () => {
  it("formats current lap over total laps", () => {
    expect(formatLapCounter(1, 3)).toBe("1 / 3");
    expect(formatLapCounter(2, 2)).toBe("2 / 2");
  });

  it("clamps display lap only on finish overrun; negatives stay visible", () => {
    expect(displayLap(4, 3)).toBe(3);
    expect(displayLap(0, 3)).toBe(0);
    expect(displayLap(-2, 3)).toBe(-2);
    expect(displayLap(2, 3)).toBe(2);
  });

  it("renders a dedicated lap block with current and total", () => {
    const html = renderLapCounterHtml(2, 3);
    expect(html).toContain('data-dev-name="hud.lap"');
    expect(html).toContain('data-dev-name="hud.lap.current">2');
    expect(html).toContain('data-dev-name="hud.lap.total">3');
    expect(html).toContain("Runde");
    expect(html).toContain('aria-label="Runde 2 von 3"');
  });

  it("renders negative lap values in the HUD", () => {
    const html = renderLapCounterHtml(-1, 5);
    expect(html).toContain('data-dev-name="hud.lap.current">-1');
    expect(html).toContain('aria-label="Runde -1 von 5"');
  });
});

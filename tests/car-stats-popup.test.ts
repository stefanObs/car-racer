import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import { carStatLevels, levelTone, toStatLevel } from "../src/ui/carStatLevels";
import { renderCarStatsPopup } from "../src/ui/carStatsPopup";

describe("car stat level bars", () => {
  it("maps values into 1–100 inclusive", () => {
    expect(toStatLevel(0.35, 0.35, 2.2)).toBe(1);
    expect(toStatLevel(2.2, 0.35, 2.2)).toBe(100);
    expect(toStatLevel(1.0, 0.35, 2.2)).toBeGreaterThan(30);
    expect(toStatLevel(1.0, 0.35, 2.2)).toBeLessThan(50);
  });

  it("builds eight concept pillars for every car", () => {
    const rows = carStatLevels(mergeStats(CARS.blitz.stats, []));
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.label)).toEqual([
      "Beschleunigung",
      "Tempo",
      "Grip",
      "Handling",
      "Federung",
      "Panzerung",
      "Gewicht",
      "Nitro",
    ]);
    for (const row of rows) {
      expect(row.level).toBeGreaterThanOrEqual(1);
      expect(row.level).toBeLessThanOrEqual(100);
    }
  });

  it("tones bars by level band", () => {
    expect(levelTone(20)).toBe("low");
    expect(levelTone(55)).toBe("mid");
    expect(levelTone(80)).toBe("high");
  });

  it("renders a top-right popup with meters and car name", () => {
    const html = renderCarStatsPopup({ carId: "bunker", equippedParts: [] });
    expect(html).toContain('data-dev-name="garage.stats.popup"');
    expect(html).toContain("Bunker");
    expect(html).toContain("Panzerwagen");
    expect(html).toContain('role="meter"');
    expect(html).toContain("stat-bar__fill");
    expect(html).toContain("Eigenschaften");
  });

  it("reflects equipped parts in levels (big engine raises accel)", () => {
    const base = carStatLevels(mergeStats(CARS.blitz.stats, []));
    const tuned = carStatLevels(mergeStats(CARS.blitz.stats, ["big_engine"]));
    const accelBase = base.find((r) => r.key === "accel")!.level;
    const accelTuned = tuned.find((r) => r.key === "accel")!.level;
    expect(accelTuned).toBeGreaterThan(accelBase);
  });
});

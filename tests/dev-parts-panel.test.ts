import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allPartsForCar, renderDevPartsPanelHtml, toggleEquippedPart } from "../src/dev/partsPanel";
import { carStateLookKey } from "../src/render/carLookKey";

describe("F5 Teile panel", () => {
  it("toggles a Teil on and off for the current car", () => {
    expect(toggleEquippedPart("blitz", [], "big_engine")).toEqual(["big_engine"]);
    expect(toggleEquippedPart("blitz", ["big_engine"], "big_engine")).toEqual([]);
    expect(toggleEquippedPart("blitz", [], "better_brakes")).toEqual([]);
  });

  it("lists every shop Teil for that car and marks equipped ones", () => {
    const html = renderDevPartsPanelHtml("blitz", ["nitro_kit"]);
    expect(html).toContain("Dev: Teile");
    expect(html).toContain("nur dieses Rennen");
    expect(html).toContain("data-dev-part=\"nitro_kit\"");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("data-dev-parts-none");
    expect(html).toContain("data-dev-parts-all");
    expect(html).not.toContain("data-dev-part=\"better_brakes\"");
    for (const id of allPartsForCar("blitz")) {
      expect(html).toContain(`data-dev-part="${id}"`);
    }
  });

  it("changes the race-car look key when Teile change so the mesh rebuilds", () => {
    const stock = carStateLookKey({
      modelId: "blitz",
      paint: "#E03131",
      sticker: "none",
      equippedParts: [],
    });
    const motor = carStateLookKey({
      modelId: "blitz",
      paint: "#E03131",
      sticker: "none",
      equippedParts: ["big_engine"],
    });
    expect(motor).not.toBe(stock);
  });

  it("docks the panel away from the mini-map", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/ui/styles.css"), "utf8");
    const block = css.match(/\.dev-dialog--parts\s*\{[^}]+\}/)?.[0] ?? "";
    expect(block).toContain("bottom:");
    expect(block).toContain("left:");
  });
});

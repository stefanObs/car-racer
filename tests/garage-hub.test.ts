import { describe, expect, it } from "vitest";
import { emptyKit } from "../src/meta/save";
import { buildGarageBay } from "../src/render/garageBay";
import { renderGarageHtml } from "../src/ui/garageHtml";

describe("garage hub", () => {
  it("renders equip-first layout with race CTAs", () => {
    const kit = emptyKit("blitz");
    kit.ownedParts = ["big_engine"];
    kit.equippedParts = ["big_engine"];
    const html = renderGarageHtml({
      chf: 900,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit,
    });
    expect(html).toContain("Garage");
    expect(html).toContain("Ausrüsten");
    expect(html).toContain("Ablegen");
    expect(html).toContain("Kaufen");
    expect(html).toContain('data-act="cup"');
    expect(html).toContain("Laden");
    expect(html).toContain("is-on");
    const equipAt = html.indexOf("Ausrüsten");
    const paintAt = html.indexOf("Schmücken");
    expect(equipAt).toBeGreaterThan(-1);
    expect(paintAt).toBeGreaterThan(equipAt);
  });

  it("shows shop buy label for unowned parts", () => {
    const html = renderGarageHtml({
      chf: 50,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
    });
    expect(html).toContain("Noch keine Teile");
    expect(html).toContain("Kaufen");
  });

  it("builds a named comic garage bay group", () => {
    const bay = buildGarageBay();
    expect(bay.name).toBe("garageBay");
    expect(bay.children.length).toBeGreaterThan(20);
  });

  it("renders five category cars in the garage roster", () => {
    const html = renderGarageHtml({
      chf: 5000,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
    });
    expect(html).toContain("Blitz");
    expect(html).toContain("Bison");
    expect(html).toContain("Käferkraft");
    expect(html).toContain("Donnerbüchse");
    expect(html).toContain("Bunker");
  });
});

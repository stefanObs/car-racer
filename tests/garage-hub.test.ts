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

  it("marks an unowned car as Vorschau with a Kaufen button (no instant buy)", () => {
    const html = renderGarageHtml({
      chf: 5000,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
      previewCar: "bison",
    });
    expect(html).toContain("garage-preview-banner");
    expect(html).toContain("Vorschau");
    expect(html).toContain('data-act="buy-car"');
    expect(html).toContain("Kaufen");
    expect(html).toContain("is-preview");
    expect(html).toContain("Erst kaufen");
    expect(html).toContain("Bison");
    expect(html).not.toContain("Ablegen");
  });

  it("disables Kaufen when the purse cannot cover the car", () => {
    const html = renderGarageHtml({
      chf: 10,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
      previewCar: "bison",
    });
    expect(html).toMatch(/data-act="buy-car"[^>]*disabled/);
  });

  it("shows buggy nose options and bunker IronClad door sticker", () => {
    const buggy = renderGarageHtml({
      chf: 2000,
      activeCar: "kaeferkraft",
      ownedCars: ["kaeferkraft"],
      kit: emptyKit("kaeferkraft"),
    });
    expect(buggy).toContain("Nase / Kopf");
    expect(buggy).toContain("Totenkopf");
    expect(buggy).toContain("Vogel");
    expect(buggy).toContain("Hund");
    expect(buggy).toContain("Glatt");
    expect(emptyKit("kaeferkraft").sticker).toBe("none");

    const bunker = renderGarageHtml({
      chf: 5000,
      activeCar: "bunker",
      ownedCars: ["bunker"],
      kit: emptyKit("bunker"),
    });
    expect(bunker).toContain("Tür-Aufkleber");
    expect(bunker).toContain("IronClad");
    expect(emptyKit("bunker").sticker).toBe("ironClad");
  });
});

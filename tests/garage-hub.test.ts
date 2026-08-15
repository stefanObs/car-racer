import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { emptyKit } from "../src/meta/save";
import { buildGarageBay, GARAGE_PAD_CENTER, garagePadDeckY } from "../src/render/garageBay";
import { CAR_PAINT_BLACK } from "../src/render/palette";
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
    expect(html).toContain('data-dev-name="garage.settings"');
    expect(html).toContain("Mit KI erstellt · menschliche Anleitung");
    expect(html).toContain("Bestand — nur Blitz");
    expect(html).toContain("Ablegen");
    expect(html).toContain("Anschauen");
    expect(html).toContain('data-act="cup"');
    expect(html.indexOf('data-act="open-settings"')).toBeLessThan(html.indexOf('data-act="cup"'));
    expect(html).toContain('data-act="training"');
    expect(html).toContain("Laden");
    expect(html).toContain("is-on");
    const equipAt = html.indexOf("Ausrüsten");
    const paintAt = html.indexOf("Schmücken");
    expect(equipAt).toBeGreaterThan(-1);
    expect(paintAt).toBeGreaterThan(equipAt);
    expect(html).toContain(`data-color="${CAR_PAINT_BLACK}"`);
  });

  it("shows shop parts as Anschauen preview, then a buy CTA", () => {
    const html = renderGarageHtml({
      chf: 50,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
    });
    expect(html).toContain("Noch keine Teile");
    expect(html).toContain("Anschauen");
    expect(html).toContain("Tippen = Vorschau am Auto");

    const preview = renderGarageHtml({
      chf: 50,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
      previewPart: "big_engine",
    });
    expect(preview).toContain("Teil-Vorschau");
    expect(preview).toContain('data-act="buy-part"');
    expect(preview).toContain("is-preview");
    expect(preview).toMatch(/data-act="buy-part"[^>]*disabled/);
  });

  it("idle showcase sits cars on the pad deck via tire contact (not FX Box3)", () => {
    const src = readFileSync("src/render/garagePresenter.ts", "utf8");
    expect(src).toContain("garagePadDeckY");
    expect(src).toContain("garagePadContactSnapDelta");
    expect(src).toContain("carBodyWorldCenter");
    expect(src).toContain("seatGarageGroundBlob");
    expect(src).not.toContain("position.set(1.5, 0.12, 0)");
    expect(src).not.toMatch(/Box3\(\)\.setFromObject\(visual\.root\)/);
  });

  it("builds a named comic garage bay with a pad deck above the floor", () => {
    const bay = buildGarageBay();
    expect(bay.name).toBe("garageBay");
    expect(bay.children.length).toBeGreaterThan(20);
    const pad = bay.getObjectByName("garagePad");
    expect(pad).toBeTruthy();
    expect(pad!.position.x).toBe(GARAGE_PAD_CENTER.x);
    expect(pad!.position.z).toBe(GARAGE_PAD_CENTER.z);
    expect(bay.getObjectByName("garageStock")).toBeTruthy();
    const deck = garagePadDeckY(pad!);
    expect(deck).toBeGreaterThan(0.12);
    expect(deck).toBeLessThan(0.6);
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

  it("shows locked paints/stickers and a buy CTA while previewing cosmetics", () => {
    const kit = emptyKit("blitz");
    const html = renderGarageHtml({
      chf: 200,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit,
      previewPaint: "#339af0",
      previewSticker: "flames",
    });
    expect(html).toContain("is-locked");
    expect(html).toContain("Lack-Vorschau");
    expect(html).toContain('data-act="buy-paint"');
    expect(html).toContain("Aufkleber-Vorschau");
    expect(html).toContain('data-act="buy-sticker"');
    expect(html).toContain("Tippen = Vorschau");
  });

  it("disables cosmetic buy when the purse cannot cover the price", () => {
    const html = renderGarageHtml({
      chf: 10,
      activeCar: "blitz",
      ownedCars: ["blitz"],
      kit: emptyKit("blitz"),
      previewPaint: "#339af0",
    });
    expect(html).toMatch(/data-act="buy-paint"[^>]*disabled/);
  });

  it("shows buggy nose options and bunker uses shared Aufkleber chips", () => {
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
    expect(bunker).toContain("Aufkleber");
    expect(bunker).not.toContain("IronClad");
    expect(bunker).not.toContain("Tür-Aufkleber");
    expect(bunker).toContain("Flammen");
    expect(emptyKit("bunker").sticker).toBe("none");
  });
});

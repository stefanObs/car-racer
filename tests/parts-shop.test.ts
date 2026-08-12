import { describe, expect, it } from "vitest";
import { PARTS } from "../src/data/parts";
import { buyPart, selectPartInGarage, showcaseParts } from "../src/meta/partsShop";
import { defaultSave, emptyKit } from "../src/meta/save";

describe("parts preview + buy", () => {
  it("selecting a shop part previews without spending", () => {
    const kit = emptyKit("blitz");
    const save = defaultSave();
    save.chf = 1000;
    const next = selectPartInGarage(kit, "big_engine", null);
    expect(next.previewPart).toBe("big_engine");
    expect(next.dirty).toBe(false);
    expect(kit.ownedParts).toEqual([]);
    expect(save.chf).toBe(1000);
    expect(showcaseParts(kit, next.previewPart)).toEqual(["big_engine"]);
  });

  it("buying a previewed part spends CHF and equips it", () => {
    const kit = emptyKit("blitz");
    const save = defaultSave();
    save.chf = 1000;
    expect(buyPart(save, kit, "big_engine")).toBe(true);
    expect(save.chf).toBe(1000 - PARTS.big_engine.priceChf);
    expect(kit.ownedParts).toContain("big_engine");
    expect(kit.equippedParts).toContain("big_engine");
    expect(buyPart(save, kit, "big_engine")).toBe(false);
  });

  it("owned parts toggle equip and clear preview", () => {
    const kit = emptyKit("blitz");
    kit.ownedParts = ["big_engine"];
    kit.equippedParts = ["big_engine"];
    const off = selectPartInGarage(kit, "big_engine", "nitro_kit");
    expect(off.equippedParts).toEqual([]);
    expect(off.previewPart).toBeNull();
    expect(off.dirty).toBe(true);
    kit.equippedParts = [];
    const on = selectPartInGarage(kit, "big_engine", null);
    expect(on.equippedParts).toEqual(["big_engine"]);
  });

  it("refuses buy when broke", () => {
    const kit = emptyKit("blitz");
    const save = defaultSave();
    save.chf = 10;
    expect(buyPart(save, kit, "big_engine")).toBe(false);
    expect(kit.ownedParts).toEqual([]);
  });
});

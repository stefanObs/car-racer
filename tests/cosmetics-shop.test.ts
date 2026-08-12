import { describe, expect, it } from "vitest";
import { PAINT_PRICE_CHF, STICKER_PRICE_CHF } from "../src/data/cosmetics";
import {
  buyPaint,
  buySticker,
  ownsPaint,
  ownsSticker,
  selectPaintInGarage,
  selectStickerInGarage,
} from "../src/meta/cosmeticsShop";
import { defaultSave, emptyKit } from "../src/meta/save";

describe("cosmetics preview + buy", () => {
  it("starts with only class default paint and free none sticker", () => {
    const kit = emptyKit("blitz");
    expect(kit.ownedPaints).toEqual(["#e03131"]);
    expect(kit.ownedStickers).toEqual(["none"]);
    expect(ownsPaint(kit, "#339af0")).toBe(false);
    expect(ownsSticker(kit, "flames")).toBe(false);
  });

  it("selecting an unowned paint previews without spending", () => {
    const kit = emptyKit("blitz");
    const save = defaultSave();
    save.chf = 500;
    const next = selectPaintInGarage(kit, "#339af0", null);
    expect(next.previewPaint).toBe("#339af0");
    expect(next.paint).toBe("#e03131");
    expect(save.chf).toBe(500);
    expect(ownsPaint(kit, "#339af0")).toBe(false);
  });

  it("buying a previewed paint spends CHF and equips it", () => {
    const kit = emptyKit("blitz");
    const save = defaultSave();
    save.chf = 200;
    expect(buyPaint(save, kit, "#339af0")).toBe(true);
    expect(save.chf).toBe(200 - PAINT_PRICE_CHF);
    expect(kit.paint).toBe("#339af0");
    expect(ownsPaint(kit, "#339af0")).toBe(true);
    expect(buyPaint(save, kit, "#339af0")).toBe(false);
  });

  it("selecting an owned paint equips immediately", () => {
    const kit = emptyKit("blitz");
    kit.ownedPaints.push("#339af0");
    const next = selectPaintInGarage(kit, "#339af0", "#f08c00");
    expect(next.paint).toBe("#339af0");
    expect(next.previewPaint).toBeNull();
  });

  it("buying a sticker works the same; none stays free", () => {
    const kit = emptyKit("blitz");
    const save = defaultSave();
    save.chf = 50;
    expect(buySticker(save, kit, "flames")).toBe(false);
    save.chf = 200;
    expect(buySticker(save, kit, "flames")).toBe(true);
    expect(save.chf).toBe(200 - STICKER_PRICE_CHF);
    expect(kit.sticker).toBe("flames");
    expect(ownsSticker(kit, "flames")).toBe(true);
    expect(buySticker(save, kit, "none")).toBe(false);
    const preview = selectStickerInGarage(kit, "bolt", null);
    expect(preview.previewSticker).toBe("bolt");
    expect(preview.sticker).toBe("flames");
  });
});

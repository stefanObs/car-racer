import { describe, expect, it } from "vitest";
import { CARS } from "../src/data/cars";
import {
  buyCar,
  isUnownedPreview,
  selectCarInGarage,
  showcaseCarId,
  showcaseKit,
} from "../src/meta/carShop";
import { defaultSave } from "../src/meta/save";

describe("garage car preview + buy", () => {
  it("clicking an unowned car previews it without spending or switching the racer", () => {
    const save = defaultSave();
    save.chf = 5000;
    const next = selectCarInGarage(save.ownedCars, save.activeCar, "bison");
    expect(next.previewCar).toBe("bison");
    expect(next.activeCar).toBe("blitz");
    expect(save.ownedCars).toEqual(["blitz"]);
    expect(save.chf).toBe(5000);
    expect(isUnownedPreview(save.ownedCars, next.previewCar)).toBe(true);
    expect(showcaseCarId(next.activeCar, next.previewCar)).toBe("bison");
  });

  it("clicking an owned car clears preview and makes it active", () => {
    const next = selectCarInGarage(["blitz", "bison"], "blitz", "bison");
    expect(next.activeCar).toBe("bison");
    expect(next.previewCar).toBeNull();
  });

  it("buyCar spends CHF and owns the previewed car", () => {
    const save = defaultSave();
    save.chf = 1000;
    expect(buyCar(save, "bison")).toBe(true);
    expect(save.ownedCars).toContain("bison");
    expect(save.activeCar).toBe("bison");
    expect(save.chf).toBe(1000 - CARS.bison.priceChf);
    expect(save.kits.bison).toBeTruthy();
  });

  it("buyCar refuses if broke or already owned", () => {
    const save = defaultSave();
    save.chf = 10;
    expect(buyCar(save, "bison")).toBe(false);
    expect(save.ownedCars).toEqual(["blitz"]);
    expect(buyCar(save, "blitz")).toBe(false);
  });

  it("showcase kit for a locked preview is stock (not the active car's parts)", () => {
    const save = defaultSave();
    save.kits.blitz!.ownedParts = ["big_engine"];
    save.kits.blitz!.equippedParts = ["big_engine"];
    const kit = showcaseKit(save, "bison");
    expect(kit.equippedParts).toEqual([]);
    expect(kit.paint).toBe(CARS.bison.defaultPaint);
  });
});

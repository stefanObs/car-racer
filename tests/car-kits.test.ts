import { describe, expect, it } from "vitest";
import { CAR_IDS, CARS, gearClassOf } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
import {
  activeKit,
  defaultSave,
  emptyKit,
  ensureKit,
  migrateV1ToV2,
  normalizeSave,
} from "../src/meta/save";
import { carGearClass } from "../src/render/comicCarMesh";

describe("car models and per-car kits", () => {
  it("ships all five category cars from the target sheet", () => {
    expect(CAR_IDS).toEqual(["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"]);
    expect(gearClassOf("blitz")).toBe("sport");
    expect(gearClassOf("bison")).toBe("pickup");
    expect(gearClassOf("kaeferkraft")).toBe("buggy");
    expect(gearClassOf("donnerbuechse")).toBe("hotrod");
    expect(gearClassOf("bunker")).toBe("armor");
  });

  it("maps modelId to gear class for visuals", () => {
    expect(carGearClass({ modelId: "blitz" } as never)).toBe("sport");
    expect(carGearClass({ modelId: "kaeferkraft" } as never)).toBe("buggy");
    expect(carGearClass({ modelId: "donnerbuechse" } as never)).toBe("hotrod");
  });

  it("applies class-innate nitro and grass mitigation in mergeStats", () => {
    const hot = mergeStats(CARS.donnerbuechse.stats, []);
    expect(hot.nitroBonus).toBeGreaterThan(0.2);
    const buggy = mergeStats(CARS.kaeferkraft.stats, []);
    expect(buggy.grassMitigation).toBeGreaterThan(0.1);
    const sport = mergeStats(CARS.blitz.stats, []);
    expect(sport.nitroBonus).toBe(0);
  });

  it("does not share owned parts between cars (RCA: old global inventory)", () => {
    const save = defaultSave();
    const blitz = activeKit(save);
    blitz.ownedParts.push("big_engine");
    blitz.equippedParts.push("big_engine");

    ensureKit(save, "bison");
    save.ownedCars.push("bison");
    save.activeCar = "bison";
    const bison = activeKit(save);

    expect(blitz.ownedParts).toContain("big_engine");
    expect(bison.ownedParts).not.toContain("big_engine");
    expect(bison.equippedParts).toEqual([]);
    expect(bison.paint).toBe(CARS.bison.defaultPaint);
  });

  it("migrates v1 global parts onto the then-active car only", () => {
    const migrated = migrateV1ToV2({
      version: 1,
      chf: 500,
      ownedCars: ["blitz", "bison"],
      activeCar: "blitz",
      ownedParts: ["nitro_kit", "rear_spoiler"],
      equippedParts: ["nitro_kit"],
      paint: "#339af0",
      sticker: "flames",
    });
    expect(migrated.version).toBe(2);
    expect(migrated.kits.blitz!.ownedParts).toEqual(["nitro_kit", "rear_spoiler"]);
    expect(migrated.kits.blitz!.equippedParts).toEqual(["nitro_kit"]);
    expect(migrated.kits.blitz!.paint).toBe("#339af0");
    expect(migrated.kits.bison!.ownedParts).toEqual([]);
    expect(migrated.kits.bison!.paint).toBe(CARS.bison.defaultPaint);
  });

  it("normalizes legacy saves through normalizeSave", () => {
    const n = normalizeSave({
      version: 1,
      activeCar: "bison",
      ownedCars: ["blitz", "bison"],
      ownedParts: ["big_wheels"],
      equippedParts: ["big_wheels"],
    });
    expect(n.kits.bison!.ownedParts).toContain("big_wheels");
    expect(n.kits.blitz!.ownedParts).toEqual([]);
  });

  it("sanitizes retired ironClad sticker to none", () => {
    const n = normalizeSave({
      version: 2,
      chf: 0,
      ownedCars: ["bunker"],
      activeCar: "bunker",
      kits: {
        bunker: { ownedParts: [], equippedParts: [], paint: "#868e96", sticker: "ironClad" as never },
      },
      unlockedLevels: ["blitz_cup_01_hafenstart"],
      cupStars: {},
      cupIndexUnlocked: 1,
    });
    expect(n.kits.bunker!.sticker).toBe("none");
  });

  it("emptyKit starts with class default paint and no parts", () => {
    const k = emptyKit("bison");
    expect(k.ownedParts).toEqual([]);
    expect(k.paint).toBe("#2f9e44");
    expect(emptyKit("kaeferkraft").paint).toBe("#12b886");
    expect(emptyKit("bunker").paint).toBe("#868e96");
    expect(emptyKit("bunker").sticker).toBe("none");
  });
});

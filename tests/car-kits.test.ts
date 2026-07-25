import { describe, expect, it } from "vitest";
import { CARS, gearClassOf } from "../src/data/cars";
import {
  activeKit,
  defaultSave,
  emptyKit,
  ensureKit,
  migrateV1ToV2,
  normalizeSave,
} from "../src/meta/save";
import { buildComicCar, carGearClass } from "../src/render/comicCarMesh";
import { createCarState } from "../src/sim/vehicle";
import { CARS as CAR_TABLE } from "../src/data/cars";

describe("car models and per-car kits", () => {
  it("assigns distinct gear classes to Blitz and Bison", () => {
    expect(gearClassOf("blitz")).toBe("sport");
    expect(gearClassOf("bison")).toBe("pickup");
    expect(CARS.blitz.gearClass).not.toBe(CARS.bison.gearClass);
  });

  it("builds different mesh silhouettes for sport vs pickup", () => {
    const sport = buildComicCar(
      createCarState({
        id: "s",
        isPlayer: true,
        x: 0,
        z: 0,
        heading: 0,
        paint: "#e03131",
        sticker: "none",
        modelId: "blitz",
        stats: { ...CAR_TABLE.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0 },
      }),
    );
    const pickup = buildComicCar(
      createCarState({
        id: "p",
        isPlayer: true,
        x: 0,
        z: 0,
        heading: 0,
        paint: "#2f9e44",
        sticker: "none",
        modelId: "bison",
        stats: { ...CAR_TABLE.bison.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0 },
      }),
    );
    expect(sport.root.userData.gearClass).toBe("sport");
    expect(pickup.root.userData.gearClass).toBe("pickup");
    expect(sport.root.children.length).not.toBe(pickup.root.children.length);
    expect(carGearClass({ modelId: "bison" } as never)).toBe("pickup");
    expect(carGearClass({ modelId: "blitz" } as never)).toBe("sport");
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

  it("emptyKit starts with class default paint and no parts", () => {
    const k = emptyKit("bison");
    expect(k.ownedParts).toEqual([]);
    expect(k.paint).toBe("#2f9e44");
  });
});

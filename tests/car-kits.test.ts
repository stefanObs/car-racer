import { describe, expect, it } from "vitest";
import { CAR_IDS, CARS, gearClassOf, type CarId } from "../src/data/cars";
import { mergeStats } from "../src/data/parts";
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

function meshFor(id: CarId) {
  return buildComicCar(
    createCarState({
      id: id,
      isPlayer: true,
      x: 0,
      z: 0,
      heading: 0,
      paint: CARS[id].defaultPaint,
      sticker: "none",
      modelId: id,
      stats: { ...mergeStats(CARS[id].stats, []) },
    }),
  );
}

describe("car models and per-car kits", () => {
  it("ships all five category cars from the target sheet", () => {
    expect(CAR_IDS).toEqual(["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"]);
    expect(gearClassOf("blitz")).toBe("sport");
    expect(gearClassOf("bison")).toBe("pickup");
    expect(gearClassOf("kaeferkraft")).toBe("buggy");
    expect(gearClassOf("donnerbuechse")).toBe("hotrod");
    expect(gearClassOf("bunker")).toBe("armor");
  });

  it("builds a distinct silhouette per gear class", () => {
    const counts = new Map<string, number>();
    for (const id of CAR_IDS) {
      const mesh = meshFor(id);
      expect(mesh.root.userData.gearClass).toBe(CARS[id].gearClass);
      expect(carGearClass({ modelId: id } as never)).toBe(CARS[id].gearClass);
      counts.set(id, mesh.root.children.length);
    }
    const unique = new Set(counts.values());
    expect(unique.size).toBeGreaterThanOrEqual(4);
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

  it("emptyKit starts with class default paint and no parts", () => {
    const k = emptyKit("bison");
    expect(k.ownedParts).toEqual([]);
    expect(k.paint).toBe("#2f9e44");
    expect(emptyKit("kaeferkraft").paint).toBe("#f08c00");
    expect(emptyKit("bunker").paint).toBe("#868e96");
  });
});

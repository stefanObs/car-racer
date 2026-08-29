export type CarId = "blitz" | "bison" | "kaeferkraft" | "donnerbuechse" | "bunker";

/** Gear class drives silhouette + fantasy (CONCEPT §5 / car-category-targets.png). */
export type GearClass = "sport" | "pickup" | "buggy" | "hotrod" | "armor";

export interface CarDef {
  id: CarId;
  name: string;
  classLabel: string;
  gearClass: GearClass;
  description: string;
  priceChf: number;
  /** Base stats before parts */
  stats: VehicleStats;
  defaultPaint: string;
}

export interface VehicleStats {
  accel: number;
  topSpeed: number;
  grip: number;
  mass: number;
  armor: number;
  handling: number;
  suspension: number;
  /** Class-innate nitro strength (Hot Rod etc.). */
  nitroBonus?: number;
  /** Class-innate grass mitigation (Buggy etc.). */
  grassMitigation?: number;
}

export const CARS: Record<CarId, CarDef> = {
  blitz: {
    id: "blitz",
    name: "Blitz",
    classLabel: "Sportwagen",
    gearClass: "sport",
    description: "Schnell rein, eng lenken — fliegt bei Remplern und Buckeln.",
    priceChf: 0,
    defaultPaint: "#e03131",
    stats: {
      accel: 1.2,
      topSpeed: 1.35,
      grip: 1.0,
      mass: 0.7,
      armor: 0.65,
      handling: 1.35,
      suspension: 0.6,
    },
  },
  bison: {
    id: "bison",
    name: "Bison",
    classLabel: "Pick-up",
    gearClass: "pickup",
    description: "Mittlere Speed, schiebt andere weg — Gras nur etwas milder.",
    priceChf: 900,
    defaultPaint: "#2f9e44",
    stats: {
      accel: 1.0,
      topSpeed: 1.0,
      grip: 1.0,
      mass: 1.4,
      armor: 1.05,
      handling: 1.0,
      suspension: 1.0,
      grassMitigation: 0.1,
    },
  },
  kaeferkraft: {
    id: "kaeferkraft",
    name: "Käferkraft",
    classLabel: "Buggy",
    gearClass: "buggy",
    description: "Gras und Sprünge easy, leicht — hält aber Schaden aus.",
    priceChf: 1400,
    defaultPaint: "#12b886",
    stats: {
      accel: 1.2,
      topSpeed: 0.95,
      grip: 1.2,
      mass: 0.7,
      armor: 1.35,
      handling: 1.0,
      suspension: 1.45,
      grassMitigation: 0.35,
    },
  },
  donnerbuechse: {
    id: "donnerbuechse",
    name: "Donnerbüchse",
    classLabel: "Hot Rod",
    gearClass: "hotrod",
    description: "Nitro-Rakete auf der Geraden — Kurven und Gras sind Drama.",
    priceChf: 1800,
    defaultPaint: "#339af0",
    stats: {
      accel: 1.4,
      topSpeed: 1.2,
      grip: 0.65,
      mass: 0.9,
      armor: 0.85,
      handling: 0.65,
      suspension: 0.65,
      nitroBonus: 0.4,
    },
  },
  bunker: {
    id: "bunker",
    name: "Bunker",
    classLabel: "Panzerwagen",
    gearClass: "armor",
    description: "Kriecht an, stirbt kaum, kürzt Gras — Schanzen hassen ihn.",
    priceChf: 2400,
    defaultPaint: "#868e96",
    stats: {
      accel: 0.6,
      topSpeed: 0.65,
      grip: 1.0,
      mass: 1.75,
      armor: 1.9,
      handling: 0.6,
      suspension: 0.85,
      grassMitigation: 0.28,
    },
  },
};

export const CAR_IDS = Object.keys(CARS) as CarId[];

export function gearClassOf(carId: CarId): GearClass {
  return CARS[carId].gearClass;
}

/** Käferkraft uses bumper nose ornaments instead of side/hood stickers. */
export function carUsesNoseVariants(id: CarId): boolean {
  return id === "kaeferkraft";
}

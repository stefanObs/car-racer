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
    description: "Schnell und präzise — aber leicht und empfindlich.",
    priceChf: 0,
    defaultPaint: "#e03131",
    stats: {
      accel: 1.25,
      topSpeed: 1.2,
      grip: 0.95,
      mass: 0.75,
      armor: 0.7,
      handling: 1.2,
      suspension: 0.7,
    },
  },
  bison: {
    id: "bison",
    name: "Bison",
    classLabel: "Pick-up",
    gearClass: "pickup",
    description: "Schwer und standfest — braucht länger für Tempo.",
    priceChf: 900,
    defaultPaint: "#2f9e44",
    stats: {
      accel: 0.85,
      topSpeed: 0.95,
      grip: 1.0,
      mass: 1.35,
      armor: 1.35,
      handling: 0.85,
      suspension: 1.05,
    },
  },
  kaeferkraft: {
    id: "kaeferkraft",
    name: "Käferkraft",
    classLabel: "Buggy",
    gearClass: "buggy",
    description: "Grip und Federung für Gras und Buckel — mittlere Speed.",
    priceChf: 1400,
    defaultPaint: "#12b886",
    stats: {
      accel: 1.0,
      topSpeed: 0.95,
      grip: 1.25,
      mass: 0.9,
      armor: 0.85,
      handling: 1.05,
      suspension: 1.35,
      grassMitigation: 0.18,
    },
  },
  donnerbuechse: {
    id: "donnerbuechse",
    name: "Donnerbüchse",
    classLabel: "Hot Rod",
    gearClass: "hotrod",
    description: "Laut und nitro-stark auf der Geraden — schleudert gern.",
    priceChf: 1800,
    defaultPaint: "#339af0",
    stats: {
      accel: 1.15,
      topSpeed: 1.25,
      grip: 0.7,
      mass: 0.95,
      armor: 0.8,
      handling: 0.75,
      suspension: 0.75,
      nitroBonus: 0.28,
    },
  },
  bunker: {
    id: "bunker",
    name: "Bunker",
    classLabel: "Panzerwagen",
    gearClass: "armor",
    description: "Fast unzerstörbar — langsam und träge ohne Tuning.",
    priceChf: 2400,
    defaultPaint: "#868e96",
    stats: {
      accel: 0.65,
      topSpeed: 0.7,
      grip: 0.95,
      mass: 1.7,
      armor: 1.85,
      handling: 0.65,
      suspension: 1.1,
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
